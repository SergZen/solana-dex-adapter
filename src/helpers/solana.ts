import { Keypair } from "@solana/web3.js";

export const isDevCluster = () => {
  let isDevClusterEnv = process.env["IS_DEV_CLUSTER"];

  return isDevClusterEnv?.toLowerCase() === 'true' || isDevClusterEnv === '1';
}

export const getSolanaRpc = () => {
  if(isDevCluster()) {
    return "https://api.devnet.solana.com";
  } else {
    return "https://api.mainnet-beta.solana.com";
  }
}

export const getPayerKeypair = () => {
  let privateKey = process.env["SECRET_KEY"];
  if(privateKey === undefined) {
    console.log("Add SECRET_KEY to .env!");
    process.exit(1);
  }

  const asArray = Uint8Array.from(JSON.parse(privateKey));
  return Keypair.fromSecretKey(asArray);
}
