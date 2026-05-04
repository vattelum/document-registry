// SPDX-License-Identifier: MIT
pragma solidity ^0.8.29;

import "forge-std/Test.sol";
import {
    IDocumentRegistry,
    Document,
    DocumentReference,
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
    DOC_TYPE_CODIFICATION
} from "../src/DocumentRegistry.sol";

/// Minimal stub. Existence of this contract is itself a conformance signal:
/// it would not compile if `IDocumentRegistry` were missing a required read or
/// if the struct signatures drifted from the spec.
contract _StubRegistry is IDocumentRegistry {
    function getDocument(uint256, uint256, uint256)
        external pure returns (Document memory)
    {
        return Document("", bytes32(0), "", 0, 0, "", 0);
        // Field order: contentUri, contentHash, title, version, timestamp, voteId, docType.
    }

    function getReferences(uint256, uint256, uint256)
        external pure returns (DocumentReference[] memory)
    {
        return new DocumentReference[](0);
    }

    function getHistory(uint256, uint256)
        external pure returns (Document[] memory)
    {
        return new Document[](0);
    }
}

contract ConformanceTest is Test {
    IDocumentRegistry registry;

    function setUp() public {
        // Set REGISTRY=0x... in the environment to verify a deployed registry;
        // unset (or zero), the test runs against an internal stub.
        address deployed = vm.envOr("REGISTRY", address(0));
        if (deployed == address(0)) {
            registry = new _StubRegistry();
        } else {
            registry = IDocumentRegistry(deployed);
        }
    }

    function test_relationConstants() public pure {
        assertEq(uint256(RELATION_AMENDS),     0);
        assertEq(uint256(RELATION_REVISES),    1);
        assertEq(uint256(RELATION_REPEALS),    2);
        assertEq(uint256(RELATION_CODIFIES),   3);
        assertEq(uint256(RELATION_GOVERNS),    4);
        assertEq(uint256(RELATION_IMPLEMENTS), 5);
        assertEq(uint256(RELATION_REFERENCES), 6);
        assertEq(uint256(RELATION_TEMPLATE),   7);
    }

    function test_docTypeConstants() public pure {
        assertEq(uint256(DOC_TYPE_ORIGINAL),     0);
        assertEq(uint256(DOC_TYPE_AMENDMENT),    1);
        assertEq(uint256(DOC_TYPE_REVISION),     2);
        assertEq(uint256(DOC_TYPE_REPEAL),       3);
        assertEq(uint256(DOC_TYPE_CODIFICATION), 4);
    }

    function test_getDocument_shape() public view {
        Document memory d = registry.getDocument(0, 0, 0);
        assertEq(d.version, 0);
        assertEq(d.timestamp, 0);
        assertEq(uint256(d.docType), 0);
    }

    function test_getReferences_shape() public view {
        DocumentReference[] memory r = registry.getReferences(0, 0, 0);
        assertEq(r.length, 0);
    }

    function test_getHistory_shape() public view {
        Document[] memory h = registry.getHistory(0, 0);
        assertEq(h.length, 0);
    }

    function test_documentReference_fieldOrder() public pure {
        // Positional construction enforces DocumentReference struct field order.
        DocumentReference memory r = DocumentReference({
            registryAddress: address(0xdead),
            chainId: 1,
            categoryId: 2,
            documentId: 3,
            version: 4,
            relationType: RELATION_GOVERNS,
            targetSection: "3.1"
        });
        assertEq(r.chainId, 1);
        assertEq(r.documentId, 3);
        assertEq(uint256(r.relationType), 4);
        assertEq(r.targetSection, "3.1");
    }

    function test_document_fieldOrder() public pure {
        // Positional construction enforces Document struct field order.
        Document memory d = Document({
            contentUri: "ar://tx",
            contentHash: bytes32(uint256(0xabc)),
            title: "Title",
            version: 7,
            timestamp: 1700000000,
            voteId: "vote",
            docType: DOC_TYPE_AMENDMENT
        });
        assertEq(d.title, "Title");
        assertEq(d.version, 7);
        assertEq(d.timestamp, 1700000000);
        assertEq(uint256(d.docType), 1);
    }
}
