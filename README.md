# Blockchain Certificate Verification (Runnable Local Version)

This is a repaired, runnable version of the original **Document Authentication in Educational Field using Blockchain Technology** project. It preserves the original idea: a university registers a certificate's file hash on a smart contract, stores the document (IPFS when configured), and verifies a submitted document by comparing its SHA-256 fingerprint with the blockchain record.

## What is included

- React + Vite frontend with issue, verify, records, and revoke screens.
- Solidity `StoreHash` smart contract.
- Hardhat local Ethereum development network and deployment script.
- Node/Express upload API.
- SHA-256 hashing in the upload API and browser verification.
- Optional Pinata IPFS upload. Without a Pinata JWT, files are stored locally so the project can still be demonstrated offline; the UI identifies this as local storage.
- Contract tests for issuing, verification, admin-only access, duplicate IDs, and revocation.

## Requirements

- Windows 10/11, macOS, or Linux
- Node.js 20 LTS or newer (Node 22 recommended)
- MetaMask browser extension

## Setup (Windows PowerShell)

1. Extract this ZIP to a simple folder, for example `C:\Projects\certificate-verification`.
2. Open that folder in VS Code. Open Terminal → New Terminal.
3. Install root dependencies:

   ```powershell
   npm install
   ```

4. Install frontend and backend dependencies:

   ```powershell
   cd client
   npm install
   cd ..\server
   npm install
   cd ..
   ```

5. Start the local blockchain in Terminal 1:

   ```powershell
   npm run chain
   ```

   Keep this terminal running. Hardhat prints several test accounts and private keys. These accounts are for local development only. Never use them on a real network or with real funds.

6. Deploy the contract in Terminal 2:

   ```powershell
   npm run deploy:local
   ```

   This writes the deployed contract address to `client/src/deployment.json`.

7. Configure MetaMask:
   - Add a network manually.
   - Network name: `Hardhat Local`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
   - Currency symbol: `ETH`
   - Import the FIRST private key printed by the local Hardhat node. This is the university admin account that deployed the contract.
   - This key is public test-only key material. Never use it outside the local Hardhat network.

8. Start the backend in Terminal 3:

   ```powershell
   npm run server
   ```

9. Start the frontend in Terminal 4:

   ```powershell
   npm run client
   ```

10. Open `http://localhost:5173`, click **Connect wallet**, and approve MetaMask. The imported first Hardhat account should show university admin access.

## Optional: enable real IPFS uploads with Pinata

By default, uploaded files are saved in `server/uploads` for local demonstration. To upload to IPFS:

1. Create a Pinata account and generate a JWT with permission to pin files.
2. Copy `server/.env.example` to `server/.env`.
3. Set `PINATA_JWT=your_pinata_jwt` in `server/.env`.
4. Restart the backend. The app will now upload the certificate to Pinata IPFS and record its CID on-chain.

Do not put the Pinata JWT in frontend code or commit your `.env` file.

## Run contract tests

With dependencies installed, run:

```powershell
npm run test:contract
```

## How to demonstrate

1. Connect the university admin wallet.
2. Open **Issue certificate**.
3. Enter a unique ID such as `CAM-ISE-2026-001` and select a PDF/image certificate.
4. Submit and confirm the MetaMask transaction.
5. Open **Verify certificate**, enter the same ID, and upload the exact same file. It should show **Authentic certificate**.
6. Try a different file with the same ID. Verification should fail.
7. In **Issued records**, the admin can revoke a certificate. A revoked certificate will no longer verify as authentic.

## Important notes

- This is a local academic prototype, not a production credential platform. Production deployment needs audited contracts, proper university identity/onboarding, secure access control, privacy review, backups, and a production IPFS pinning strategy.
- The local fallback stores documents on the machine running the API. It is not decentralized storage. Configure Pinata to demonstrate actual IPFS storage.
- The contract deployer is the university admin. Only that wallet can issue or revoke certificates. Anyone can verify a certificate.
- The contract stores the certificate ID, SHA-256 hash, IPFS CID/reference, issue timestamp, and revocation status. Do not store student personal details directly on a public blockchain.
- A certificate is verified only when the exact uploaded bytes match the registered SHA-256 hash and the certificate has not been revoked.

## Troubleshooting

- **MetaMask says wrong network:** select Hardhat Local (Chain ID 31337).
- **Contract not deployed:** start `npm run chain`, then run `npm run deploy:local` again.
- **Cannot connect to API:** ensure `npm run server` is running at port 5000.
- **Port already in use:** stop the other process using port 5000/5173/8545, then restart.
- **After restarting Hardhat node:** its blockchain state resets. Deploy again and reconnect MetaMask.
