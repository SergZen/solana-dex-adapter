import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  ClmmKeys,
  ComputeClmmPoolInfo,
  PoolUtils,
  ReturnTypeFetchMultiplePoolTickArrays,
  ALL_PROGRAM_ID, DEVNET_PROGRAM_ID,
  Raydium, PoolInfoLayout
} from "@raydium-io/raydium-sdk-v2";
import bs58 from 'bs58'
import BN from "bn.js";

import { isDevCluster } from "../../helpers/solana";
import { IDEXAdapter } from '../interfaces/adapter.interface';
import { RaydiumBaseAdapter } from "../base/raydium.base.adapter";

export class RaydiumClmmAdapter extends RaydiumBaseAdapter implements IDEXAdapter {
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

    const poolKeys: ClmmKeys | undefined = pool.poolKeys
    const clmmPoolInfo: ComputeClmmPoolInfo = pool.computePoolInfo
    const tickCache: ReturnTypeFetchMultiplePoolTickArrays = pool.tickData
    const poolInfo = pool.poolInfo
    const poolId = pool.poolInfo.id

    const baseIn = inputMint.toString() === poolInfo.mintA.address

    const { minAmountOut, remainingAccounts } = await PoolUtils.computeAmountOutFormat({
      poolInfo: clmmPoolInfo,
      tickArrayCache: tickCache[poolId],
      amountIn: new BN(amount.toString()),
      tokenOut: poolInfo[baseIn ? 'mintB' : 'mintA'],
      slippage: slippage / 100,
      epochInfo: await this.raydium.fetchEpochInfo(),
    })

    this.raydium.setOwner(wallet)

    const { transaction } = await this.raydium.clmm.swap({
      poolInfo,
      poolKeys,
      inputMint: poolInfo[baseIn ? 'mintA' : 'mintB'].address,
      amountIn: new BN(amount.toString()),
      amountOutMin: minAmountOut.amount.raw,
      observationId: clmmPoolInfo.observationId,
      ownerInfo: {
        useSOLBalance: true,
      },
      remainingAccounts,
      txVersion: RaydiumBaseAdapter.txVersion,
    })

    return await this.sendVtx(wallet, transaction, [wallet], true)
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint> {
    const raydium = await Raydium.load(this.raydiumInit);

    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);

    const pool = await this.getPool(inputMint, outputMint);

    const clmmPoolInfo: ComputeClmmPoolInfo = pool.computePoolInfo
    const tickCache: ReturnTypeFetchMultiplePoolTickArrays = pool.tickData
    const poolInfo = pool.poolInfo
    const poolId = pool.poolInfo.id

    const baseIn = inputMint.toString() === poolInfo.mintA.address

    const { minAmountOut } = await PoolUtils.computeAmountOutFormat({
      poolInfo: clmmPoolInfo,
      tickArrayCache: tickCache[poolId],
      amountIn: new BN(amount.toString()),
      tokenOut: poolInfo[baseIn ? 'mintB' : 'mintA'],
      slippage: slippage / 100,
      epochInfo: await raydium.fetchEpochInfo(),
    })

    return BigInt(minAmountOut.amount.raw.toString());
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey) {
    const raydium = await Raydium.load(this.raydiumInit);

    const baseFilter = {
      filters: [
        { dataSize: PoolInfoLayout.span },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('mintB'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          }
        },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('status'),
            bytes: bs58.encode(Buffer.from([0])),
          }
        }
      ],
      encoding: 'base64',
    };

    const quoteFilter = {
      filters: [
        { dataSize: PoolInfoLayout.span },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('mintB'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          }
        },
        {
          memcmp: {
            offset: PoolInfoLayout.offsetOf('status'),
            bytes: bs58.encode(Buffer.from([0])),
          }
        }
      ],
      encoding: 'base64',
    };

    const [baseMatches, quoteMatches] = await Promise.all([
      this.connection.getProgramAccounts(isDevCluster() ? DEVNET_PROGRAM_ID.CLMM: ALL_PROGRAM_ID.CLMM_PROGRAM_ID, baseFilter),
      this.connection.getProgramAccounts(isDevCluster() ? DEVNET_PROGRAM_ID.CLMM: ALL_PROGRAM_ID.CLMM_PROGRAM_ID, quoteFilter),
    ]);

    const combined = new Map<string, typeof baseMatches[0]>();

    [...baseMatches, ...quoteMatches].forEach(acc => {
      combined.set(acc.pubkey.toBase58(), acc);
    });

    const clmmPools = Array.from(combined.keys());

    if (clmmPools.length === 0) {
      throw new Error(`No Raydium CLMM pool found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    //const rpcPoolData = await raydium.clmm.getRpcClmmPoolInfos({ poolIds: clmmPools });

    return await raydium.clmm.getPoolInfoFromRpc(clmmPools[0]);
  }
}
