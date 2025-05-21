import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey, SystemProgram, Transaction,
  TransactionInstruction, TransactionMessage,
  TransactionSignature, VersionedTransaction
} from "@solana/web3.js";
import "dotenv/config"

import { getSolanaRpc } from "../../helpers/solana";
import { IDEXAdapter } from "../interfaces/adapter.interface";

export abstract class BaseAdapter implements IDEXAdapter {
  protected PERCENT_BPS = 10_000n;
  protected connection: any;
  protected rpc: any;

  protected constructor() {
    this.rpc = getSolanaRpc();
    this.setConnection();
  }

  protected abstract setConnection(): void;

  async sendVtx(
    payer: Keypair,
    tx: Transaction | VersionedTransaction,
    signers: Keypair[],
    needCompute: boolean = false
  ): Promise<string> {
    let vTx;

    if(tx instanceof Transaction) {
      const blockHash = await this.connection.getLatestBlockhash()

      const messageV0 = new TransactionMessage({
        payerKey: payer.publicKey,
        recentBlockhash: blockHash.blockhash,
        instructions: tx.instructions, // Include the instructions from the transaction
      }).compileToV0Message() // Use [] if no address lookup tables are used

      if (needCompute) {
        tx.add(
          ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 100000,
          })
        )
      }

      // Wrap into VersionedTransaction
      vTx = new VersionedTransaction(messageV0)
    } else {
      vTx = tx
    }

    vTx.sign(signers)

    // const simulate = await solanaConnection.simulateTransaction(vTx)

    // if (simulate.value.err) {
    //   throw simulate.value.err
    // }

    return await this.connection.sendTransaction(vTx)
  }

  protected addFeeToTx(
    tx: Transaction,
    from: PublicKey,
    feeAmount: bigint,
    service: {
      wallet: PublicKey
      percent: number
    },
    referrals: {
      wallet: PublicKey
      percent: number
    }[]
  ) {
    console.log('referral', referrals)

    if (feeAmount > 0n) {
      let amount = feeAmount

      for (const referral of referrals) {
        amount =
          (amount * BigInt(Math.floor(referral.percent * 100))) / this.PERCENT_BPS;

        feeAmount -= amount

        if (amount > 0n) {
          tx.add(
            SystemProgram.transfer({
              fromPubkey: from,
              toPubkey: referral.wallet,
              lamports: amount + 890880n,
            })
          )
        }
      }

      if (feeAmount > 0n) {
        tx.add(
          SystemProgram.transfer({
            fromPubkey: from,
            toPubkey: service.wallet,
            lamports: feeAmount,
          })
        )
      }
    }
  }

  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature> {
    return this.swap(
      wallet,
      inputMint.toString(),
      outputMint.toString(),
      amount,
      slippage,
    );
  }

  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature> {
    return this.swap(
      wallet,
      outputMint.toString(),
      inputMint.toString(),
      amount,
      slippage,
    );
  }

  abstract getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint>;

  abstract swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature>;

  async buyIx(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionInstruction[]> {
    throw new Error("Method not implemented.");
  }

  async sellIx(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionInstruction[]> {
    throw new Error("Method not implemented.");
  }
}
