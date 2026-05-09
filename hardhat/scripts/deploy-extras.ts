// Deploys ONLY the new BlindLottery + ConfidentialAllowlist contracts.
// The existing ConfidentialERC20 / SealedBidAuction / PrivateVote remain at
// their previously deployed addresses (recorded in README.md).

import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('deployer', deployer.address, 'balance', (await ethers.provider.getBalance(deployer.address)).toString());

  const Lottery = await ethers.getContractFactory('BlindLottery');
  const lottery = await Lottery.deploy(60 * 60 * 24, 100); // 24h window, max 100 entrants
  await lottery.waitForDeployment();
  console.log('BlindLottery         ', await lottery.getAddress());

  const Allow = await ethers.getContractFactory('ConfidentialAllowlist');
  const allow = await Allow.deploy();
  await allow.waitForDeployment();
  console.log('ConfidentialAllowlist', await allow.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
