import { ethers, fhevm } from 'hardhat';
import { FhevmType } from '@fhevm/hardhat-plugin';
import { expect } from 'chai';

describe('ConfidentialAllowlist', () => {
  async function deploy() {
    const F = await ethers.getContractFactory('ConfidentialAllowlist');
    const c = await F.deploy();
    await c.waitForDeployment();
    return c;
  }

  async function callGated(c: any, who: any, value: bigint) {
    const input = fhevm.createEncryptedInput(await c.getAddress(), who.address);
    input.add64(value);
    const enc = await input.encrypt();
    return c.connect(who).gatedIncrement(enc.handles[0], enc.inputProof);
  }

  it('admit user can increment their counter', async () => {
    const [admin, alice] = await ethers.getSigners();
    const c = await deploy();
    await c.connect(admin).grant(alice.address);

    await callGated(c, alice, 7n);

    const handle = await c.counter(alice.address);
    const plain = await fhevm.userDecryptEuint(FhevmType.euint64, handle, await c.getAddress(), alice);
    expect(plain).to.equal(7n);
  });

  it('non-member silently no-ops (counter stays 0)', async () => {
    const [, , bob] = await ethers.getSigners();
    const c = await deploy();
    // bob was never granted
    await callGated(c, bob, 99n);
    const handle = await c.counter(bob.address);
    const plain = await fhevm.userDecryptEuint(FhevmType.euint64, handle, await c.getAddress(), bob);
    expect(plain).to.equal(0n);
  });

  it('only admin can grant or revoke', async () => {
    const [, alice] = await ethers.getSigners();
    const c = await deploy();
    await expect(c.connect(alice).grant(alice.address)).to.be.revertedWith('not admin');
    await expect(c.connect(alice).revoke(alice.address)).to.be.revertedWith('not admin');
  });
});
