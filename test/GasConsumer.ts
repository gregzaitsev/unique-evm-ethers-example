import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersProvider } from "@nomicfoundation/hardhat-ethers/internal/hardhat-ethers-provider";
import { constants } from '@unique-nft/solidity-interfaces';
import { GasConsumer } from "../typechain-types/GasConsumer";
import BigNumber from 'bignumber.js';
BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN, EXPONENTIAL_AT: 255 });

// TBD: Import from Unique solidity interfaces
import helpersAbi from './contractHelpers.json';

// TBD: Import from Unique solidity interfaces
enum SponsoringMode {
  Disabled = 0,
  Allowlisted = 1,
  Generous = 2,
}

describe("GasConsumer contract", function () {
  let gasConsumer: GasConsumer;
  let gasPrice: BigNumber;
  let helpers: any;
  let provider: HardhatEthersProvider;
  let owner: any;
  let sponsor: any;
  let caller: any;
  let gasParameters: {
    gasLimit: string,
    gasPrice: string
  } = {gasLimit: "1000000", gasPrice: "0"};

  before(async () => {
    gasConsumer = await ethers.deployContract("GasConsumer");
    await gasConsumer.waitForDeployment();
    // gasConsumer = await ethers.getContractAt("GasConsumer", "0xF195Dc147CeFfAE0B17F0e04d1da3EEaf797EB69");

    provider = ethers.provider;
    const feeData = await provider.getFeeData();
    gasPrice = new BigNumber(feeData?.gasPrice?.toString() ?? 0);
  });

  describe("Sponsored transactions", function () {

    before(async () => {
      helpers = new ethers.Contract(constants.STATIC_ADDRESSES.contractHelpers, helpersAbi);

      // Sponsor contract
      [owner, sponsor, caller] = await ethers.getSigners();
      await (await helpers.connect(owner).setSponsor(gasConsumer.getAddress(), sponsor)).wait();
      await (await helpers.connect(sponsor).confirmSponsorship(gasConsumer.getAddress())).wait();
      const sponsorSet = await helpers.connect(owner).hasSponsor(gasConsumer.getAddress());
      expect(sponsorSet).to.be.true;

      // Setup sponsoring mode and limits
      await (await helpers.connect(owner).setSponsoringMode(gasConsumer.getAddress(), SponsoringMode.Generous)).wait();
      await (await helpers.connect(owner).setSponsoringRateLimit(gasConsumer.getAddress(), 0)).wait();
    });

    it("No gas price specified, sponsor is paying", async () => {
      const sponsorBalance1 = await provider.getBalance(sponsor);
      const callerBalance1 = await provider.getBalance(caller);

      await (await gasConsumer.connect(caller).compute(2n)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(1);

      const sponsorBalance2 = await provider.getBalance(sponsor);
      const callerBalance2 = await provider.getBalance(caller);
      expect(sponsorBalance1).to.be.greaterThan(sponsorBalance2);
      expect(callerBalance1).to.be.equal(callerBalance2);
    });

    it("Single gas price specified, sponsor is paying", async () => {
      const sponsorBalance1 = await provider.getBalance(sponsor);
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.toString();
      await (await gasConsumer.connect(caller).compute(2n, gasParameters)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(1);

      const sponsorBalance2 = await provider.getBalance(sponsor);
      const callerBalance2 = await provider.getBalance(caller);
      expect(sponsorBalance1).to.be.greaterThan(sponsorBalance2);
      expect(callerBalance1).to.be.equal(callerBalance2);
    });

    it("Double gas price, sponsor is paying", async () => {
      const sponsorBalance1 = await provider.getBalance(sponsor);
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.multipliedBy(2).toString();
      await (await gasConsumer.connect(caller).compute(3n, gasParameters)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(2);

      const sponsorBalance2 = await provider.getBalance(sponsor);
      const callerBalance2 = await provider.getBalance(caller);
      expect(sponsorBalance1).to.be.greaterThan(sponsorBalance2);
      expect(callerBalance1).to.be.equal(callerBalance2);
    });

    it("Insufficient gas price, transaction fails", async () => {
      gasParameters.gasPrice = gasPrice.minus(1).toString();
      await expect(gasConsumer.connect(caller).compute(3n, gasParameters)).to.be.rejectedWith("insufficient funds for gas * price + value");
    });

    it("Gas price equals 2.1x network gas price, sponsor is paying", async () => {
      const sponsorBalance1 = await provider.getBalance(sponsor);
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.multipliedBy(2.1).toFixed(0).toString();
      await (await gasConsumer.connect(caller).compute(4n, gasParameters)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(3);

      const sponsorBalance2 = await provider.getBalance(sponsor);
      const callerBalance2 = await provider.getBalance(caller);
      expect(sponsorBalance1).to.be.greaterThan(sponsorBalance2);
      expect(callerBalance1).to.be.equal(callerBalance2);
    });

    it("Gas price exceeds 2.1x network gas price, caller is paying", async () => {
      const sponsorBalance1 = await provider.getBalance(sponsor);
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.multipliedBy(2.1).plus(1).toFixed(0).toString();
      await (await gasConsumer.connect(caller).compute(3n, gasParameters)).wait();

      const sponsorBalance2 = await provider.getBalance(sponsor);
      const callerBalance2 = await provider.getBalance(caller);
      expect(sponsorBalance1).to.be.equal(sponsorBalance2);
      expect(callerBalance1).to.be.greaterThan(callerBalance2);
    });

    after(async () => {
      const [owner] = await ethers.getSigners();
      await(await helpers.connect(owner).removeSponsor(gasConsumer.getAddress())).wait();
    });
  });

  describe("Non-sponsored transactions", function () {
    it("No gas price specified, caller is paying", async () => {
      const callerBalance1 = await provider.getBalance(caller);

      await (await gasConsumer.connect(caller).compute(2n)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(1);

      const callerBalance2 = await provider.getBalance(caller);
      expect(callerBalance1).to.be.greaterThan(callerBalance2);
    });

    it("Single gas price specified, caller is paying", async () => {
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.toString();
      await (await gasConsumer.connect(caller).compute(2n, gasParameters)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(1);

      const callerBalance2 = await provider.getBalance(caller);
      expect(callerBalance1).to.be.greaterThan(callerBalance2);
    });

    it("Double gas price, caller is paying", async () => {
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.multipliedBy(2).toString();
      await (await gasConsumer.connect(caller).compute(3n, gasParameters)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(2);

      const callerBalance2 = await provider.getBalance(caller);
      expect(callerBalance1).to.be.greaterThan(callerBalance2);
    });

    it("Insufficient gas price", async () => {
      gasParameters.gasPrice = gasPrice.minus(1).toString();
      await expect(gasConsumer.connect(caller).compute(3n, gasParameters)).to.be.rejectedWith("insufficient funds for gas * price + value");
    });

    it("Gas price exceeds 2.1x network gas price, caller is paying", async () => {
      const callerBalance1 = await provider.getBalance(caller);

      gasParameters.gasPrice = gasPrice.multipliedBy(10).toFixed(0).toString();
      await (await gasConsumer.connect(caller).compute(5n, gasParameters)).wait();
      const state = await gasConsumer.state();
      expect(state).to.be.equal(4);

      const callerBalance2 = await provider.getBalance(caller);
      expect(callerBalance1).to.be.greaterThan(callerBalance2);
    });
  });
});
