import {
  Keypair,
  PublicKey,
  TransactionSignature
} from "@solana/web3.js";
import {address, createSolanaRpc} from "@solana/kit";
import {
  fetchWhirlpoolsByTokenPair,
  PoolInfo,
  setPayerFromBytes,
  setRpc,
  setWhirlpoolsConfig,
  swap,
  swapInstructions
} from "@orca-so/whirlpools";

import {IDEXAdapter} from '../interfaces/adapter.interface';
import {BaseAdapter} from "../base/base.adapter";
import {isDevCluster} from "../../helpers/solana";

export class OrcaClmmAdapter extends BaseAdapter implements IDEXAdapter {
  constructor() {
    super();
  }

  async getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint> {
    const pool = await this.getPool(new PublicKey(fromToken), new PublicKey(toToken));

    let {quote} = await swapInstructions(
      this.connection,
      {
        inputAmount: amount,
        mint: address(fromToken),
      },
      address(pool.address),
      slippage
    );

    return quote.tokenEstOut;
  }

  async swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature> {
    const pool = await this.getPool(new PublicKey(fromToken), new PublicKey(toToken));

    await setPayerFromBytes(Uint8Array.from(wallet.secretKey));
    let { callback: sendTx } = await swap(
      {
        inputAmount: amount,
        mint: address(fromToken),
      },
      address(pool.address),
      slippage
    );

    return await sendTx();
  }

  protected setConnection() {
    setRpc(this.rpc);
    if (isDevCluster()) {
      setWhirlpoolsConfig('solanaDevnet');
    }
    this.connection = createSolanaRpc(this.rpc)
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey): Promise<PoolInfo> {
    const pools = await fetchWhirlpoolsByTokenPair(
      this.connection,
      address(inputMint.toString()),
      address(outputMint.toString())
    );

    const initializedPools = pools.filter((pool) => pool.initialized);

    initializedPools.sort((a, b) => {
      if (b.liquidity > a.liquidity) return 1;
      if (b.liquidity < a.liquidity) return -1;
      return 0;
    });

    if (initializedPools.length === 0) {
      throw new Error(`No Orca initialized whirlpool found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    return initializedPools[0];
  }
}
