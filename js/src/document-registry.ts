/**
 * @vattelum/document-registry-js — reference implementation of the
 * Vattelum Document References standard (JavaScript / TypeScript half).
 *
 * Pure functions, no I/O. Caller fetches on-chain data and passes typed
 * values in.
 */

import { keccak_256 } from '@noble/hashes/sha3';

// ─── Document Struct ───────────────────────────────────────────────────
// Mirrors the Solidity struct field-for-field. Append-only.
// `contentHash` is 0x-prefixed hex (32 bytes). `timestamp` is unix seconds.
export type Document = {
	contentUri: string;
	contentHash: string;
	title: string;
	version: bigint;
	timestamp: bigint;
	voteId: string;
	docType: number;
};

// ─── Document Types ────────────────────────────────────────────────────
// Values 0–4 frozen. Values 5–255 reserved.
export const DOC_TYPE_ORIGINAL     = 0;
export const DOC_TYPE_AMENDMENT    = 1;
export const DOC_TYPE_REVISION     = 2;
export const DOC_TYPE_REPEAL       = 3;
export const DOC_TYPE_CODIFICATION = 4;

// ─── DocumentReference ─────────────────────────────────────────────────
// Mirrors the Solidity struct field-for-field. Append-only.
export type DocumentReference = {
	registryAddress: string;
	chainId: bigint;
	categoryId: bigint;
	documentId: bigint;
	version: bigint;
	relationType: number;
	targetSection: string;
};

// ─── Relation Types ────────────────────────────────────────────────────
// Values 0–7 frozen. Values 8–255 reserved.
export const RELATION_AMENDS     = 0;
export const RELATION_REVISES    = 1;
export const RELATION_REPEALS    = 2;
export const RELATION_CODIFIES   = 3;
export const RELATION_GOVERNS    = 4;
export const RELATION_IMPLEMENTS = 5;
export const RELATION_REFERENCES = 6;
export const RELATION_TEMPLATE   = 7;

// ─── Hash Procedure ────────────────────────────────────────────────────
/**
 * SHA-256 of trimmed UTF-8 body. Output: 64 lowercase hex chars, no `0x`.
 *
 * Frozen forever — every conforming implementation produces the same digest
 * for the same input. This is the binding-integrity primitive: the on-chain
 * `contentHash` field of `Document` is exactly this output (with `0x` prefix
 * added when stored as `bytes32`).
 */
export async function hashBody(body: string): Promise<string> {
	const data = new TextEncoder().encode(body.trim());
	const buffer = await globalThis.crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(buffer);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// ─── EIP-55 Address Checksum ───────────────────────────────────────────
/**
 * Returns the EIP-55 mixed-case checksum form of an Ethereum address.
 * Accepts any case input (lowercase, uppercase, or already-checksummed).
 *
 * Two callers passing different cases of the same address produce the same
 * checksummed string, so citation strings are byte-identical regardless of
 * how the caller stored the address.
 */
export function toChecksumAddress(address: string): string {
	const stripped = address.toLowerCase().replace(/^0x/, '');
	if (!/^[0-9a-f]{40}$/.test(stripped)) {
		throw new Error(`Invalid Ethereum address: ${address}`);
	}
	const hash = keccak_256(new TextEncoder().encode(stripped));
	let out = '0x';
	for (let i = 0; i < 40; i++) {
		const ch = stripped[i];
		// Each hex char in the address corresponds to 4 bits in the keccak
		// digest. The EIP-55 rule: uppercase the char if its nibble >= 8.
		const nibble = (hash[i >> 1] >> (i % 2 === 0 ? 4 : 0)) & 0xf;
		out += nibble >= 8 ? ch.toUpperCase() : ch;
	}
	return out;
}

// ─── Citation Format ───────────────────────────────────────────────────
const MONTHS = [
	'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
	'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Canonical printed citation for a document or contract.
 *
 * Frozen format (positions 1–7, then optional section pointer):
 *
 *   "[Title]", v[Version], [Category], [EIP-55 Address], [Network], ratified [DD Mon YYYY] UTC, hash: [hash]
 *
 * Followed by `, §<targetSection>` when `ref.targetSection` is non-empty.
 * Multi-target sections (comma-separated in `targetSection`) render as
 * `, §3.1, §4` — each piece prefixed with `§`, joined by `, `.
 *
 * Determinism rules baked into this output:
 * - Date is rendered in UTC. The on-chain `timestamp` is timezone-less unix
 *   seconds; UTC is the only rendering that two implementations agree on.
 * - Address is normalized to EIP-55 checksum form. Two callers passing
 *   different cases of the same address produce the same citation.
 * - Content hash is emitted lowercase with no `0x` prefix.
 *
 * `categoryName` and `networkName` are caller-supplied because category-id
 * and chain-id to human-name lookups are consumer concerns: the registry
 * stores ids, not names.
 *
 * Synchronous. Pure.
 */
export function formatCitation(
	ref: DocumentReference,
	doc: Document,
	names: { categoryName: string; networkName: string }
): string {
	const d = new Date(Number(doc.timestamp) * 1000);
	const day = String(d.getUTCDate()).padStart(2, '0');
	const date = `${day} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
	const hash = doc.contentHash.toLowerCase().replace(/^0x/, '');
	const addr = toChecksumAddress(ref.registryAddress);

	let out = `"${doc.title}", v${doc.version}, ${names.categoryName}, ${addr}, ${names.networkName}, ratified ${date} UTC, hash: ${hash}`;

	if (ref.targetSection !== '') {
		const sections = ref.targetSection
			.split(',')
			.map((s) => s.trim())
			.filter((s) => s.length > 0);
		if (sections.length > 0) {
			out += ', ' + sections.map((s) => `§${s}`).join(', ');
		}
	}

	return out;
}

// ─── Resolution Protocol ───────────────────────────────────────────────
export type Status = 'In Force' | 'Amended' | 'Revised' | 'Repealed' | 'Codified';

const PRECEDENCE: Record<Status, number> = {
	'In Force': 0,
	'Amended':  1,
	'Codified': 2,
	'Revised':  3,
	'Repealed': 4
};

/**
 * Status of `target` from observer time `asOf`.
 *
 * Pure: the caller pre-fetches `history` (`getHistory`) and
 * `referencesByVersion` (`getReferences` for each version with
 * `version > target.version`) and passes them in.
 *
 * Algorithm: filter `history` to versions with `timestamp <= asOf`; for
 * each filtered version with `version > target.version`, scan its references;
 * the first reference matching `target` by `(registryAddress, categoryId,
 * documentId, version)` produces a candidate status, with precedence
 * Repealed > Revised > Codified > Amended > In Force.
 *
 * Address comparison is case-insensitive — registries can be cited in any
 * case form (lowercase, uppercase, or EIP-55 checksum) and the same status
 * is returned. Unknown `relationType` values are tolerated as informational
 * and produce no status change.
 */
export function resolveStatus(
	target: {
		registryAddress: string;
		categoryId: bigint;
		documentId: bigint;
		version: bigint;
	},
	history: Document[],
	referencesByVersion: Map<bigint, DocumentReference[]>,
	asOf: bigint
): Status {
	const targetAddr = target.registryAddress.toLowerCase();
	let best: Status = 'In Force';

	for (const v of history) {
		if (v.timestamp > asOf) continue;
		if (v.version <= target.version) continue;

		const refs = referencesByVersion.get(v.version) ?? [];
		for (const r of refs) {
			if (
				r.registryAddress.toLowerCase() !== targetAddr ||
				r.categoryId !== target.categoryId ||
				r.documentId !== target.documentId ||
				r.version !== target.version
			) {
				continue;
			}

			let candidate: Status | null = null;
			if (r.relationType === RELATION_REPEALS) candidate = 'Repealed';
			else if (r.relationType === RELATION_REVISES) candidate = 'Revised';
			else if (r.relationType === RELATION_CODIFIES) candidate = 'Codified';
			else if (r.relationType === RELATION_AMENDS) candidate = 'Amended';

			if (candidate && PRECEDENCE[candidate] > PRECEDENCE[best]) {
				best = candidate;
			}
		}
	}

	return best;
}
