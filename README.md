# Vattelum Document References Package

> A standard wire format and read interface for citing, resolving, and verifying
> documents and contracts across on-chain registries.

This repository contains the Vattelum Document References standard plus
two reference implementations — a Solidity package that any registry can
adopt to become citable, and a JavaScript / TypeScript package for
consumers.

The goal is to build a network of registries across any EVM-compatible
chain that together form a body of voluntary, private standards for
self-regulation and legal enforcement of smart contracts.

---

## Status

**`0.1.0-pre` — experimental.** Wire format and API may change after testing and
feedback. Do not depend on this in production. Stability is committed at `1.0.0`.

---

## Why this exists

Building decentralized law applications across multiple repos revealed that
one standard set of legal citations is needed.

Without a shared standard, every registry stores, renders, and computes
legal standards in a different format making the creation of an interoperable
blockchain-based decentralized legal system impossible.

To learn more about the overall concept of decentralized law and the Vattelum
ecosystem, visit the organization page at
[github.com/vattelum](https://github.com/vattelum).


---

## What's in this repo

```
solidity/   The on-chain half: structs, IDocumentRegistry interface,
            relation- and document-type constants, conformance test.
            Compile-time enforcement: declare `is IDocumentRegistry` and
            the compiler verifies the required reads exist.

js/         The off-chain half: pure-functional reference implementation
            of the deterministic algorithms — hashBody, formatCitation
            (with EIP-55 + UTC + section pointer), resolveStatus,
            toChecksumAddress.
```

Each package has its own `README.md` covering install and usage.

---

## The standard at a glance

This standard lets any blockchain-based registry of laws, rules, contracts,
or agreements become *citable* by anyone, anywhere. Registering laws on the blockchain
ensures a fully auditable overview of what laws were in force and when, even years later. 

A contract written today against a registry's documents establishes a body of law
that can be verified, resolved, and printed. Every citation carries everything
needed to independently confirm what was signed, when, and under which
version of which law. 

Within the Vattelum ecosystem, the standard is consumed by the
[Registry](https://github.com/vattelum/registry), the 
[Blockchain Voting System](https://github.com/vattelum/bvs),
the [Decentralized Autonomous Association](https://github.com/vattelum/daa),
and the [Smart Contract Block (SCB)](https://github.com/vattelum/scb).

Any external registry can implement `IDocumentRegistry` and join and expand the
network.

### On-chain reference

```solidity
struct DocumentReference {
    address registryAddress;
    uint256 chainId;
    uint256 categoryId;
    uint256 documentId;
    uint256 version;
    uint8   relationType;
    string  targetSection;
}
```

`(registryAddress, chainId, categoryId, documentId, version)` uniquely
addresses any document or contract on any EVM chain. `registryAddress` may
point at the same registry that holds the citing document (a *local*
reference) or at a different registry (a *cross-registry* reference); the
struct is neutral on both.

`targetSection` is an opaque string. Empty = whole-target reference.
Comma-separated = multi-target. Section identifier syntax is the document's
own convention. The cascade rule (a parent identifier covers child
identifiers, e.g. `"3"` covers `"3.1"`) is recommended for hierarchical
schemes; not required.

#### Convention for contract-record registries

Some registries store flat contract records rather than category/document/
version-organized documents. The convention for fitting them into the
standard is: set `categoryId = 0`, `documentId = 0`, and
`version = contractId`. This keeps the addressing tuple uniform across
registry kinds, so a third-party tool reading a citation does not need to
know whether the target is a document or a contract.

### Document struct and read interface

```solidity
struct Document {
    string  contentUri;
    bytes32 contentHash;
    string  title;
    uint256 version;
    uint256 timestamp;
    string  voteId;
    uint8   docType;
}

interface IDocumentRegistry {
    function getDocument(uint256 categoryId, uint256 documentId, uint256 version)
        external view returns (Document memory);
    function getReferences(uint256 categoryId, uint256 documentId, uint256 version)
        external view returns (DocumentReference[] memory);
    function getHistory(uint256 categoryId, uint256 documentId)
        external view returns (Document[] memory);
}
```

`contentUri` is a storage-agnostic pointer to the document body — typical
forms are `ar://<arweave-tx-id>`, `ipfs://<cid>`, or `https://...`.

An empty string is valid as well: a registry that does not store off-chain
content at all (hash-only registries) leaves it empty.

These three reads are the minimum any third-party tool needs to resolve a
citation pointing at the registry. Registries MAY expose additional
functions; conformance is satisfied by exposing at least these three with
the listed signatures.

### Relation types

| Value | Name       | Meaning                                                                                |
|-------|------------|----------------------------------------------------------------------------------------|
| 0     | AMENDS     | Citing document modifies sections of the referenced one                                |
| 1     | REVISES    | Citing document is a full replacement of the referenced one                            |
| 2     | REPEALS    | Citing document revokes the referenced one                                             |
| 3     | CODIFIES   | Citing document consolidates the referenced documents                                  |
| 4     | GOVERNS    | Referenced document governs the citing one                                             |
| 5     | IMPLEMENTS | Citing document adopts the referenced one as elective module                           |
| 6     | REFERENCES | Non-binding cross-reference                                                            |
| 7     | TEMPLATE   | Referenced document is the blueprint from which the citing enforceable contract was built |

### Document types

| Value | Name          | Meaning                                            |
|-------|---------------|----------------------------------------------------|
| 0     | Original      | New document                                       |
| 1     | Amendment     | Modifies specific sections of an existing document |
| 2     | Revision      | Full replacement of an existing document           |
| 3     | Repeal        | Revokes an existing document or sections thereof   |
| 4     | Codification  | Consolidates multiple documents into one           |

Documents of type 1, 2, 3, or 4 MUST include at least one
`DocumentReference` whose `relationType` matches the action
(Amendment ⟶ AMENDS; Revision ⟶ REVISES; Repeal ⟶ REPEALS;
Codification ⟶ CODIFIES) pointing to the affected document(s).

### Hash procedure — frozen forever

The content hash is the integrity anchor. Procedure:

1. **Input scope.** The document body, with leading and trailing whitespace
   stripped. Pre-processing (e.g. stripping YAML frontmatter or HTML comments)
   is the caller's responsibility. Once the body is determined, the hash is
   computed over exactly that string.
2. **Encoding.** UTF-8.
3. **Algorithm.** SHA-256.
4. **Output format.** Lower-case hexadecimal, 64 characters, no `0x` prefix.

The same-input-same-output property is the load-bearing interop guarantee.

The JS package ships `stripFrontmatter` as the canonical YAML-frontmatter strip
step — drop-in for callers that want a shared implementation rather than rolling
their own, removing the risk of two consumers diverging on the strip rule and
producing different hashes for the same logical body.

### Citation format

```
"[Title]", v[Version], [Category], [EIP-55 Address], [Network], ratified [DD Mon YYYY] UTC, hash: [hash], §[targetSection]
```

The "UTC" suffix is a documentation hint, not a time-of-day marker. Date
granularity is `DD Mon YYYY` only; the suffix tells the reader that the
date was computed by treating the on-chain timestamp as UTC, so a reader
in a different timezone won't disagree about which calendar day a
ratification fell on (matters at midnight-UTC edge cases).

Frozen rules:

1. **Date is rendered in UTC.** The on-chain `timestamp` is a timezone-less
   unix integer; UTC is the only rendering two implementations agree on.
2. **Address is normalized to EIP-55 mixed-case checksum form.** Two callers
   passing different cases of the same address produce byte-identical
   citation strings.
3. **Hash is emitted lowercase, no `0x` prefix.**
4. **Date format is `DD Mon YYYY`** with month as three letters
   (international unambiguity). Numeric forms (`05/04/2026`, `2026-05-04`)
   are non-conforming.
5. **Section pointer.** When `targetSection` is non-empty, the citation
   appends `, §<targetSection>`. Multi-target sections (comma-separated in
   `targetSection`) render as `, §3.1, §4` — each piece prefixed with `§`,
   joined by `, `.
6. **Truncation rule** (when displays require it): addresses use first 6 +
   last 4 hex chars; hashes use first 6 + last 2.

The JS package ships `formatDate(ts)` as a standalone helper that produces the
same `DD Mon YYYY` UTC form, for callers that need the date outside a full
citation (e.g. lifecycle timestamps in a verification appendix).

### Resolution protocol

A document's status is not stored — it is derived from the on-chain reference
graph. To resolve the status of `(categoryId, documentId, version)` on
registry `R`, from the perspective of observer time `T`:

1. Call `R.getHistory(categoryId, documentId)`. Filter to versions where
   `v.timestamp <= T`.
2. For each filtered version with `version > target.version`, call
   `R.getReferences(...)`.
3. If any returned reference matches the target by
   `(registryAddress, categoryId, documentId, version)`:
   - `relationType = 2` (REPEALS) → **Repealed**
   - `relationType = 1` (REVISES) → **Revised**
   - `relationType = 3` (CODIFIES) → **Codified**
   - `relationType = 0` (AMENDS) → **Amended**
4. Otherwise → **In Force**.

**Precedence (most restrictive wins):** Repealed > Revised > Codified >
Amended > In Force.

**Address matching is case-insensitive.** Registries can be cited in any
case form (lowercase, uppercase, EIP-55) and resolution returns the same
status.

`T` is a parameter, not a property of the registry. The same on-chain state
answers different resolver calls differently:
- For a **signed contract**: `T = contract.createdAt`.
- For **current-state browsing**: `T = type(uint256).max`.
- For a **dispute as of moment X**: `T = X`.

---

## Installation

**Solidity** — `forge install vattelum/document-registry`
See [`solidity/README.md`](solidity/README.md) for remapping and usage.

**JavaScript / TypeScript** — `npm install @vattelum/document-registry-js`
See [`js/README.md`](js/README.md) for usage.

---

## Conformance

A registry that declares `is IDocumentRegistry` is compile-time-checked
for shape. To certify a deployed registry from outside,
`solidity/test/Conformance.t.sol` asserts every required read exists and
returns the right shape — set `REGISTRY=0x...` in the environment to test
a deployed registry, or omit to test the included stub.

---

## Versioning and forward-compatibility

This standard evolves under strict forward-compatibility rules:

> An implementation conforming to this version MUST NOT break when it
> encounters data created under a future version. It may not understand new
> fields or new type values, but it parses what it knows and tolerates the
> rest.

Concrete rules:

- **Structs** are append-only. New fields go at the end. Existing fields
  are never reordered, removed, or repurposed.
- **Interface** is additive-only. New required functions may be added;
  existing signatures are never removed or modified.
- **Relation types** — values 0–7 frozen, values 8–255 reserved. Future
  versions may define new values; readers MUST tolerate unknown values.
- **Document types** — values 0–4 frozen, values 5–255 reserved.
- **Hash procedure** — frozen forever. Any new hash ships as a separate
  opt-in primitive.
- **Citation string** — positions 1–7 frozen, positions 8+ extension zone.

**Semver.** Minor version bumps for additive changes. Breaking changes are
out of scope for this standard — they would constitute a new standard
altogether (the ERC-721 → ERC-1155 pattern), with a new identifier.

---

## License

MIT. See `LICENSE`.

---

## Contributing

Bug reports, conformance questions, and EIP-track design feedback welcome
via GitHub Issues. PRs are accepted for: bug fixes, test additions, doc
clarifications. PRs that change the wire format, the citation string, the
hash procedure, or the resolution algorithm will be declined during the
`0.x` series — those surfaces stabilise at `1.0.0` and changes thereafter
go through an EIP-track process.
