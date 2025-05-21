import {Keypair, PublicKey, TransactionInstruction, TransactionSignature} from "@solana/web3.js";

export interface IDEXAdapter {
  // send tx and return signature
  buy(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amountIn: bigint,
    slippage: number
  ): Promise<TransactionSignature>;

  // send tx and return signature
  sell(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number
  ): Promise<TransactionSignature>;

  // send tx and return signature
  swap(
    wallet: Keypair,
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionSignature>;

  // only instruction for sell without create ATA if possible for specific platform pumpSwap, raydium, orca and other
  sellIx(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionInstruction[]>;

  // only instruction for buy without create ATA if possible for specific platform pumpSwap, raydium, orca and other
  buyIx(
    wallet: Keypair,
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint,
    slippage: number,
  ): Promise<TransactionInstruction[]>;

  // need for calc amount
  getQuote(
    fromToken: string,
    toToken: string,
    amount: bigint,
    slippage: number,
  ): Promise<bigint>;
}
