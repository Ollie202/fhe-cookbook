import { ethers, fhevm } from 'hardhat';
import { FhevmType } from '@fhevm/hardhat-plugin';
import { expect } from 'chai';

describe('BlindLottery', () => {
  async function deploy(maxEntrants = 4) {
    const F = await ethers.getContractFactory('BlindLottery');
    const lot = await F.deploy(3600, maxEntrants);
    await lot.waitForDeployment();
    return lot;
  }

  it('lets each address enter exactly once', async () => {
    const [, alice] = await ethers.getSigners();
    const lot = await deploy();
    await lot.connect(alice).enter();
    await expect(lot.connect(alice).enter()).to.be.revertedWith('already entered');
    expect(await lot.entrantCount()).to.equal(1n);
  });

  it('rejects entries after deadline and rejects draw before', async () => {
    const [, alice] = await ethers.getSigners();
    const lot = await deploy();
    await lot.connect(alice).enter();
    await expect(lot.draw()).to.be.revertedWith('lottery running');
    await ethers.provider.send('evm_increaseTime', [3601]);
    await ethers.provider.send('evm_mine', []);
    await expect(lot.connect(alice).enter()).to.be.revertedWith('lottery closed');
  });

  it('draws a winner from the entrant pool and reveals it', async () => {
    const signers = await ethers.getSigners();
    const players = signers.slice(1, 4); // 3 entrants
    const lot = await deploy(3);
    for (const p of players) await lot.connect(p).enter();

    await ethers.provider.send('evm_increaseTime', [3601]);
    await ethers.provider.send('evm_mine', []);
    await lot.draw();
    expect(await lot.drawn()).to.equal(true);

    const idxHandle    = await lot.winnerIndex();
    const winnerHandle = await lot.winnerAddress();
    const idx    = await fhevm.publicDecryptEuint(FhevmType.euint32, idxHandle);
    const winner = await fhevm.publicDecryptEaddress(winnerHandle);

    expect(idx).to.be.gte(0n).and.lt(BigInt(players.length));
    const expected = players[Number(idx)].address.toLowerCase();
    expect(winner.toLowerCase()).to.equal(expected);
  });
});
