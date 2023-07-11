import { expect } from "chai";
import { ethers } from "hardhat";
import { constants } from '@unique-nft/solidity-interfaces'
import { GasConsumer } from "../typechain-types/GasConsumer";
import BigNumber from 'bignumber.js';
BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN, EXPONENTIAL_AT: 255 });

import helpersAbi from './contractHelpers.json';

describe("GasConsumer contract", function () {
  let gasConsumer: GasConsumer;
  let gasPrice: BigNumber;
  let helpers: any;

  before(async () => {
    // gasConsumer = await ethers.deployContract("GasConsumer");
    // await gasConsumer.waitForDeployment();
    gasConsumer = await ethers.getContractAt("GasConsumer", "0xF195Dc147CeFfAE0B17F0e04d1da3EEaf797EB69");

    const provider = ethers.provider;
    const feeData = await provider.getFeeData();
    gasPrice = new BigNumber(feeData?.gasPrice?.toString() ?? 0);

    helpers = new ethers.Contract(constants.STATIC_ADDRESSES.contractHelpers, helpersAbi);
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

  it("Three iterations, insufficient gas price", async () => {
    const insuffPrice = gasPrice.minus(1).toString();
    await expect(gasConsumer.compute(3n, {gasPrice: insuffPrice})).to.be.rejectedWith("insufficient funds for gas * price + value");
  });

  it("Three iterations, gas price exceeds 2.1x network gas price, succeeds for non-sponsored contract", async () => {
    const price2_1_plus = gasPrice.multipliedBy(2.1).plus(1).toFixed(0).toString();
    await expect(gasConsumer.compute(3n, {gasPrice: price2_1_plus})).to.not.be.rejected;
  });

  it.only("Three iterations, gas price exceeds 2.1x network gas price, fails for sponsored contract", async () => {
    // const price2_1_plus = gasPrice.multipliedBy(2.1).plus(1).toFixed(0).toString();
    const price2_1_plus = gasPrice.multipliedBy(10).toFixed(0).toString();

    // Sponsor contract
    const [owner, sponsor, caller] = await ethers.getSigners();
    const tx1 = await helpers.connect(owner).setSponsor(gasConsumer.getAddress(), sponsor);
    await tx1.wait();
    const tx2 = await helpers.connect(sponsor).confirmSponsorship(gasConsumer.getAddress());
    await tx2.wait();
    const sponsorSet = await helpers.connect(owner).hasSponsor(gasConsumer.getAddress());
    expect(sponsorSet).to.be.true;

    // Setup sponsoring limits
    // TBD

    await expect(gasConsumer.compute(3n, {from: caller, gasPrice: price2_1_plus})).to.be.rejected;
    // await expect(gasConsumer.compute(3n, {gasPrice: price2_1_plus})).to.be.rejectedWith("insufficient funds for gas * price + value");
  });

  after(async () => {
    const [sponsor] = await ethers.getSigners();
    const tx = await helpers.connect(sponsor).removeSponsor(gasConsumer.getAddress());
    await tx.wait();
  });
});
