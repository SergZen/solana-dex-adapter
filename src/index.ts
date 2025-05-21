import { AdapterType, AdaptorFactory } from "./dex-adapters/adapter.factory";
import { getPayerKeypair, isDevCluster } from "./helpers/solana";
import { PublicKey } from "@solana/web3.js";

const keypair = getPayerKeypair();

let usdcAddress;
if(isDevCluster()) {
  usdcAddress = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
} else {
  usdcAddress = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
}

const solAddress = "So11111111111111111111111111111111111111112";

const adapter = AdaptorFactory.create(AdapterType.METEORA_DLMM);

const getQuote1 = await adapter.getQuote(
  usdcAddress,
  solAddress,
  100n,
  1000,
);
console.log("buy getQuote1:", getQuote1);

const buy1 = await adapter.buy(
  keypair,
  new PublicKey(usdcAddress),
  new PublicKey(solAddress),
  100n,
  100,
);

console.log("buy1 :", buy1);

const getQuoteSwap1 = await adapter.getQuote(
  usdcAddress,
  solAddress,
  100n,
  100,
);
console.log("buy swap getQuoteSwap1:", getQuoteSwap1);

const swap1 = await adapter.swap(
  keypair,
  usdcAddress,
  solAddress,
  100n,
  100,
);

console.log("buy swap1 :", swap1);

const getQuote2 = await adapter.getQuote(
  solAddress,
  usdcAddress,
  10000n,
  1000,
);
console.log("sell getQuote2:", getQuote2);

const sell1 = await adapter.sell(
  keypair,
  new PublicKey(usdcAddress),
  new PublicKey(solAddress),
  10000n,
  100,
);

console.log("sell1 :", sell1);

const getQuoteSwap2 = await adapter.getQuote(
  solAddress,
  usdcAddress,
  10000n,
  100,
);
console.log("buy swap getQuoteSwap2:", getQuoteSwap2);

const swap2 = await adapter.swap(
  keypair,
  solAddress,
  usdcAddress,
  10000n,
  100,
);

console.log("sell swap2 :", swap2);
