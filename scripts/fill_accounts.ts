import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { ApiTypes, SubmittableExtrinsic } from '@polkadot/api/types';
import { keccakAsHex, addressToEvm, evmToAddress } from '@polkadot/util-crypto';
import { EventRecord } from '@polkadot/types/interfaces/system/types';
import { ExtrinsicStatus } from '@polkadot/types/interfaces/author/types';
import { IKeyringPair } from '@polkadot/types/types';
import { secrets } from '../secrets';
import { ethers } from "hardhat";

const wsEndpoint = "ws://127.0.0.1:9944";

// Credit test accounts using Alice's balance
const ownerSeed = "//Alice";

async function connect(): Promise<ApiPromise> {
  // Initialise the provider to connect to the node
  const wsProvider = new WsProvider(wsEndpoint);

  // Create the API and wait until ready
  const api = await ApiPromise.create({
      provider: wsProvider
  });

  return api;
}

enum TransactionStatus {
  Success,
  Fail,
  NotReady
}

function getTransactionStatus(events: EventRecord[], status: ExtrinsicStatus): TransactionStatus {
  if (status.isReady) {
    return TransactionStatus.NotReady;
  }
  if (status.isBroadcast) {
    return TransactionStatus.NotReady;
  }
  if (status.isRetracted) {
    return TransactionStatus.NotReady;
  }
  if (status.isInBlock || status.isFinalized) {
    if(events.filter(e => e.event.data.method === 'ExtrinsicFailed').length > 0) {
      return TransactionStatus.Fail;
    }
    if(events.filter(e => e.event.data.method === 'ExtrinsicSuccess').length > 0) {
      return TransactionStatus.Success;
    }
  }

  return TransactionStatus.Fail;
}

function sendTransactionAsync(sender: IKeyringPair, transaction: SubmittableExtrinsic<ApiTypes>): Promise<string | null> {
  return new Promise(async (resolve, reject) => {
    try {
      await transaction.signAndSend(sender, ({ events = [], status }) => {
        const transactionStatus = getTransactionStatus(events, status);

        if (transactionStatus === TransactionStatus.Success) {
          let blockHash;
          if (status.isInBlock) blockHash = status.asInBlock;
          if (status.isFinalized) blockHash = status.asFinalized;
          console.log(`OK in block ${blockHash}\n`);
          resolve(blockHash?.toString() || "Error");
        } else if (transactionStatus === TransactionStatus.NotReady) {
        } else {
          console.log(`Tx failed. Status: ${status}\n`);
          resolve(null);
        }
      });
    } catch (e) {
      console.log('Error: ', e);
      resolve(null);
    }
  });
}


async function sendFunds(api: ApiPromise, sender: IKeyringPair, recipient: string): Promise<void> {
  const amount2Str = "1000000000000000000000"; // 1000 OPL

  // Send as a regular transfer
  console.log(`Transfer ${amount2Str} to ${recipient} ... `);
  const tx1 = api.tx.balances.transfer(recipient, amount2Str);
  await sendTransactionAsync(sender, tx1);
}

const nesting = {
  toChecksumAddress(address: string): string {
    if(typeof address === 'undefined') return '';

    if(!/^(0x)?[0-9a-f]{40}$/i.test(address)) throw new Error(`Given address "${address}" is not a valid Ethereum address.`);

    address = address.toLowerCase().replace(/^0x/i, '');
    const addressHash = keccakAsHex(address).replace(/^0x/i, '');
    const checksumAddress = ['0x'];

    for(let i = 0; i < address.length; i++) {
      // If ith character is 8 to f then make it uppercase
      if(parseInt(addressHash[i], 16) > 7) {
        checksumAddress.push(address[i].toUpperCase());
      } else {
        checksumAddress.push(address[i]);
      }
    }
    return checksumAddress.join('');
  },
  tokenIdToAddress(collectionId: number, tokenId: number) {
    return this.toChecksumAddress(`0xf8238ccfff8ed887463fd5e0${collectionId.toString(16).padStart(8, '0')}${tokenId.toString(16).padStart(8, '0')}`);
  },
};

function translateEthToSub(address: string, ss58Format?: number): string {
  return evmToAddress(address, ss58Format);
}

/**
 * Get substrate mirror of an ethereum address
 * @param ethAddress ethereum address
 * @param toChainFormat false for normalized account
 * @example ethToSubstrate('0x9F0583DbB855d...')
 * @returns substrate mirror of a provided ethereum address
 */
function ethToSubstrate(ethAddress: string, toChainFormat = false): string {
  return translateEthToSub(nesting.toChecksumAddress('0x' + Array.from(addressToEvm(ethAddress), i => i.toString(16).padStart(2, '0')).join('')));
}

async function main() {
  const api = await connect();

  // Owners's keypair
  const keyring = new Keyring({ type: 'sr25519' });
  const owner : IKeyringPair = keyring.addFromUri(ownerSeed);

  const addresses = await ethers.getSigners();
  for (let i=0; i<addresses.length; i++) {
    const recipient = ethToSubstrate(addresses[i].address);
    await sendFunds(api, owner, recipient);
  }
}

main().catch(console.error).finally(() => process.exit());