import { expect } from "chai";
import { ethers } from "hardhat";
import { GasConsumer } from "../typechain-types/GasConsumer";
import BigNumber from 'bignumber.js';
BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN, EXPONENTIAL_AT: 255 });

describe("GasConsumer contract", function () {
  let gasConsumer: GasConsumer;
  let gasPrice: BigNumber;

  before(async () => {
    // gasConsumer = await ethers.deployContract("GasConsumer");
    // await gasConsumer.waitForDeployment();

    gasConsumer = await ethers.getContractAt("GasConsumer", "0xF195Dc147CeFfAE0B17F0e04d1da3EEaf797EB69");

    const tx = await gasConsumer.compute(1n);
    const receipt = await tx.wait();
    if (receipt?.gasPrice) {
      gasPrice = new BigNumber(Number(receipt.gasPrice));
      console.log(`Gas price: ${gasPrice.toString()}`);
    }

    // Hardcode for Opal v942057
    // gasPrice = new BigNumber("1906626161453");
  });

  it("Two iterations, no gas price specified", async () => {
    const tx = await gasConsumer.compute(2n);
    await tx.wait();
    const state = await gasConsumer.state();
    expect(state).to.be.equal(1);
  });

  it("Three iterations, double gas price", async () => {
    const tx = await gasConsumer.compute(3n, {gasPrice: gasPrice.multipliedBy(2).toString()});
    await tx.wait();
    const state = await gasConsumer.state();
    expect(state).to.be.equal(2);
  });

  it.only("Three iterations, insufficient gas price", async () => {
    // const tx = await gasConsumer.compute(3n, {gasPrice: gasPrice.minus(1).toString()});
    // const receipt = await tx.wait();
    // console.log();

    const insuffPrice = gasPrice.minus(1).toString();

    // await expect(gasConsumer.compute(3n, {gasPrice: insuffPrice})).to.be.revertedWith("insufficient funds for gas * price + value");
    await expect(gasConsumer.compute(3n, {gasPrice: insuffPrice})).to.be.reverted;
  });

  // it("Should fail if the unlockTime is not in the future", async function () {
  //   // We don't use the fixture here because we want a different deployment
  //   const latestTime = await time.latest();
  //   const Lock = await ethers.getContractFactory("Lock");
  //   await expect(Lock.deploy(latestTime, { value: 1 })).to.be.revertedWith(
  //     "Unlock time should be in the future"
  //   );
  // });


});
