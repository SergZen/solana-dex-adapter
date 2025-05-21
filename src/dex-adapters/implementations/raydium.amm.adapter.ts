import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  ALL_PROGRAM_ID, DEVNET_PROGRAM_ID,
  AmmRpcData, AmmV4Keys, ApiV3PoolInfoStandardItem,
  liquidityStateV4Layout,
  Raydium,
} from "@raydium-io/raydium-sdk-v2";
import bs58 from 'bs58'
import BN from "bn.js";

import { isDevCluster } from "../../helpers/solana";
import { IDEXAdapter } from '../interfaces/adapter.interface';
import { RaydiumBaseAdapter } from "../base/raydium.base.adapter";

export class RaydiumAmmAdapter extends RaydiumBaseAdapter implements IDEXAdapter {
  constructor() {
    super();
  }

  async swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<string> {
    await this.initRaydium();

    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);
    const pool = await this.getPool(inputMint, outputMint);

    let poolInfo: ApiV3PoolInfoStandardItem | undefined = pool.poolInfo
    let poolKeys: AmmV4Keys | undefined = pool.poolKeys
    let rpcData: AmmRpcData = pool.poolRpcData

    const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

    const baseIn = inputMint.toString() === poolInfo.mintA.address
    const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

    const out = this.raydium.liquidity.computeAmountOut({
      poolInfo: {
        ...poolInfo,
        baseReserve,
        quoteReserve,
        status,
        version: 4,
      },
      amountIn: new BN(amount.toString()),
      mintIn: mintIn.address,
      mintOut: mintOut.address,
      slippage: slippage / 100,
    });

    this.raydium.setOwner(wallet)

    const { transaction } = await this.raydium.liquidity.swap({
      poolInfo,
      poolKeys,
      amountIn: new BN(amount.toString()),
      amountOut: out.minAmountOut,
      fixedSide: 'in',
      inputMint: mintIn.address,
      txVersion: RaydiumBaseAdapter.txVersion,
    })

    return await this.sendVtx(wallet, transaction, [wallet], true);
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint> {
    await this.initRaydium();

    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);
    const pool = await this.getPool(inputMint, outputMint);

    let poolInfo: ApiV3PoolInfoStandardItem | undefined = pool.poolInfo
    let rpcData: AmmRpcData = pool.poolRpcData

    const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

    const baseIn = inputMint.toString() === poolInfo.mintA.address
    const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

    const out = this.raydium.liquidity.computeAmountOut({
      poolInfo: {
        ...poolInfo,
        baseReserve,
        quoteReserve,
        status,
        version: 4,
      },
      amountIn: new BN(amount.toString()),
      mintIn: mintIn.address,
      mintOut: mintOut.address,
      slippage: slippage / 100,
    });

    return BigInt(out.amountOut.toString());
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey) {
    const raydium = await Raydium.load(this.raydiumInit);

    const baseFilter = {
      filters: [
        { dataSize: liquidityStateV4Layout.span },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('baseMint'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('quoteMint'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          }
        }
      ],
      encoding: 'base64',
    };

    const quoteFilter = {
      filters: [
        { dataSize: liquidityStateV4Layout.span },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('baseMint'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: liquidityStateV4Layout.offsetOf('quoteMint'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          }
        }
      ],
      encoding: 'base64',
    };

    const [baseMatches, quoteMatches] = await Promise.all([
      this.connection.getProgramAccounts(isDevCluster() ? DEVNET_PROGRAM_ID.AmmV4: ALL_PROGRAM_ID.AMM_V4, baseFilter),
      this.connection.getProgramAccounts(isDevCluster() ? DEVNET_PROGRAM_ID.AmmV4: ALL_PROGRAM_ID.AMM_V4, quoteFilter),
    ]);

    const combined = new Map<string, typeof baseMatches[0]>();

    [...baseMatches, ...quoteMatches].forEach(acc => {
      combined.set(acc.pubkey.toBase58(), acc);
    });

    const ammPools = Array.from(combined.keys());

    if (ammPools.length === 0) {
      throw new Error(`No Raydium AMM pool found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    //const rpcPoolData = await raydium.liquidity.getRpcPoolInfos(ammPools);

    return await raydium.liquidity.getPoolInfoFromRpc({ poolId: ammPools[0]});
  }
}
