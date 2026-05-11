# @vattelum/document-registry-js

Reference implementation of the
[Vattelum Document References standard](https://github.com/vattelum/document-registry)
in JavaScript / TypeScript. Pure functions, no I/O, no framework, no RPC
client. Caller fetches on-chain data and passes typed values in.

Node ≥18. Type declarations included.

## Install

```sh
npm install @vattelum/document-registry-js
```

## Use

```ts
import {
    hashBody,
    formatCitation,
    resolveStatus,
    toChecksumAddress,
    RELATION_GOVERNS,
    DOC_TYPE_ORIGINAL,
    type Document,
    type DocumentReference
} from '@vattelum/document-registry-js';

// Verify a document body matches its on-chain hash.
const expected = doc.contentHash.toLowerCase().replace(/^0x/, '');
const actual = await hashBody(body);
if (actual !== expected) throw new Error('Content hash mismatch');

// Render a citation. Caller supplies the human-readable names because the
// registry stores ids, not strings.
const citation = formatCitation(ref, doc, {
    categoryName: 'Constitution',
    networkName: 'Sepolia'
});

// Resolve current status. Caller pre-fetches history and references.
const status = resolveStatus(target, history, referencesByVersion, asOf);
//   'In Force' | 'Amended' | 'Revised' | 'Repealed' | 'Codified'
```

## Exports

| Export                | Purpose                                                                |
|-----------------------|------------------------------------------------------------------------|
| `hashBody`            | SHA-256 of trimmed UTF-8 body. Frozen forever — every conforming impl produces the same digest. |
| `stripFrontmatter`    | Strip the leading YAML frontmatter block (`---` … `---`) and leading whitespace from a markdown body. Cross-platform line endings. Feeds `hashBody` on the canonical content-hash chain. |
| `formatCitation`      | Canonical printed citation. UTC date, EIP-55 address, optional `§<targetSection>`. |
| `formatDate`          | Format a Unix timestamp (seconds, number or bigint) as `"DD Mon YYYY"` in **UTC** — same date form `formatCitation` emits, available standalone for callers that need the date outside a full citation. |
| `resolveStatus`       | Status from on-chain reference graph at observer time `asOf`.          |
| `toChecksumAddress`   | EIP-55 mixed-case checksum (used by `formatCitation`; exported for callers that need it directly). |
| `DocumentReference`, `Document` | Type aliases mirroring the Solidity structs.                |
| `RELATION_*`          | Relation-type constants (0–7).                                         |
| `DOC_TYPE_*`          | Document-type constants (0–4).                                         |

## Dependencies

`@noble/hashes` (~14 KB) for keccak-256, used by EIP-55. No other runtime
dependencies.

## Standard

Full normative reference: see the [repository root README](../README.md).

## License

MIT.
