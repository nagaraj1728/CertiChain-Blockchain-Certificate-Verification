const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('StoreHash', function () {
  async function setup() {
    const [admin, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory('StoreHash');
    const contract = await Factory.deploy();
    return { contract, admin, stranger };
  }
  const hash = 'a'.repeat(64);

  it('allows the university admin to issue and verify a certificate', async function () {
    const { contract } = await setup();
    await contract.issueCertificate('CERT-001', hash, 'local://certificate.pdf');
    expect(await contract.verifyDocument('CERT-001', hash)).to.equal(true);
    expect(await contract.verifyDocument('CERT-001', 'b'.repeat(64))).to.equal(false);
  });
  it('prevents non-admin accounts from issuing certificates', async function () {
    const { contract, stranger } = await setup();
    await expect(contract.connect(stranger).issueCertificate('CERT-002', hash, ''))
      .to.be.revertedWith('Only university admin');
  });
  it('prevents duplicate IDs and supports revocation', async function () {
    const { contract } = await setup();
    await contract.issueCertificate('CERT-003', hash, '');
    await expect(contract.issueCertificate('CERT-003', hash, '')).to.be.revertedWith('Certificate ID already exists');
    await contract.revokeCertificate('CERT-003');
    expect(await contract.verifyDocument('CERT-003', hash)).to.equal(false);
  });
});
