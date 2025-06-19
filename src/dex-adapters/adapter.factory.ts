import { IDEXAdapter } from "./interfaces/adapter.interface";

import { RaydiumAmmAdapter } from "./implementations/raydium.amm.adapter";
import { RaydiumClmmAdapter } from "./implementations/raydium.clmm.adapter";
import { RaydiumCpmmAdapter } from "./implementations/raydium.cpmm.adapter";
import { MeteoraDlmmAdapter } from "./implementations/meteora.dlmm.adapter";
import {OrcaClmmAdapter} from "./implementations/orca.clmm.adapter";

export enum AdapterType {
  RAYDIUM_AMM = "raydium-amm",
  RAYDIUM_CPMM = "raydium-cpmm",
  RAYDIUM_CLMM = "raydium-clmm",
  METEORA_DLMM = "meteora-dlmm",
  ORCA_CLMM = 'orca-clmm',
}

export class AdaptorFactory {
  static create(dex: AdapterType): IDEXAdapter {
    switch (dex) {
      case AdapterType.RAYDIUM_AMM:
        return new RaydiumAmmAdapter();
      case AdapterType.RAYDIUM_CLMM:
        return new RaydiumClmmAdapter();
      case AdapterType.RAYDIUM_CPMM:
        return new RaydiumCpmmAdapter();
      case AdapterType.METEORA_DLMM:
        return new MeteoraDlmmAdapter();
      case AdapterType.ORCA_CLMM:
        return new OrcaClmmAdapter();
      default:
        throw new Error(`Unsupported DEX: ${dex}`);
    }
  }
}
