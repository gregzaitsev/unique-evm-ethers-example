# Example of interaction between Opal EVM and Ethers

Example of interaction between Solidity contract deployed in Opal testnet and ethers.js library (created with hardhat)

## How it was created

1. Execute following with all standard responses (y):
```
npx hardhat
```

2. Add Opal network to hardhat config

3. Replace Lock contract with GasConsumer

4. Add tests

## Execution on Opal

1. Deploy contract:
```
npx hardhat run scripts/deploy.ts
```

2. Copy `secrets.example.ts` to `secrets.ts` and insert private keys for the accounts that have adequate balance for deploying and calling the smart contracts.

3. Run tests:
```
npx hardhat test
```

## Testing on local devnet

1. Run local node and wait until it builds and starts producing blocks:
```
npm run devnet:start
```

2. Send some testnet currency to your accounts in secrets.ts file:

```
npx hardhat run scripts/fill_accounts.ts
```

3. Run tests
```
npx hardhat test --network local
```

4. Pause local node when done:
```
npm run devnet:stop
```

## Details

Unique networks allow sponsoring on contracts that is setup in a following way (see the test for complete example):

```js
// Sponsor contract
[owner, sponsor, caller] = await ethers.getSigners();
await (await helpers.connect(owner).setSponsor(gasConsumer.getAddress(), sponsor)).wait();
await (await helpers.connect(sponsor).confirmSponsorship(gasConsumer.getAddress())).wait();
const sponsorSet = await helpers.connect(owner).hasSponsor(gasConsumer.getAddress());
expect(sponsorSet).to.be.true;

// Setup sponsoring mode and limits
await (await helpers.connect(owner).setSponsoringMode(gasConsumer.getAddress(), SponsoringMode.Generous)).wait();
await (await helpers.connect(owner).setSponsoringRateLimit(gasConsumer.getAddress(), 0)).wait();
```

Sponsoring allows the sponsor address to pay for any transactions executed with a smart contract, but there is a limitation: Gas price cannot exceed 2.1x of what network reports, otherwise the caller address will be responsible for the transaction fees.
