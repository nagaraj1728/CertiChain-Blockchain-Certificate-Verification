import deployment from './deployment.json';

export const CONTRACT_ADDRESS = deployment.contractAddress;
export const ABI = [
  'function universityAdmin() view returns (address)',
  'function issueCertificate(string certificateId,string documentHash,string ipfsCid)',
  'function verifyDocument(string certificateId,string hashToVerify) view returns (bool)',
  'function getCertificate(string certificateId) view returns (string documentHash,string ipfsCid,uint256 issuedAt,bool revoked,bool registered)',
  'function revokeCertificate(string certificateId)',
  'event CertificateIssued(string indexed certificateId,string documentHash,string ipfsCid,uint256 issuedAt)',
  'event CertificateRevoked(string indexed certificateId,uint256 revokedAt)'
];
