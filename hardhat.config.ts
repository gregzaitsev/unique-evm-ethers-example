import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import { secrets } from './secrets';

const config: HardhatUserConfig = {
  solidity: "0.8.9",
  defaultNetwork: "opal",
  networks: {
    opal: {
      url: "https://rpc-opal.unique.network",
      accounts: [secrets.privateKeys[0], secrets.privateKeys[1], secrets.privateKeys[2]]
    }
  },
  mocha: {
    timeout: 300000
  },
};

export default config;
