import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
	hashBody,
	formatCitation,
	resolveStatus,
	toChecksumAddress,
	stripFrontmatter,
	formatDate,
	RELATION_AMENDS,
	RELATION_REVISES,
	RELATION_REPEALS,
	RELATION_CODIFIES,
	RELATION_GOVERNS,
	RELATION_IMPLEMENTS,
	RELATION_REFERENCES,
	RELATION_TEMPLATE,
	DOC_TYPE_ORIGINAL,
	DOC_TYPE_AMENDMENT,
	DOC_TYPE_REVISION,
	DOC_TYPE_REPEAL,
	DOC_TYPE_CODIFICATION,
	type Document,
	type DocumentReference
} from '../src/document-registry.ts';

// ─── Constants ─────────────────────────────────────────────────────────
test('relation constants', () => {
	assert.equal(RELATION_AMENDS, 0);
	assert.equal(RELATION_REVISES, 1);
	assert.equal(RELATION_REPEALS, 2);
	assert.equal(RELATION_CODIFIES, 3);
	assert.equal(RELATION_GOVERNS, 4);
	assert.equal(RELATION_IMPLEMENTS, 5);
	assert.equal(RELATION_REFERENCES, 6);
	assert.equal(RELATION_TEMPLATE,   7);
});

test('document-type constants', () => {
	assert.equal(DOC_TYPE_ORIGINAL, 0);
	assert.equal(DOC_TYPE_AMENDMENT, 1);
	assert.equal(DOC_TYPE_REVISION, 2);
	assert.equal(DOC_TYPE_REPEAL, 3);
	assert.equal(DOC_TYPE_CODIFICATION, 4);
});

// ─── Hash Procedure ────────────────────────────────────────────────────
test('hashBody — SHA-256 of empty body (NIST vector)', async () => {
	assert.equal(
		await hashBody(''),
		'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
	);
});

test('hashBody — SHA-256 of "abc" (NIST vector)', async () => {
	assert.equal(
		await hashBody('abc'),
		'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
	);
});

test('hashBody — strips leading/trailing whitespace', async () => {
	const a = await hashBody('  hello world  \n');
	const b = await hashBody('hello world');
	assert.equal(a, b);
});

test('hashBody — UTF-8 multi-byte input', async () => {
	// "héllo" UTF-8: 68 c3 a9 6c 6c 6f
	assert.equal(
		await hashBody('héllo'),
		'3c48591d8d098a4538f5e013dfcf406e948eac4d3277b10bf614e295d6068179'
	);
});

// ─── EIP-55 Checksum ───────────────────────────────────────────────────
// Vectors taken verbatim from EIP-55 (https://eips.ethereum.org/EIPS/eip-55).
test('toChecksumAddress — EIP-55 reference vectors', () => {
	assert.equal(
		toChecksumAddress('0x52908400098527886e0f7030069857d2e4169ee7'),
		'0x52908400098527886E0F7030069857D2E4169EE7'
	);
	assert.equal(
		toChecksumAddress('0x8617e340b3d01fa5f11f306f4090fd50e238070d'),
		'0x8617E340B3D01FA5F11F306F4090FD50E238070D'
	);
	assert.equal(
		toChecksumAddress('0xde709f2102306220921060314715629080e2fb77'),
		'0xde709f2102306220921060314715629080e2fb77'
	);
	assert.equal(
		toChecksumAddress('0x27b1fdb04752bbc536007a920d24acb045561c26'),
		'0x27b1fdb04752bbc536007a920d24acb045561c26'
	);
	assert.equal(
		toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed'),
		'0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
	);
	assert.equal(
		toChecksumAddress('0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359'),
		'0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359'
	);
	assert.equal(
		toChecksumAddress('0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb'),
		'0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB'
	);
	assert.equal(
		toChecksumAddress('0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb'),
		'0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb'
	);
});

test('toChecksumAddress — case-insensitive input', () => {
	const lower = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
	const upper = '0X5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED';
	const mixed = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
	const expected = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
	assert.equal(toChecksumAddress(lower), expected);
	assert.equal(toChecksumAddress(upper), expected);
	assert.equal(toChecksumAddress(mixed), expected);
});

test('toChecksumAddress — rejects invalid input', () => {
	assert.throws(() => toChecksumAddress('not-an-address'), /Invalid Ethereum address/);
	assert.throws(() => toChecksumAddress('0xabc'), /Invalid Ethereum address/);
	assert.throws(() => toChecksumAddress('0x' + 'g'.repeat(40)), /Invalid Ethereum address/);
});

// ─── Citation Format ───────────────────────────────────────────────────
test('formatCitation — canonical printed citation', () => {
	const ref: DocumentReference = {
		registryAddress: '0x9292ac2c1d917b9f14a4b6ecd70d90a8265c660a',
		chainId: 11155111n,
		categoryId: 1n,
		documentId: 2n,
		version: 3n,
		relationType: RELATION_GOVERNS,
		targetSection: ''
	};
	const doc: Document = {
		contentUri: 'tx',
		contentHash: '0xabc123def456789012345678901234567890123456789012345678901234abcd',
		title: 'Foundational Document',
		version: 3n,
		timestamp: 1746230400n, // 2025-05-03 00:00:00 UTC
		voteId: 'vote',
		docType: DOC_TYPE_ORIGINAL
	};

	assert.equal(
		formatCitation(ref, doc, { categoryName: 'Constitution', networkName: 'Sepolia' }),
		'"Foundational Document", v3, Constitution, '
			+ toChecksumAddress(ref.registryAddress)
			+ ', Sepolia, ratified 03 May 2025 UTC, hash: abc123def456789012345678901234567890123456789012345678901234abcd'
	);
});

test('formatCitation — UTC date rendering (cross-implementation determinism)', () => {
	const ref: DocumentReference = {
		registryAddress: '0x0000000000000000000000000000000000000001',
		chainId: 1n,
		categoryId: 0n,
		documentId: 0n,
		version: 1n,
		relationType: RELATION_REFERENCES,
		targetSection: ''
	};
	const doc: Document = {
		contentUri: '',
		contentHash: '0x' + '0'.repeat(64),
		title: 'X',
		version: 1n,
		timestamp: 0n, // 1970-01-01 00:00:00 UTC
		voteId: '',
		docType: DOC_TYPE_ORIGINAL
	};
	const out = formatCitation(ref, doc, { categoryName: 'Cat', networkName: 'Mainnet' });
	assert.match(out, /ratified 01 Jan 1970 UTC/);
});

test('formatCitation — address case-insensitive (lowercase and uppercase produce identical output)', () => {
	const lower = '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed';
	const upper = '0x5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED';
	const doc: Document = {
		contentUri: '', contentHash: '0x' + '0'.repeat(64), title: 'T',
		version: 1n, timestamp: 0n, voteId: '', docType: DOC_TYPE_ORIGINAL
	};
	const refA: DocumentReference = {
		registryAddress: lower, chainId: 1n, categoryId: 0n, documentId: 0n,
		version: 1n, relationType: RELATION_REFERENCES, targetSection: ''
	};
	const refB: DocumentReference = { ...refA, registryAddress: upper };
	const a = formatCitation(refA, doc, { categoryName: 'C', networkName: 'N' });
	const b = formatCitation(refB, doc, { categoryName: 'C', networkName: 'N' });
	assert.equal(a, b);
});

test('formatCitation — section pointer emitted for non-empty targetSection', () => {
	const ref: DocumentReference = {
		registryAddress: '0x0000000000000000000000000000000000000001',
		chainId: 1n, categoryId: 0n, documentId: 0n, version: 1n,
		relationType: RELATION_GOVERNS,
		targetSection: '3.1'
	};
	const doc: Document = {
		contentUri: '', contentHash: '0x' + '0'.repeat(64), title: 'Constitution',
		version: 3n, timestamp: 0n, voteId: '', docType: DOC_TYPE_ORIGINAL
	};
	const out = formatCitation(ref, doc, { categoryName: 'Cat', networkName: 'Mainnet' });
	assert.match(out, /, §3\.1$/);
});

test('formatCitation — multi-target section pointer (comma-separated)', () => {
	const ref: DocumentReference = {
		registryAddress: '0x0000000000000000000000000000000000000001',
		chainId: 1n, categoryId: 0n, documentId: 0n, version: 1n,
		relationType: RELATION_GOVERNS,
		targetSection: '3.1, 4'
	};
	const doc: Document = {
		contentUri: '', contentHash: '0x' + '0'.repeat(64), title: 'Constitution',
		version: 3n, timestamp: 0n, voteId: '', docType: DOC_TYPE_ORIGINAL
	};
	const out = formatCitation(ref, doc, { categoryName: 'Cat', networkName: 'Mainnet' });
	assert.match(out, /, §3\.1, §4$/);
});

test('formatCitation — empty targetSection adds nothing', () => {
	const ref: DocumentReference = {
		registryAddress: '0x0000000000000000000000000000000000000001',
		chainId: 1n, categoryId: 0n, documentId: 0n, version: 1n,
		relationType: RELATION_GOVERNS,
		targetSection: ''
	};
	const doc: Document = {
		contentUri: '', contentHash: '0x' + '0'.repeat(64), title: 'Constitution',
		version: 3n, timestamp: 0n, voteId: '', docType: DOC_TYPE_ORIGINAL
	};
	const out = formatCitation(ref, doc, { categoryName: 'Cat', networkName: 'Mainnet' });
	assert.doesNotMatch(out, /§/);
});

// ─── Resolution Protocol ───────────────────────────────────────────────
const TARGET = {
	registryAddress: '0x0000000000000000000000000000000000000099',
	categoryId: 1n,
	documentId: 1n,
	version: 1n
};

function makeDoc(version: bigint, timestamp: bigint, docType: number): Document {
	return {
		contentUri: '',
		contentHash: '0x' + '0'.repeat(64),
		title: '',
		version,
		timestamp,
		voteId: '',
		docType
	};
}

function makeRef(relationType: number): DocumentReference {
	return {
		registryAddress: TARGET.registryAddress,
		chainId: 1n,
		categoryId: TARGET.categoryId,
		documentId: TARGET.documentId,
		version: TARGET.version,
		relationType,
		targetSection: ''
	};
}

test('resolveStatus — In Force when no later versions', () => {
	const history = [makeDoc(1n, 100n, DOC_TYPE_ORIGINAL)];
	const refs = new Map<bigint, DocumentReference[]>();
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'In Force');
});

test('resolveStatus — Amended when later version cites AMENDS', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [makeRef(RELATION_AMENDS)]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'Amended');
});

test('resolveStatus — precedence Repealed > Amended', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT),
		makeDoc(3n, 300n, DOC_TYPE_REPEAL)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [makeRef(RELATION_AMENDS)]],
		[3n, [makeRef(RELATION_REPEALS)]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'Repealed');
});

test('resolveStatus — precedence Revised > Codified > Amended', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT),
		makeDoc(3n, 300n, DOC_TYPE_CODIFICATION),
		makeDoc(4n, 400n, DOC_TYPE_REVISION)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [makeRef(RELATION_AMENDS)]],
		[3n, [makeRef(RELATION_CODIFIES)]],
		[4n, [makeRef(RELATION_REVISES)]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'Revised');
});

test('resolveStatus — asOf cutoff excludes later versions', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [makeRef(RELATION_AMENDS)]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 200n), 'Amended');
	assert.equal(resolveStatus(TARGET, history, refs, 199n), 'In Force');
});

test('resolveStatus — non-matching ref ignored', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [{ ...makeRef(RELATION_AMENDS), documentId: 99n }]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'In Force');
});

test('resolveStatus — registryAddress comparison is case-insensitive', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [{ ...makeRef(RELATION_AMENDS), registryAddress: TARGET.registryAddress.toUpperCase() }]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'Amended');
});

test('resolveStatus — TEMPLATE reference does not change status (provenance ≠ lifecycle)', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [makeRef(RELATION_TEMPLATE)]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'In Force');
});

test('resolveStatus — unknown relationType tolerated as informational', () => {
	const history = [
		makeDoc(1n, 100n, DOC_TYPE_ORIGINAL),
		makeDoc(2n, 200n, DOC_TYPE_AMENDMENT)
	];
	const refs = new Map<bigint, DocumentReference[]>([
		[2n, [{ ...makeRef(99) }]]
	]);
	assert.equal(resolveStatus(TARGET, history, refs, 1000n), 'In Force');
});

// ─── Frontmatter Strip ─────────────────────────────────────────────────
test('stripFrontmatter — strips block with \\n line endings', () => {
	const input = '---\ntitle: X\nversion: 1\n---\n\n# Body\nText here';
	assert.equal(stripFrontmatter(input), '# Body\nText here');
});

test('stripFrontmatter — strips block with \\r\\n line endings', () => {
	const input = '---\r\ntitle: X\r\nversion: 1\r\n---\r\n\r\n# Body\r\nText here';
	assert.equal(stripFrontmatter(input), '# Body\r\nText here');
});

test('stripFrontmatter — passes through input with no frontmatter (modulo leading whitespace)', () => {
	const input = '\n# Body\nText here';
	assert.equal(stripFrontmatter(input), '# Body\nText here');
});

test('stripFrontmatter — body containing internal --- lines is not over-stripped', () => {
	const input = '---\ntitle: X\n---\n\n# Body\nFirst section.\n\n---\n\n# Second section\nMore text';
	assert.equal(stripFrontmatter(input), '# Body\nFirst section.\n\n---\n\n# Second section\nMore text');
});

test('stripFrontmatter — trims leading whitespace after strip', () => {
	const input = '---\ntitle: X\n---\n\n\n   \n# Body';
	assert.equal(stripFrontmatter(input), '# Body');
});

test('stripFrontmatter — empty input', () => {
	assert.equal(stripFrontmatter(''), '');
});

// ─── Date Format ───────────────────────────────────────────────────────
test('formatDate — number input', () => {
	// 2025-05-03 12:00:00 UTC
	assert.equal(formatDate(1746273600), '03 May 2025');
});

test('formatDate — bigint input', () => {
	assert.equal(formatDate(1746273600n), '03 May 2025');
});

test('formatDate — single-digit day padded', () => {
	// 2025-01-01 00:00:00 UTC
	assert.equal(formatDate(1735689600), '01 Jan 2025');
});

test('formatDate — epoch zero', () => {
	assert.equal(formatDate(0), '01 Jan 1970');
});

test('formatDate — December (month index 11)', () => {
	// 2025-12-15 12:00:00 UTC
	assert.equal(formatDate(1765800000), '15 Dec 2025');
});

test('formatDate — UTC rendering at midnight-UTC boundary', () => {
	// 2025-05-04 00:00:00 UTC — in negative-UTC-offset timezones a local-time
	// renderer would print "03 May 2025" instead.
	assert.equal(formatDate(1746316800), '04 May 2025');
});
