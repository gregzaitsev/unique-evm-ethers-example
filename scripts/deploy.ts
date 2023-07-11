import { ethers } from "hardhat";

async function main() {
  const gasConsumer = await ethers.deployContract("GasConsumer");

  await gasConsumer.waitForDeployment();

  console.log(
    `GasConsumer with deployed to ${gasConsumer.target}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
