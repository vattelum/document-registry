// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

// Vattelum Document Registry — wire format and read interface for citing,
// resolving, and verifying documents and contracts across on-chain registries.
// A contract declares `is IDocumentRegistry` and the compiler enforces shape.

// ─── Document — the on-chain record per document version ───────────────
// One Document per (categoryId, documentId, version) tuple. `contentUri`
// is a storage-agnostic pointer (`ar://...`, `ipfs://...`, `https://...`,
// or empty for hash-only registries). `contentHash` is the integrity
// anchor — SHA-256 of the trimmed UTF-8 body, frozen forever.
// Append-only: future versions may add fields at the end, never reorder.
struct Document {
    string  contentUri;
    bytes32 contentHash;
    string  title;
    uint256 version;
    uint256 timestamp;
    string  voteId;
    uint8   docType;
}

// ─── Document Types — what kind of version this document is ────────────
// Drives status resolution and reference requirements (an Amendment must
// cite at least one AMENDS reference; a Revision a REVISES; etc.).
// Values 5–255 reserved for future versions; readers must tolerate
// unknown values without rejecting them.
uint8 constant DOC_TYPE_ORIGINAL     = 0; // New document
uint8 constant DOC_TYPE_AMENDMENT    = 1; // Modifies sections of an existing document
uint8 constant DOC_TYPE_REVISION     = 2; // Full replacement of an existing document
uint8 constant DOC_TYPE_REPEAL       = 3; // Revokes an existing document or sections
uint8 constant DOC_TYPE_CODIFICATION = 4; // Consolidates multiple documents into one

// ─── DocumentReference — how a document points at another document ─────
// The machine-readable citation that turns Vattelum into an interoperable
// legal system. (registryAddress, chainId, categoryId,
// documentId, version) uniquely addresses any target on any EVM chain.
// `registryAddress` may point at this same registry (local reference) or
// another one (cross-registry reference); the struct is neutral on both.
// `targetSection` is opaque (empty = whole-target, comma-separated =
// multi-target). Append-only.
struct DocumentReference {
    address registryAddress;
    uint256 chainId;
    uint256 categoryId;
    uint256 documentId;
    uint256 version;
    uint8   relationType;
    string  targetSection;
}

// ─── Relation Types — the meaning of a reference between documents ─────
// What kind of relationship one document has to another. Determines
// status resolution (a REPEALS reference revokes the target; an AMENDS
// reference modifies it) and informs which version of which document is
// currently authoritative for any given citation.
// Values 0–7 frozen. Values 8–255 reserved. Readers must tolerate
// unknown values; they may treat unknowns as REFERENCES (informational).
uint8 constant RELATION_AMENDS     = 0; // Citing document modifies the target
uint8 constant RELATION_REVISES    = 1; // Citing document is a full replacement
uint8 constant RELATION_REPEALS    = 2; // Citing document revokes the target
uint8 constant RELATION_CODIFIES   = 3; // Citing document consolidates targets
uint8 constant RELATION_GOVERNS    = 4; // Binding — target governs the citing document
uint8 constant RELATION_IMPLEMENTS = 5; // Citing document adopts target as elective module
uint8 constant RELATION_REFERENCES = 6; // Informational — non-binding cross-reference
uint8 constant RELATION_TEMPLATE   = 7; // Provenance — citing document was instantiated from the target

// ─── Read Interface — how one reads any conforming registry ───────────
// The minimum set of read functions any conforming registry must expose.
// A contract that declares `is IDocumentRegistry` will not compile if
// any of these is missing or has the wrong signature — that is the first
// conformance gate. Registries may add functions; they must not remove
// or modify these. Additive-only.
interface IDocumentRegistry {
    function getDocument(uint256 categoryId, uint256 documentId, uint256 version)
        external view returns (Document memory);

    function getReferences(uint256 categoryId, uint256 documentId, uint256 version)
        external view returns (DocumentReference[] memory);

    function getHistory(uint256 categoryId, uint256 documentId)
        external view returns (Document[] memory);
}
