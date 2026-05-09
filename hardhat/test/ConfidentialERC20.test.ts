import { ethers, fhevm } from 'hardhat';
import { FhevmType } from '@fhevm/hardhat-plugin';
import { expect } from 'chai';

describe('ConfidentialERC20', () => {
  async function deploy() {
    const [minter, alice, bob] = await ethers.getSigners();
    const F = await ethers.getContractFactory('ConfidentialERC20');
    const token = await F.connect(minter).deploy('Confidential USD', 'cUSD');
    await token.waitForDeployment();
    return { token, minter, alice, bob };
  }

  async function encrypted(token: any, user: any, amount: bigint) {
    const input = fhevm.createEncryptedInput(await token.getAddress(), user.address);
    input.add64(amount);
    return input.encrypt();
  }

  async function decryptBalance(token: any, user: any): Promise<bigint> {
    const handle = await token.balanceOf(user.address);
    if (handle === ethers.ZeroHash) return 0n;
    return fhevm.userDecryptEuint(FhevmType.euint64, handle, await token.getAddress(), user);
  }

  it('mints and decrypts the recipient balance', async () => {
    const { token, minter, alice } = await deploy();
    const enc = await encrypted(token, minter, 1000n);
    await token.connect(minter).mint(alice.address, enc.handles[0], enc.inputProof);
    expect(await decryptBalance(token, alice)).to.equal(1000n);
  });

  it('moves the full amount on a sufficient transfer', async () => {
    const { token, minter, alice, bob } = await deploy();
    let enc = await encrypted(token, minter, 1000n);
    await token.connect(minter).mint(alice.address, enc.handles[0], enc.inputProof);
    enc = await encrypted(token, alice, 400n);
    await token.connect(alice).transfer(bob.address, enc.handles[0], enc.inputProof);
    expect(await decryptBalance(token, alice)).to.equal(600n);
    expect(await decryptBalance(token, bob)).to.equal(400n);
  });

  it('clamps to zero on overdraft (no revert)', async () => {
    const { token, minter, alice, bob } = await deploy();
    let enc = await encrypted(token, minter, 100n);
    await token.connect(minter).mint(alice.address, enc.handles[0], enc.inputProof);
    enc = await encrypted(token, alice, 999n);
    await token.connect(alice).transfer(bob.address, enc.handles[0], enc.inputProof);
    expect(await decryptBalance(token, alice)).to.equal(100n);
    expect(await decryptBalance(token, bob)).to.equal(0n);
  });
});
