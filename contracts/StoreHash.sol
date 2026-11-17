// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title StoreHash - educational certificate registration and verification
/// @notice The university/contract deployer is the only account allowed to issue or revoke certificates.
contract StoreHash {
    address public immutable universityAdmin;

    struct Certificate {
        string documentHash; // SHA-256 hash of the original certificate file
        string ipfsCid;      // IPFS CID, or a local-storage reference during offline development
        uint256 issuedAt;
        bool revoked;
    }

    mapping(string => Certificate) private certificates;
    mapping(string => bool) private exists;

    event CertificateIssued(string indexed certificateId, string documentHash, string ipfsCid, uint256 issuedAt);
    event CertificateRevoked(string indexed certificateId, uint256 revokedAt);

    modifier onlyAdmin() {
        require(msg.sender == universityAdmin, "Only university admin");
        _;
    }

    constructor() {
        universityAdmin = msg.sender;
    }

    function issueCertificate(string calldata certificateId, string calldata documentHash, string calldata ipfsCid) external onlyAdmin {
        require(bytes(certificateId).length > 0, "Certificate ID required");
        require(bytes(documentHash).length == 64, "Invalid SHA-256 hash");
        require(!exists[certificateId], "Certificate ID already exists");
        certificates[certificateId] = Certificate(documentHash, ipfsCid, block.timestamp, false);
        exists[certificateId] = true;
        emit CertificateIssued(certificateId, documentHash, ipfsCid, block.timestamp);
    }

    function verifyDocument(string calldata certificateId, string calldata hashToVerify) external view returns (bool) {
        Certificate storage cert = certificates[certificateId];
        return exists[certificateId] && !cert.revoked && keccak256(bytes(cert.documentHash)) == keccak256(bytes(hashToVerify));
    }

    function getCertificate(string calldata certificateId) external view returns (string memory documentHash, string memory ipfsCid, uint256 issuedAt, bool revoked, bool registered) {
        Certificate storage cert = certificates[certificateId];
        return (cert.documentHash, cert.ipfsCid, cert.issuedAt, cert.revoked, exists[certificateId]);
    }

    function revokeCertificate(string calldata certificateId) external onlyAdmin {
        require(exists[certificateId], "Certificate not found");
        require(!certificates[certificateId].revoked, "Already revoked");
        certificates[certificateId].revoked = true;
        emit CertificateRevoked(certificateId, block.timestamp);
    }
}
