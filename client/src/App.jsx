
import React, { useEffect, useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';

import {
  ShieldCheck,
  GraduationCap,
  FileCheck2,
  UploadCloud,
  Search,
  Wallet,
  Link2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  LockKeyhole,
  Ban
} from 'lucide-react';

import { ABI, CONTRACT_ADDRESS } from './contract';

const API = 'http://localhost:5000/api';
const REQUIRED_CHAIN_ID = 31337;

const short = (value) =>
  value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Not connected';

export default function App() {
  const [account, setAccount] = useState('');
  const [contract, setContract] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [networkReady, setNetworkReady] = useState(false);

  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [apiHealth, setApiHealth] = useState(null);

  const [tab, setTab] = useState('issue');

  const [issueId, setIssueId] = useState('');
  const [file, setFile] = useState(null);

  const [verifyId, setVerifyId] = useState('');
  const [verifyFile, setVerifyFile] = useState(null);

  const [result, setResult] = useState(null);
  const [records, setRecords] = useState([]);

  // Check backend API
  useEffect(() => {
    fetch(`${API}/health`)
      .then(response => {
        if (!response.ok) throw new Error('API unavailable');
        return response.json();
      })
      .then(setApiHealth)
      .catch(() => setApiHealth({ ok: false }));
  }, []);

  // Load blockchain certificate records
  const loadRecords = async (instance = contract) => {
    if (!instance) return;

    try {
      const events = await instance.queryFilter(
        instance.filters.CertificateIssued(),
        0,
        'latest'
      );

      const rows = await Promise.all(
        events.map(async event => {
          const id = event.args.certificateId;
          const data = await instance.getCertificate(id);

          return {
            id: String(id),
            hash: data.documentHash,
            cid: data.ipfsCid,
            issuedAt: Number(data.issuedAt),
            revoked: data.revoked,
            registered: data.registered
          };
        })
      );

      setRecords(rows.reverse());

    } catch (error) {
      console.error('Record loading error:', error);
      setStatus(
        'Could not load blockchain records: ' +
        (error.shortMessage || error.message)
      );
    }
  };

  // Connect MetaMask
  const connect = async () => {
    if (connecting) return;

    setConnecting(true);
    setStatus('');
    setResult(null);

    try {
      if (!window.ethereum) {
        throw new Error(
          'MetaMask not detected. Please install and unlock MetaMask.'
        );
      }

      if (!CONTRACT_ADDRESS) {
        throw new Error(
          'Contract address missing. Deploy your smart contract first.'
        );
      }

      const provider = new BrowserProvider(window.ethereum);

      // Request MetaMask permission
      const accounts = await provider.send(
        'eth_requestAccounts',
        []
      );

      if (!accounts || accounts.length === 0) {
        throw new Error('No wallet account selected.');
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Show the account as soon as MetaMask authorizes it
      setAccount(address);

      // Check selected blockchain
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      if (chainId !== REQUIRED_CHAIN_ID) {
        setNetworkReady(false);
        setContract(null);
        setIsAdmin(false);

        throw new Error(
          `Wrong network. Select Hardhat Local. Expected Chain ID 31337, received ${chainId}.`
        );
      }

      // Connect smart contract
      const instance = new Contract(
        CONTRACT_ADDRESS,
        ABI,
        signer
      );

      setContract(instance);
      setNetworkReady(true);

      // Check university administrator
      try {
        const adminAddress = await instance.universityAdmin();

        const adminAccess =
          address.toLowerCase() === adminAddress.toLowerCase();

        setIsAdmin(adminAccess);

        setStatus(
          adminAccess
            ? 'Wallet connected! University administrator access granted.'
            : 'Wallet connected! Student / verifier access granted.'
        );

        await loadRecords(instance);

      } catch (error) {
        console.error('Contract access error:', error);

        setIsAdmin(false);

        setStatus(
          'Wallet connected, but smart contract access failed: ' +
          (error.shortMessage || error.message)
        );
      }

    } catch (error) {
      console.error('Wallet connection error:', error);

      setStatus(
        error.shortMessage ||
        error.message ||
        'Unable to connect MetaMask.'
      );

    } finally {
      setConnecting(false);
    }
  };

  // Listen for MetaMask account and network changes
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = () => {
      setAccount('');
      setContract(null);
      setIsAdmin(false);
      setNetworkReady(false);
      setRecords([]);
      setStatus('Wallet account changed. Please reconnect.');
    };

    const handleChainChanged = () => {
      setAccount('');
      setContract(null);
      setIsAdmin(false);
      setNetworkReady(false);
      setRecords([]);
      setStatus('Network changed. Please reconnect to Hardhat Local.');
    };

    window.ethereum.on?.('accountsChanged', handleAccountsChanged);
    window.ethereum.on?.('chainChanged', handleChainChanged);

    return () => {
      window.ethereum.removeListener?.(
        'accountsChanged',
        handleAccountsChanged
      );

      window.ethereum.removeListener?.(
        'chainChanged',
        handleChainChanged
      );
    };
  }, []);

  // Issue a new certificate
  const issue = async (event) => {
    event.preventDefault();
    setResult(null);

    if (!contract || !networkReady) {
      return setStatus('Connect MetaMask to Hardhat Local first.');
    }

    if (!isAdmin) {
      return setStatus(
        'Only the university administrator can issue certificates.'
      );
    }

    if (!issueId.trim() || !file) {
      return setStatus('Enter a certificate ID and select a document.');
    }

    if (file.size > 10 * 1024 * 1024) {
      return setStatus('File size must not exceed 10 MB.');
    }

    setBusy(true);

    try {
      setStatus('Uploading certificate and calculating SHA-256...');

      const body = new FormData();
      body.append('certificate', file);

      const response = await fetch(`${API}/upload`, {
        method: 'POST',
        body
      });

      const uploaded = await response.json();

      if (!response.ok) {
        throw new Error(
          uploaded.error || 'Certificate upload failed.'
        );
      }

      if (!uploaded.documentHash) {
        throw new Error('Backend did not return a document hash.');
      }

      setStatus('Waiting for blockchain confirmation...');

      const tx = await contract.issueCertificate(
        issueId.trim(),
        uploaded.documentHash,
        uploaded.ipfsCid || ''
      );

      setStatus('Transaction submitted. Confirming...');

      await tx.wait();

      setResult({
        ok: true,
        title: 'Certificate issued successfully!',
        detail: `Transaction: ${tx.hash}`,
        hash: uploaded.documentHash,
        cid: uploaded.ipfsCid,
        mode: uploaded.storageMode
      });

      setIssueId('');
      setFile(null);
      event.target.reset();

      await loadRecords(contract);

      setStatus('Certificate successfully recorded on blockchain.');

    } catch (error) {
      console.error(error);

      setStatus(
        error.shortMessage ||
        error.reason ||
        error.message ||
        'Certificate issuance failed.'
      );

    } finally {
      setBusy(false);
    }
  };

  // Verify a certificate using SHA-256
  const verify = async (event) => {
    event.preventDefault();
    setResult(null);

    if (!contract || !networkReady) {
      return setStatus('Connect MetaMask to Hardhat Local first.');
    }

    if (!verifyId.trim() || !verifyFile) {
      return setStatus(
        'Enter the certificate ID and select the certificate file.'
      );
    }

    setBusy(true);

    try {
      setStatus('Calculating SHA-256 and checking blockchain...');

      const buffer = await verifyFile.arrayBuffer();

      const digest = await crypto.subtle.digest(
        'SHA-256',
        buffer
      );

      const hash = [...new Uint8Array(digest)]
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');

      const valid = await contract.verifyDocument(
        verifyId.trim(),
        hash
      );

      const data = await contract.getCertificate(
        verifyId.trim()
      );

      const detail = valid
        ? 'The document hash matches the blockchain record.'
        : !data.registered
          ? 'No certificate with this ID is registered.'
          : data.revoked
            ? 'This certificate has been revoked.'
            : 'The uploaded file does not match the original certificate.';

      setResult({
        ok: valid,
        title: valid
          ? 'Authentic certificate'
          : 'Certificate not verified',
        detail,
        hash
      });

      setStatus(
        valid
          ? 'Verification completed successfully.'
          : 'Certificate verification failed.'
      );

    } catch (error) {
      console.error(error);

      setStatus(
        error.shortMessage ||
        error.reason ||
        error.message ||
        'Verification failed.'
      );

    } finally {
      setBusy(false);
    }
  };

  // Revoke a certificate
  const revoke = async (id) => {
    if (!contract || !isAdmin) {
      return setStatus('University administrator access required.');
    }

    const confirmed = window.confirm(
      `Are you sure you want to revoke certificate ${id}?`
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      setStatus('Submitting revocation transaction...');

      const tx = await contract.revokeCertificate(id);

      await tx.wait();

      setStatus(`Certificate ${id} successfully revoked.`);

      await loadRecords(contract);

    } catch (error) {
      console.error(error);

      setStatus(
        error.shortMessage ||
        error.reason ||
        error.message ||
        'Certificate revocation failed.'
      );

    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-shell">

      {/* HEADER */}
      <header className="topbar">

        <div className="brand">
          <div className="brand-mark">
            <ShieldCheck size={22} />
          </div>

          <div>
            <strong>CertiChain</strong>
            <span>EDUCATIONAL CREDENTIALS</span>
          </div>
        </div>

        <div className="top-actions">

          <div className={`network-pill ${networkReady ? 'online' : ''}`}>
            <span />
            {networkReady ? 'Hardhat Connected' : 'Hardhat Local'}
          </div>

          <button
            className="wallet-btn"
            onClick={connect}
            disabled={connecting}
          >
            <Wallet size={16} />
            {connecting
              ? 'Connecting...'
              : account
                ? short(account)
                : 'Connect wallet'}
          </button>

        </div>
      </header>

      <main className="container">

        {/* HERO */}
        <section className="hero">

          <div className="hero-copy">

            <div className="eyebrow">
              <span />
              BLOCKCHAIN-POWERED AUTHENTICATION
            </div>

            <h1>
              Trust every
              <br />
              <em>certificate.</em>
            </h1>

            <p>
              A transparent way to issue, store and verify academic
              credentials. Certificate fingerprints are secured on
              the blockchain.
            </p>

            <div className="hero-points">
              <span>
                <LockKeyhole size={15} />
                Tamper-evident
              </span>

              <span>
                <Link2 size={15} />
                Decentralized record
              </span>
            </div>

          </div>

          <div className="hero-art">

            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />

            <div className="certificate-card">

              <div className="cert-top">
                <GraduationCap size={25} />
                <span>ACADEMIC RECORD</span>
              </div>

              <div className="seal">
                <ShieldCheck size={42} />
              </div>

              <div className="fake-line wide" />
              <div className="fake-line" />

              <div className="cert-bottom">
                <span>VERIFIED DOCUMENT</span>
                <CheckCircle2 size={19} />
              </div>

            </div>

            <div className="floating-check">
              <CheckCircle2 size={20} />

              <div>
                <b>Secure record</b>
                <small>Blockchain verified</small>
              </div>
            </div>

          </div>
        </section>

        {/* STATUS */}
        <section className="status-strip">

          <div className="status-item">
            <span className="status-icon">
              <Link2 size={18} />
            </span>

            <div>
              <small>SMART CONTRACT</small>
              <b>
                {CONTRACT_ADDRESS
                  ? short(CONTRACT_ADDRESS)
                  : 'Not deployed'}
              </b>
            </div>
          </div>

          <div className="status-item">
            <span className="status-icon">
              <UploadCloud size={18} />
            </span>

            <div>
              <small>FILE STORAGE</small>
              <b>
                {apiHealth?.ipfsEnabled
                  ? 'IPFS via Pinata'
                  : apiHealth?.ok
                    ? 'Local development storage'
                    : 'API offline'}
              </b>
            </div>
          </div>

          <div className="status-item">
            <span className="status-icon">
              <ShieldCheck size={18} />
            </span>

            <div>
              <small>WALLET STATUS</small>
              <b>{account ? short(account) : 'Not connected'}</b>
            </div>
          </div>

        </section>

        {/* WORKSPACE */}
        <section className="workspace">

          <div className="section-heading">

            <div>
              <div className="eyebrow dark">
                CERTIFICATE WORKSPACE
              </div>

              <h2>Manage credentials</h2>
            </div>

            <button
              className="refresh-btn"
              onClick={() => loadRecords()}
              disabled={!contract || busy}
            >
              <RefreshCw size={15} />
              Refresh records
            </button>

          </div>

          {/* TABS */}
          <div className="tabs">

            <button
              className={tab === 'issue' ? 'active' : ''}
              onClick={() => {
                setTab('issue');
                setResult(null);
              }}
            >
              <UploadCloud size={17} />
              Issue certificate
            </button>

            <button
              className={tab === 'verify' ? 'active' : ''}
              onClick={() => {
                setTab('verify');
                setResult(null);
              }}
            >
              <Search size={17} />
              Verify certificate
            </button>

            <button
              className={tab === 'records' ? 'active' : ''}
              onClick={() => {
                setTab('records');
                setResult(null);
              }}
            >
              <FileCheck2 size={17} />
              Issued records
              <span className="count">{records.length}</span>
            </button>

          </div>

          <div className="panel">

            {/* ISSUE CERTIFICATE */}
            {tab === 'issue' && (

              <form onSubmit={issue} className="form-layout">

                <div className="panel-intro">

                  <div className="panel-icon">
                    <GraduationCap size={21} />
                  </div>

                  <div>
                    <h3>Register a new certificate</h3>
                    <p>
                      Only the university admin wallet can issue a certificate.
                    </p>
                  </div>

                </div>

                <label>
                  Certificate ID

                  <input
                    value={issueId}
                    onChange={e => setIssueId(e.target.value)}
                    placeholder="e.g. CAMBRIDGE-ISE-2026-001"
                    required
                  />
                </label>

                <label>
                  Certificate document

                  <div className="file-drop">

                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={e =>
                        setFile(e.target.files?.[0] || null)
                      }
                    />

                    <UploadCloud size={24} />

                    <b>
                      {file
                        ? file.name
                        : 'Choose a certificate file'}
                    </b>

                    <small>
                      {file
                        ? `${(file.size / 1024).toFixed(1)} KB`
                        : 'PDF or image · Maximum 10 MB'}
                    </small>

                  </div>
                </label>

                <button
                  className="primary-btn"
                  disabled={busy || !isAdmin || !networkReady}
                >
                  <LockKeyhole size={16} />
                  {busy
                    ? 'Processing...'
                    : 'Issue certificate on blockchain'}
                </button>

                {!isAdmin && (
                  <p className="hint">
                    <AlertCircle size={15} />
                    Connect using the university admin account that deployed
                    the smart contract.
                  </p>
                )}

              </form>
            )}

            {/* VERIFY CERTIFICATE */}
            {tab === 'verify' && (

              <form onSubmit={verify} className="form-layout">

                <div className="panel-intro">

                  <div className="panel-icon">
                    <Search size={21} />
                  </div>

                  <div>
                    <h3>Verify certificate authenticity</h3>

                    <p>
                      Upload the original document to compare its SHA-256
                      fingerprint with the blockchain record.
                    </p>
                  </div>

                </div>

                <label>
                  Certificate ID

                  <input
                    value={verifyId}
                    onChange={e => setVerifyId(e.target.value)}
                    placeholder="Enter the certificate ID"
                    required
                  />
                </label>

                <label>
                  Certificate document

                  <div className="file-drop">

                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      onChange={e =>
                        setVerifyFile(e.target.files?.[0] || null)
                      }
                    />

                    <UploadCloud size={24} />

                    <b>
                      {verifyFile
                        ? verifyFile.name
                        : 'Choose the certificate to verify'}
                    </b>

                    <small>
                      {verifyFile
                        ? `${(verifyFile.size / 1024).toFixed(1)} KB`
                        : 'Use the exact original file issued by the university'}
                    </small>

                  </div>
                </label>

                <button
                  className="primary-btn"
                  disabled={busy || !contract || !networkReady}
                >
                  <Search size={16} />
                  {busy ? 'Verifying...' : 'Verify certificate'}
                </button>

              </form>
            )}

            {/* CERTIFICATE RECORDS */}
            {tab === 'records' && (

              <div className="records">

                <div className="panel-intro">

                  <div className="panel-icon">
                    <FileCheck2 size={21} />
                  </div>

                  <div>
                    <h3>Registered certificates</h3>

                    <p>
                      Records read from the deployed smart contract.
                    </p>
                  </div>

                </div>

                {records.length === 0 ? (

                  <div className="empty">
                    <FileCheck2 size={28} />
                    <b>No records loaded</b>

                    <span>
                      Connect your wallet and refresh to view issued certificates.
                    </span>
                  </div>

                ) : (

                  <div className="table-wrap">

                    <table>

                      <thead>
                        <tr>
                          <th>CERTIFICATE ID</th>
                          <th>ISSUED</th>
                          <th>STATUS</th>
                          <th>ACTION</th>
                        </tr>
                      </thead>

                      <tbody>

                        {records.map(record => (

                          <tr key={record.id}>

                            <td>
                              <b>{record.id}</b>
                              <small>
                                {record.hash.slice(0, 16)}...
                              </small>
                            </td>

                            <td>
                              {record.issuedAt
                                ? new Date(
                                    record.issuedAt * 1000
                                  ).toLocaleDateString()
                                : '—'}
                            </td>

                            <td>
                              <span
                                className={`badge ${
                                  record.revoked ? 'revoked' : 'valid'
                                }`}
                              >
                                {record.revoked ? 'Revoked' : 'Active'}
                              </span>
                            </td>

                            <td>
                              {isAdmin && !record.revoked ? (

                                <button
                                  className="revoke-btn"
                                  onClick={() => revoke(record.id)}
                                  disabled={busy}
                                >
                                  <Ban size={14} />
                                  Revoke
                                </button>

                              ) : '—'}
                            </td>

                          </tr>

                        ))}

                      </tbody>

                    </table>

                  </div>

                )}

              </div>
            )}

            {/* RESULT */}
            {result && (

              <div
                className={`result-card ${
                  result.ok ? 'success' : 'failure'
                }`}
              >

                <div className="result-symbol">
                  {result.ok
                    ? <CheckCircle2 size={24} />
                    : <XCircle size={24} />}
                </div>

                <div className="result-content">

                  <b>{result.title}</b>
                  <span>{result.detail}</span>

                  {result.hash && (
                    <small>SHA-256: {result.hash}</small>
                  )}

                  {result.cid && (
                    <small>
                      Storage: {result.mode === 'ipfs'
                        ? `IPFS CID ${result.cid}`
                        : 'Local development storage'}
                    </small>
                  )}

                </div>

              </div>

            )}

            {/* STATUS MESSAGE */}
            {status && (

              <div className="notice">
                <AlertCircle size={15} />
                <span>{status}</span>
              </div>

            )}

          </div>
        </section>

        {/* FOOTER */}
        <footer>

          <div className="footer-brand">
            <ShieldCheck size={17} />
            CertiChain
          </div>

          <span>
            Academic certificate authentication using blockchain technology.
          </span>

          <span>Local development build</span>

        </footer>

      </main>
    </div>
  );
}
