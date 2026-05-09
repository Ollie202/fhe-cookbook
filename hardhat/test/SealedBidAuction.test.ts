import { ethers, fhevm } from 'hardhat';
import { FhevmType } from '@fhevm/hardhat-plugin';
import { expect } from 'chai';

describe('SealedBidAuction', () => {
  async function deploy() {
    const [, alice, bob, carol] = await ethers.getSigners();
    const F = await ethers.getContractFactory('SealedBidAuction');
    const auction = await F.deploy('Vintage 1985 Macintosh', 3600);
    await auction.waitForDeployment();
    return { auction, alice, bob, carol };
  }

  async function placeBid(auction: any, bidder: any, amount: bigint) {
    const input = fhevm.createEncryptedInput(await auction.getAddress(), bidder.address);
    input.add64(amount);
    const enc = await input.encrypt();
    return auction.connect(bidder).bid(enc.handles[0], enc.inputProof);
  }

  it('marks the highest bid + winner publicly decryptable on settle', async () => {
    const { auction, alice, bob, carol } = await deploy();
    await placeBid(auction, alice, 100n);
    await placeBid(auction, bob,   250n);
    await placeBid(auction, carol, 175n);

    await ethers.provider.send('evm_increaseTime', [3601]);
    await ethers.provider.send('evm_mine', []);
    await auction.settle();

    expect(await auction.settled()).to.equal(true);

    const bidHandle    = await auction.highestBid();
    const winnerHandle = await auction.highestBidder();
    const bidPlain     = await fhevm.publicDecryptEuint(FhevmType.euint64, bidHandle);
    const winnerPlain  = await fhevm.publicDecryptEaddress(winnerHandle);
    expect(bidPlain).to.equal(250n);
    expect(winnerPlain.toLowerCase()).to.equal(bob.address.toLowerCase());
  });

  it('rejects bids after the deadline', async () => {
    const { auction, alice } = await deploy();
    await ethers.provider.send('evm_increaseTime', [3601]);
    await ethers.provider.send('evm_mine', []);
    await expect(placeBid(auction, alice, 1n)).to.be.revertedWith('auction closed');
  });

  it('cannot settle before the deadline', async () => {
    const { auction, alice } = await deploy();
    await placeBid(auction, alice, 50n);
    await expect(auction.settle()).to.be.revertedWith('auction running');
  });
});
