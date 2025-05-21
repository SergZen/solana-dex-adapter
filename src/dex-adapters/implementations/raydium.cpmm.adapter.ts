import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  ALL_PROGRAM_ID,
  DEVNET_PROGRAM_ID,
  ApiV3PoolInfoStandardItemCpmm,
  CpmmKeys,
  CpmmRpcData,
  CurveCalculator,
  CpmmPoolInfoLayout, PoolInfoLayout
} from "@raydium-io/raydium-sdk-v2";
import bs58 from 'bs58'
import BN from "bn.js";

import { isDevCluster } from "../../helpers/solana";
import { IDEXAdapter } from '../interfaces/adapter.interface';
import { RaydiumBaseAdapter } from "../base/raydium.base.adapter";

export class RaydiumCpmmAdapter extends RaydiumBaseAdapter implements IDEXAdapter {
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

    const poolInfo: ApiV3PoolInfoStandardItemCpmm = pool.poolInfo
    const poolKeys: CpmmKeys | undefined = pool.poolKeys
    const rpcData: CpmmRpcData = pool.rpcData

    const baseIn = inputMint.toString() === poolInfo.mintA.address

    const swapResult = CurveCalculator.swap(
      new BN(amount.toString()),
      baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
      baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    )

    this.raydium.setOwner(wallet)
    const { transaction } = await this.raydium.cpmm.swap({
      poolInfo,
      poolKeys,
      inputAmount: new BN(amount.toString()),
      swapResult,
      slippage: slippage / 100,
      baseIn,
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
    const inputMint = new PublicKey(fromToken);
    const outputMint = new PublicKey(toToken);
    const pool = await this.getPool(inputMint, outputMint);

    const poolInfo: ApiV3PoolInfoStandardItemCpmm = pool.poolInfo
    const rpcData: CpmmRpcData = pool.rpcData

    const baseIn = inputMint.toString() === poolInfo.mintA.address

    const swapResult = CurveCalculator.swap(
      new BN(amount.toString()),
      baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
      baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
      rpcData.configInfo!.tradeFeeRate
    )

    return BigInt(swapResult.destinationAmountSwapped.toString());
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey) {
    await this.initRaydium();

    const baseFilter = {
      filters: [
        { dataSize: CpmmPoolInfoLayout.span },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(inputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintB'),
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
        { dataSize: CpmmPoolInfoLayout.span },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintA'),
            bytes: bs58.encode(Buffer.from(outputMint.toBytes())),
          },
        },
        {
          memcmp: {
            offset: CpmmPoolInfoLayout.offsetOf('mintB'),
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
      this.connection.getProgramAccounts(isDevCluster() ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM: ALL_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, baseFilter),
      this.connection.getProgramAccounts(isDevCluster() ? DEVNET_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM: ALL_PROGRAM_ID.CREATE_CPMM_POOL_PROGRAM, quoteFilter),
    ]);

    const combined = new Map<string, typeof baseMatches[0]>();

    [...baseMatches, ...quoteMatches].forEach(acc => {
      combined.set(acc.pubkey.toBase58(), acc);
    });

    const cpmmPools = Array.from(combined.keys());

    if (cpmmPools.length === 0) {
      throw new Error(`No Raydium CPMM pool found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    //const rpcPoolData = await this.raydium.cpmm.getRpcPoolInfos(cpmmPools);

    return await this.raydium.cpmm.getPoolInfoFromRpc(cpmmPools[0])
  }
}
