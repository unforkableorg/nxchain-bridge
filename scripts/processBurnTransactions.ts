import { ethers } from "ethers";
import { mintNewTokens } from './mintTokens';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const DATA_DIR = path.join(__dirname, '../data');
const LAST_PROCESSED_BLOCK_FILE = path.join(DATA_DIR, 'lastProcessedBlock.json');
const BURN_LOGS_FILE = path.join(DATA_DIR, 'burnLogs.json');
const CONFIRMATIONS_REQUIRED = 10;
const PROCESS_INTERVAL = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 1000; // Taille maximale des lots de blocs

// Créer le répertoire data s'il n'existe pas
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface LastProcessedBlock {
  lastProcessedBlock: number;
}

interface BurnLog {
  from: string;
  amount: bigint; // montant converti
  originalAmount: bigint; // montant original
  transactionHash: string;
  type: 'native' | 'erc20';
  blockNumber: number;
  timestamp: number;
}

function loadLastProcessedBlock(): number {
  try {
    const data = fs.readFileSync(LAST_PROCESSED_BLOCK_FILE, 'utf8');
    const json: LastProcessedBlock = JSON.parse(data);
    return json.lastProcessedBlock;
  } catch (error) {
    console.log("Aucun block traité précédemment trouvé, démarrage depuis le block 0");
    return 0;
  }
}

function saveLastProcessedBlock(blockNumber: number) {
  const data: LastProcessedBlock = { lastProcessedBlock: blockNumber };
  fs.writeFileSync(LAST_PROCESSED_BLOCK_FILE, JSON.stringify(data, null, 2));
}

function loadBurnLogs(): BurnLog[] {
  try {
    if (fs.existsSync(BURN_LOGS_FILE)) {
      const data = fs.readFileSync(BURN_LOGS_FILE, 'utf8');
      const parsedLogs = JSON.parse(data);
      return parsedLogs.map((log: any) => ({
        ...log,
        amount: BigInt(log.amount),
        // Si originalAmount n'existe pas, utiliser amount comme originalAmount
        originalAmount: log.originalAmount ? BigInt(log.originalAmount) : BigInt(log.amount)
      }));
    }
  } catch (error) {
    console.error("Erreur lors du chargement des logs de burn:", error);
  }
  return [];
}

function saveBurnLogs(logs: BurnLog[]) {
  try {
    // Convertir les BigInt en chaînes de caractères avant la sérialisation
    const serializableLogs = logs.map(log => ({
      ...log,
      amount: log.amount.toString(), // Convertir BigInt en string
      originalAmount: log.originalAmount.toString() // Convertir BigInt en string
    }));
    fs.writeFileSync(BURN_LOGS_FILE, JSON.stringify(serializableLogs, null, 2));
  } catch (error) {
    console.error("Erreur lors de la sauvegarde des logs de burn:", error);
  }
}

// Fonction pour dédupliquer les logs
function deduplicateLogs(logs: any[]): any[] {
  const uniqueLogs = new Map();
  
  for (const log of logs) {
    const key = `${log.transactionHash}-${log.blockNumber}-${log.logIndex}`;
    if (!uniqueLogs.has(key)) {
      uniqueLogs.set(key, log);
    }
  }
  
  return Array.from(uniqueLogs.values());
}

export async function processTransactionsInBatches(fromBlock: number, toBlock: number, provider: any) {
  let currentBlock = fromBlock;
  let lastProcessedBlock = fromBlock - 1;

  while (currentBlock <= toBlock) {
    const batchEndBlock = Math.min(currentBlock + BATCH_SIZE - 1, toBlock);
    console.log(`Traitement du lot de blocs ${currentBlock} à ${batchEndBlock}`);
    
    try {
      await processTransactions(currentBlock, batchEndBlock, provider);
      lastProcessedBlock = batchEndBlock;
    } catch (error) {
      console.error(`Erreur lors du traitement des blocs ${currentBlock} à ${batchEndBlock}:`, error);
      // En cas d'erreur, on sauvegarde le dernier block traité avec succès
      saveLastProcessedBlock(lastProcessedBlock);
      throw error;
    }

    currentBlock = batchEndBlock + 1;
  }

  return lastProcessedBlock;
}

export async function processTransactions(fromBlock: number, toBlock: number, provider: any) {
  const burnAddress = process.env.BURN_ADDRESS || "";
  if (!burnAddress) {
    throw new Error("L'adresse de burn n'est pas configurée dans le fichier .env");
  }

  const nexstepTokenAddress = "0x432e4997060f2385bdb32cdc8be815c6b22a8a61";
  const nativeConversionRate = process.env.NATIVE_CONVERSION_RATE ? parseFloat(process.env.NATIVE_CONVERSION_RATE) : 1.0;
  const erc20ConversionRate = process.env.ERC20_CONVERSION_RATE ? parseFloat(process.env.ERC20_CONVERSION_RATE) : 1.0;

  console.log(`Traitement des blocks de ${fromBlock} à ${toBlock}`);
  console.log(`Taux de conversion natif: ${nativeConversionRate}`);
  console.log(`Taux de conversion ERC20: ${erc20ConversionRate}`);

  // Charger les logs existants
  const existingLogs = loadBurnLogs();
  // Créer un Set avec uniquement les transactionHash pour détecter les doublons
  const processedTxHashes = new Set(existingLogs.map(log => log.transactionHash));

  // Récupérer tous les transferts natifs vers l'adresse de burn
  const nativeFilter = {
    fromBlock: fromBlock,
    toBlock: toBlock,
    to: burnAddress
  };

  // Récupérer les transferts du token NexStep vers l'adresse de burn
  const erc20Filter = {
    fromBlock: fromBlock,
    toBlock: toBlock,
    address: nexstepTokenAddress,
    topics: [
      ethers.id("Transfer(address,address,uint256)"),
      null,
      ethers.zeroPadValue(burnAddress, 32)
    ]
  };

  // Récupérer et dédupliquer les logs
  const nativeLogs = deduplicateLogs(await provider.getLogs(nativeFilter));
  const erc20Logs = deduplicateLogs(await provider.getLogs(erc20Filter));
  
  console.log(`Nombre de logs natifs uniques: ${nativeLogs.length}`);
  console.log(`Nombre de logs ERC20 uniques: ${erc20Logs.length}`);
  
  const newLogs: BurnLog[] = [];

  // Traiter les transferts natifs
  for (const log of nativeLogs) {
    // Vérifier si la transaction a déjà été traitée
    if (processedTxHashes.has(log.transactionHash)) {
      console.log(`Transaction ${log.transactionHash} déjà traitée, ignorée.`);
      continue;
    }

    const tx = await provider.getTransaction(log.transactionHash);
    if (!tx) continue;

    const block = await provider.getBlock(log.blockNumber);
    if (!block) continue;

    const amount = tx.value;
    // Ignorer les transactions avec un montant de 0
    if (amount === 0n) {
      console.log(`Transaction ${log.transactionHash} ignorée car le montant est 0`);
      continue;
    }

    // Appliquer la conversion pour les jetons natifs
    const convertedAmount = (amount * BigInt(Math.floor(nativeConversionRate * 1000000))) / BigInt(1000000);
    
    console.log(`\nTransaction CXS reçue:`);
    console.log(`De: ${tx.from}`);
    console.log(`Montant original: ${ethers.formatEther(amount)} CXS`);
    console.log(`Montant converti: ${ethers.formatEther(convertedAmount)} CXS`);
    console.log(`Hash de la transaction: ${log.transactionHash}`);

    // Ajouter le log
    newLogs.push({
      from: tx.from,
      amount: convertedAmount,
      originalAmount: amount,
      transactionHash: log.transactionHash,
      type: 'native',
      blockNumber: log.blockNumber,
      timestamp: block.timestamp
    });

    // Appel de la fonction de minting avec le montant converti
    const success = await mintNewTokens(tx.from, convertedAmount, log.transactionHash);
    if (success) {
      console.log(`Transfert des tokens initié avec succès pour l'adresse ${tx.from}`);
    } else {
      console.log(`Échec du transfert des tokens pour l'adresse ${tx.from}`);
    }
  }

  // Traiter les transferts ERC20
  for (const log of erc20Logs) {
    // Vérifier si la transaction a déjà été traitée
    if (processedTxHashes.has(log.transactionHash)) {
      console.log(`Transaction ${log.transactionHash} déjà traitée, ignorée.`);
      continue;
    }

    const tx = await provider.getTransaction(log.transactionHash);
    if (!tx) continue;

    const block = await provider.getBlock(log.blockNumber);
    if (!block) continue;

    // Décoder les données du log ERC20
    const iface = new ethers.Interface(["event Transfer(address indexed from, address indexed to, uint256 value)"]);
    const decodedLog = iface.parseLog(log);
    
    if (decodedLog) {
      const from = decodedLog.args[0];
      const amount = decodedLog.args[2];
      
      // Ignorer les transactions avec un montant de 0
      if (amount === 0n) {
        console.log(`Transaction ${log.transactionHash} ignorée car le montant est 0`);
        continue;
      }

      // Appliquer la conversion pour les ERC20
      const convertedAmount = (amount * BigInt(Math.floor(erc20ConversionRate * 1000000))) / BigInt(1000000);
      
      console.log(`\nTransaction NexStep reçue:`);
      console.log(`De: ${from}`);
      console.log(`Montant original: ${ethers.formatEther(amount)} NexStep`);
      console.log(`Montant converti: ${ethers.formatEther(convertedAmount)} NexStep`);
      console.log(`Hash de la transaction: ${log.transactionHash}`);

      // Ajouter le log
      newLogs.push({
        from: from,
        amount: convertedAmount,
        originalAmount: amount,
        transactionHash: log.transactionHash,
        type: 'erc20',
        blockNumber: log.blockNumber,
        timestamp: block.timestamp
      });

      // Appel de la fonction de minting avec le montant converti
      const success = await mintNewTokens(from, convertedAmount, log.transactionHash);
      if (success) {
        console.log(`Transfert des tokens initié avec succès pour l'adresse ${from}`);
      } else {
        console.log(`Échec du transfert des tokens pour l'adresse ${from}`);
      }
    }
  }

  // Sauvegarder les nouveaux logs
  if (newLogs.length > 0) {
    const allLogs = [...existingLogs, ...newLogs];
    saveBurnLogs(allLogs);
    console.log(`\n${newLogs.length} nouveaux logs sauvegardés dans ${BURN_LOGS_FILE}`);
  }
}

async function main() {
  const RPC_URL = process.env.NXCHAIN_RPC_URL || "https://rpc.nxchainscan.com/";

  console.log(`Démarrage du bridge pour l'adresse de burn`);
  console.log(`RPC NXChain: ${RPC_URL}`);
  console.log(`RPC Substrate: ${process.env.SUBSTRATE_EVM_RPC_URL}`);

  while (true) {
    try {
      console.log("Connexion au réseau NXChain...");
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      
      // Vérification de la connexion
      await provider.getNetwork();
      console.log("Connecté au réseau NXChain");

      const lastProcessedBlock = loadLastProcessedBlock();
      const currentBlock = await provider.getBlockNumber();
      const targetBlock = currentBlock - CONFIRMATIONS_REQUIRED;

      if (targetBlock > lastProcessedBlock) {
        const newLastProcessedBlock = await processTransactionsInBatches(lastProcessedBlock + 1, targetBlock, provider);
        saveLastProcessedBlock(newLastProcessedBlock);
      } else {
        console.log("Aucun nouveau block à traiter");
      }

      // Attendre l'intervalle avant la prochaine vérification
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL));

    } catch (error) {
      console.error("Erreur:", error);
      console.log(`Nouvelle tentative dans ${PROCESS_INTERVAL/1000} secondes...`);
      await new Promise(resolve => setTimeout(resolve, PROCESS_INTERVAL));
    }
  }
}

// Gestion des erreurs non capturées
process.on("uncaughtException", (error) => {
  console.error("Erreur non capturée:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Promesse rejetée non gérée:", error);
});

main().catch((error) => {
  console.error("Erreur fatale:", error);
  process.exit(1);
}); 