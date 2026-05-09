import { ethers } from 'hardhat';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log('deployer', deployer.address, 'balance', (await ethers.provider.getBalance(deployer.address)).toString());

  const Token = await ethers.getContractFactory('ConfidentialERC20');
  const token = await Token.deploy('Confidential USD', 'cUSD');
  await token.waitForDeployment();
  console.log('ConfidentialERC20    ', await token.getAddress());

  const Auction = await ethers.getContractFactory('SealedBidAuction');
  const auction = await Auction.deploy('Vintage 1985 Macintosh', 60 * 60 * 24);
  await auction.waitForDeployment();
  console.log('SealedBidAuction     ', await auction.getAddress());

  const Vote = await ethers.getContractFactory('PrivateVote');
  const vote = await Vote.deploy(3, 60 * 60 * 24);
  await vote.waitForDeployment();
  console.log('PrivateVote          ', await vote.getAddress());

  const Lottery = await ethers.getContractFactory('BlindLottery');
  const lottery = await Lottery.deploy(60 * 60 * 24, 100);
  await lottery.waitForDeployment();
  console.log('BlindLottery         ', await lottery.getAddress());

  const Allow = await ethers.getContractFactory('ConfidentialAllowlist');
  const allow = await Allow.deploy();
  await allow.waitForDeployment();
  console.log('ConfidentialAllowlist', await allow.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
