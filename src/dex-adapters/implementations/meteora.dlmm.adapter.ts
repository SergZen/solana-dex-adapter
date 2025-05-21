import {
  Connection,
  Keypair,
  PublicKey,
  TransactionSignature
} from "@solana/web3.js";
import DLMM, {SwapQuote} from '@meteora-ag/dlmm';

import {IDEXAdapter} from '../interfaces/adapter.interface';
import {BaseAdapter} from "../base/base.adapter";
import {BN} from "bn.js";

export class MeteoraDlmmAdapter extends BaseAdapter implements IDEXAdapter {
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

    const swapQuote = await this.swapQuote(
      pool,
      fromToken,
      amount,
      slippage,
    );

    return BigInt(swapQuote.outAmount.toString());
  }

  async swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature> {
    const pool = await this.getPool(new PublicKey(fromToken), new PublicKey(toToken));

    const swapForY = pool.lbPair.tokenXMint.equals(new PublicKey(fromToken));

    const swapQuote = await this.swapQuote(
      pool,
      fromToken,
      amount,
      slippage,
    );

    const swapTx = await pool.swap({
      inToken: swapForY ? pool.tokenX.publicKey : pool.tokenY.publicKey,
      binArraysPubkey: swapQuote.binArraysPubkey,
      inAmount: new BN(amount.toString()),
      lbPair: pool.pubkey,
      user: wallet.publicKey,
      minOutAmount: swapQuote.minOutAmount,
      outToken: swapForY ? pool.tokenY.publicKey : pool.tokenX.publicKey,
    });

    return await this.sendVtx(wallet, swapTx, [wallet], true);
  }

  protected setConnection() {
    this.connection = new Connection(this.rpc, 'confirmed');
  }

  private async getPool(inputMint: PublicKey, outputMint: PublicKey): Promise<DLMM> {
    const lbPairs = await DLMM.default.getLbPairs(this.connection);

    const pairs = lbPairs.filter((pair) => {
      const isActive = pair.account.status === 0;
      const hasTokens = pair.account.tokenXMint && pair.account?.tokenYMint;
      const isInitialized = pair.account.activeId !== undefined && pair.account.binStep !== undefined;

      const matchesTokens =
        (pair.account.tokenXMint.equals(inputMint) && pair.account.tokenYMint.equals(outputMint)) ||
        (pair.account.tokenXMint.equals(outputMint) && pair.account.tokenYMint.equals(inputMint));

      return isActive && hasTokens && isInitialized && matchesTokens;
    });

    pairs.sort((a, b) => b.account.binStep - a.account.binStep);

    if(pairs.length === 0) {
      throw new Error(`No Meteora pool pubkey found for token pair ${inputMint.toBase58()} and ${outputMint.toBase58()}`);
    }

    const poolPublicKey = pairs[0].publicKey;

    return await DLMM.default.create(this.connection, poolPublicKey);
  }

  private async swapQuote(
    pool: DLMM,
    fromToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<SwapQuote> {
    const swapAmount = new BN(amount.toString());
    const swapForY = pool.lbPair.tokenXMint.equals(new PublicKey(fromToken));
    const binArrays = await pool.getBinArrayForSwap(swapForY);

    return pool.swapQuote(
      swapAmount,
      swapForY,
      new BN.BN(slippage),
      binArrays
    );
  }
}
