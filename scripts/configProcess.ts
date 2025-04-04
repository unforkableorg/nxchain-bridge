import { ethers } from "ethers";
import path from 'path';

// Configuration des dossiers
export const DATA_DIR = path.join(process.cwd(), "data");
export const LAST_PROCESSED_BLOCK_FILE = path.join(DATA_DIR, 'lastProcessedBlock.json');
export const BURN_LOGS_FILE = path.join(DATA_DIR, 'burnLogs.json');
export const MINT_LOGS_FILE = path.join(DATA_DIR, 'mintLogs.json');
export const PROCESSED_TX_FILE = path.join(DATA_DIR, 'processed_transactions.json');

// Configuration des paramètres
export const CONFIRMATIONS_REQUIRED = 10;
export const PROCESS_INTERVAL = 5 * 60 * 1000; // 5 minutes
export const BATCH_SIZE = 1000;

// Configuration des RPC
export const NXCHAIN_RPC_URL = process.env.NXCHAIN_RPC_URL || "https://rpc.nxchainscan.com/";
export const SUBSTRATE_EVM_RPC_URL = process.env.SUBSTRATE_EVM_RPC_URL;

if (!SUBSTRATE_EVM_RPC_URL) {
  throw new Error("SUBSTRATE_EVM_RPC_URL n'est pas configuré");
}

// Initialisation des providers
export const nxchainProvider = new ethers.JsonRpcProvider(NXCHAIN_RPC_URL);
export const substrateProvider = new ethers.JsonRpcProvider(SUBSTRATE_EVM_RPC_URL);

// Adresses
export const BURN_ADDRESS = process.env.BURN_ADDRESS as string;
export const NEXSTEP_TOKEN_ADDRESS = "0x432e4997060f2385bdb32cdc8be815c6b22a8a61";

// Taux de conversion
export const NATIVE_CONVERSION_RATE = process.env.NATIVE_CONVERSION_RATE ? Number(process.env.NATIVE_CONVERSION_RATE) : 0.001;
export const ERC20_CONVERSION_RATE = process.env.ERC20_CONVERSION_RATE ? Number(process.env.ERC20_CONVERSION_RATE) : 0.002;

// Interface pour les logs
export interface BurnLog {
  from: string;
  amount: bigint;
  originalAmount: bigint;
  transactionHash: string;
  type: 'native' | 'erc20';
  blockNumber: number;
  timestamp: number;
} 