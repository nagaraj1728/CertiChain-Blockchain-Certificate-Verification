const fs = require('fs');
const path = require('path');
const { ethers, network } = require('hardhat');

async function main() {
  const [deployer] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory('StoreHash');
  const contract = await Factory.deploy();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const output = {
    contractAddress: address,
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    admin: deployer.address,
    deployedAt: new Date().toISOString()
  };
  const target = path.join(__dirname, '..', 'client', 'src', 'deployment.json');
  fs.writeFileSync(target, JSON.stringify(output, null, 2));
  console.log('\nStoreHash deployed:', address);
  console.log('Deployment details written to client/src/deployment.json');
  console.log('Admin account:', deployer.address);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
