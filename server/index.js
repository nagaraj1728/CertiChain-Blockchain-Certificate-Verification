const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fetch = global.fetch;
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const uploadDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(5).toString('hex')}${path.extname(file.originalname).slice(0, 12)}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'certificate-api', ipfsEnabled: Boolean(process.env.PINATA_JWT) }));

app.post('/api/upload', upload.single('certificate'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please select a certificate file.' });
  try {
    const buffer = fs.readFileSync(req.file.path);
    const documentHash = crypto.createHash('sha256').update(buffer).digest('hex');
    let ipfsCid = `local-${path.basename(req.file.path)}`;
    let storageMode = 'local';

    if (process.env.PINATA_JWT) {
      const form = new FormData();
      form.append('file', new Blob([buffer]), req.file.originalname);
      const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.PINATA_JWT}` },
        body: form
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || result.message || 'IPFS upload failed');
      ipfsCid = result.IpfsHash;
      storageMode = 'ipfs';
    }
    res.json({ documentHash, ipfsCid, storageMode, originalName: req.file.originalname });
  } catch (error) {
    res.status(502).json({ error: `Upload failed: ${error.message}` });
  }
});

app.listen(PORT, () => console.log(`Certificate API running at http://localhost:${PORT}`));
