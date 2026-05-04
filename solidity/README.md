# @vattelum/document-registry

Solidity wire format and read interface for the
[Vattelum Document References standard](https://github.com/vattelum/document-registry).

## Install

```sh
forge install vattelum/document-registry
```

Then in `foundry.toml`:

```toml
remappings = [
    "@vattelum/document-registry/=lib/document-registry/solidity/src/"
]
```

Alternative (npm + manual remapping):

```sh
npm install @vattelum/document-registry
```

## Use

```solidity
pragma solidity ^0.8.29;

import {
    IDocumentRegistry,
    Document,
    DocumentReference,
    RELATION_GOVERNS,
    DOC_TYPE_ORIGINAL
} from "@vattelum/document-registry/DocumentRegistry.sol";

contract MyRegistry is IDocumentRegistry {
    function getDocument(uint256 c, uint256 d, uint256 v)
        external view returns (Document memory) { /* ... */ }

    function getReferences(uint256 c, uint256 d, uint256 v)
        external view returns (DocumentReference[] memory) { /* ... */ }

    function getHistory(uint256 c, uint256 d)
        external view returns (Document[] memory) { /* ... */ }
}
```

The compiler refuses to compile if any required read is missing or its
signature is wrong — that is the first conformance gate.

## Conformance test

`test/Conformance.t.sol` ships with the package. Run it against any deployed
registry to certify shape conformance.

## Standard

Full normative reference: see the [repository root README](../README.md).

## License

MIT.
