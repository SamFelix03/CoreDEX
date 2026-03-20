import {
  REGISTRY_ADDRESS,
  CORETIME_LEDGER_ADDRESS,
  FORWARD_MARKET_ADDRESS,
  OPTIONS_ENGINE_ADDRESS,
  YIELD_VAULT_ADDRESS,
  SETTLEMENT_ADDRESS,
  CORETIME_ORACLE_ADDRESS,
} from "@/constants";
import {
  REGISTRY_ABI,
  LEDGER_ABI,
  FORWARD_MARKET_ABI,
  OPTIONS_ENGINE_ABI,
  YIELD_VAULT_ABI,
  SETTLEMENT_ABI,
} from "@/types/contracts";

export const registryContract = {
  address: REGISTRY_ADDRESS,
  abi:     REGISTRY_ABI,
} as const;

export const ledgerContract = {
  address: CORETIME_LEDGER_ADDRESS,
  abi:     LEDGER_ABI,
} as const;

export const forwardMarketContract = {
  address: FORWARD_MARKET_ADDRESS,
  abi:     FORWARD_MARKET_ABI,
} as const;

export const optionsEngineContract = {
  address: OPTIONS_ENGINE_ADDRESS,
  abi:     OPTIONS_ENGINE_ABI,
} as const;

export const yieldVaultContract = {
  address: YIELD_VAULT_ADDRESS,
  abi:     YIELD_VAULT_ABI,
} as const;

export const settlementContract = {
  address: SETTLEMENT_ADDRESS,
  abi:     SETTLEMENT_ABI,
} as const;

/** PVM CoretimeOracle — used for strike band (same rule as ForwardMarket / OptionsEngine on-chain). */
export const coretimeOracleContract = {
  address: CORETIME_ORACLE_ADDRESS,
  abi: [
    {
      name: "spotPrice",
      type: "function",
      stateMutability: "view",
      inputs: [],
      outputs: [{ type: "uint128" }],
    },
  ] as const,
} as const;
