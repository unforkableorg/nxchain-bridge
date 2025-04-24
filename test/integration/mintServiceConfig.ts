// Définir les variables d'environnement avant d'importer configProcess
process.env.SUBSTRATE_EVM_RPC_URL = "http://localhost:8545";
process.env.NXCHAIN_RPC_URL = "http://localhost:8545";
process.env.BURN_ADDRESS = "0x0000000000000000000000000000000000000000";
process.env.RESERVE_ACCOUNT_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
process.env.NATIVE_CONVERSION_RATE = "1";
process.env.ERC20_CONVERSION_RATE = "1";

// Importer configProcess après avoir défini les variables d'environnement
import { setTestMode } from "../../scripts/configProcess";
setTestMode(true); 