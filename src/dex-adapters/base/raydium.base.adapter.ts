import { Raydium, RaydiumLoadParams, TxVersion } from "@raydium-io/raydium-sdk-v2";

import { isDevCluster } from "../../helpers/solana";
import { IDEXAdapter } from "../interfaces/adapter.interface";
import { BaseAdapter } from "./base.adapter";

export abstract class RaydiumBaseAdapter extends BaseAdapter implements IDEXAdapter {
  static txVersion: TxVersion = TxVersion.V0;

  protected raydiumInit: RaydiumLoadParams = {
    connection: this.connection,
    cluster: isDevCluster() ? "devnet" : "mainnet"
  }

  protected raydium!: Raydium;

  protected constructor() {
    super();
  }

  protected async initRaydium() {
    if(!this.raydium) {
      this.raydium = await Raydium.load(this.raydiumInit)
    }
  }
}
