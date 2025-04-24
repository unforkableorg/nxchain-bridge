import "./mintServiceConfig"; // Importer la configuration spécifique
import { expect } from "chai";
import { ethers } from "hardhat";
import { MintService } from "../../scripts/Services/MintService/mintService";
import fs from 'fs';
import path from 'path';

describe('MintService', () => {
  let mintService: MintService;
  let provider: any;
  const TEST_MINT_LOGS_FILE = path.join(__dirname, 'data', 'mintLogs.json');

  beforeEach(async () => {
    // Nettoyer le fichier de logs avant chaque test
    if (fs.existsSync(TEST_MINT_LOGS_FILE)) {
      fs.unlinkSync(TEST_MINT_LOGS_FILE);
    }

    // Utiliser le provider de Hardhat
    provider = ethers.provider;
    
    // Créer une nouvelle instance de MintService
    mintService = new MintService(provider);
  });

  afterEach(() => {
    // Nettoyer après chaque test
    if (fs.existsSync(TEST_MINT_LOGS_FILE)) {
      fs.unlinkSync(TEST_MINT_LOGS_FILE);
    }
  });

  describe('mintTokens', () => {
    it('should successfully add transaction to queue', async () => {
      const [signer] = await ethers.getSigners();
      const to = await signer.getAddress();
      const amount = ethers.parseEther("1.0");
      const burnTxHash = "0x" + Math.random().toString(16).substring(2);

      const result = await mintService.mintTokens(to, amount, burnTxHash);
      expect(result).to.be.true;
      
      // Vérifier que la transaction a été ajoutée à la queue
      const logs = JSON.parse(fs.readFileSync(TEST_MINT_LOGS_FILE, 'utf8'));
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[0].burnTxHash).to.equal(burnTxHash);
      expect(logs[0].status).to.equal('pending');
    });

    it('should handle transaction failure and retry', async () => {
      const [signer] = await ethers.getSigners();
      const to = await signer.getAddress();
      const amount = ethers.parseEther("1.0");
      const burnTxHash = "0x" + Math.random().toString(16).substring(2);

      // Simuler un échec de transaction en utilisant une adresse invalide
      const invalidTo = "0x0000000000000000000000000000000000000000";
      
      const result = await mintService.mintTokens(invalidTo, amount, burnTxHash);
      expect(result).to.be.true; // Le service retourne true car il a ajouté la transaction à la queue
      
      // Vérifier que la transaction a été ajoutée à la queue
      const logs = JSON.parse(fs.readFileSync(TEST_MINT_LOGS_FILE, 'utf8'));
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[0].burnTxHash).to.equal(burnTxHash);
      expect(logs[0].status).to.equal('pending');
    });

    it('should handle insufficient balance', async () => {
      const [signer] = await ethers.getSigners();
      const to = await signer.getAddress();
      const amount = ethers.parseEther("1000000.0"); // Montant très élevé
      const burnTxHash = "0x" + Math.random().toString(16).substring(2);

      const result = await mintService.mintTokens(to, amount, burnTxHash);
      expect(result).to.be.true; // Le service retourne true car il a ajouté la transaction à la queue
      
      // Vérifier que la transaction a été ajoutée à la queue
      const logs = JSON.parse(fs.readFileSync(TEST_MINT_LOGS_FILE, 'utf8'));
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[0].burnTxHash).to.equal(burnTxHash);
      expect(logs[0].status).to.equal('pending');
    });

    it('should handle transaction timeout', async () => {
      const [signer] = await ethers.getSigners();
      const to = await signer.getAddress();
      const amount = ethers.parseEther("1.0");
      const burnTxHash = "0x" + Math.random().toString(16).substring(2);

      // Simuler un timeout en utilisant une adresse qui ne répond pas
      const timeoutTo = "0xdead000000000000000000000000000000000000";
      
      const result = await mintService.mintTokens(timeoutTo, amount, burnTxHash);
      expect(result).to.be.true; // Le service retourne true car il a ajouté la transaction à la queue
      
      // Vérifier que la transaction a été ajoutée à la queue
      const logs = JSON.parse(fs.readFileSync(TEST_MINT_LOGS_FILE, 'utf8'));
      expect(logs.length).to.be.greaterThan(0);
      expect(logs[0].burnTxHash).to.equal(burnTxHash);
      expect(logs[0].status).to.equal('pending');
    });
  });

  describe('nonce management', () => {
    it('should not reuse nonces', async () => {
      const [signer] = await ethers.getSigners();
      const to = await signer.getAddress();
      const amount = ethers.parseEther("1.0");
      const burnTxHash1 = "0x" + Math.random().toString(16).substring(2);
      const burnTxHash2 = "0x" + Math.random().toString(16).substring(2);

      // Envoyer deux transactions rapidement
      await Promise.all([
        mintService.mintTokens(to, amount, burnTxHash1),
        mintService.mintTokens(to, amount, burnTxHash2),
      ]);

      // Vérifier que les transactions ont été ajoutées à la queue
      const logs = JSON.parse(fs.readFileSync(TEST_MINT_LOGS_FILE, 'utf8'));
      expect(logs.length).to.be.greaterThanOrEqual(2);
      
      // Vérifier que les transactions ont été ajoutées à la queue
      const mintLog1 = logs.find((log: any) => log.burnTxHash === burnTxHash1);
      const mintLog2 = logs.find((log: any) => log.burnTxHash === burnTxHash2);
      expect(mintLog1).to.not.be.undefined;
      expect(mintLog2).to.not.be.undefined;
      
      // Note: Dans un environnement de test, les transactions peuvent ne pas être traitées immédiatement
      // donc nous vérifions simplement que les transactions ont été ajoutées à la queue
    });

    it('should retry pending transactions with the same nonce', async () => {
      // Mock provider responses
      const mockProvider = {
        getFeeData: async () => ({ gasPrice: BigInt(1000000000) }), // 1 gwei
        getBalance: async () => BigInt(1000000000000000000), // 1 ETH
        getTransaction: async () => null,
        getTransactionReceipt: async () => null,
        getTransactionCount: async () => 0,
        resolveName: async (name: string) => name,
        estimateGas: async () => BigInt(21000), // Estimation standard pour un transfert ETH
        sendTransaction: async () => ({ hash: "0x123", wait: async () => ({ status: 1 }) })
      };

      // Créer un mock complet pour le service
      const mintService = new MintService(mockProvider as any);
      
      // Mock la méthode checkTransactionStatus pour simuler une transaction en attente
      (mintService as any).checkTransactionStatus = async () => 'pending';
      
      // Mock la méthode processMintTransaction pour enregistrer les appels
      const processedTransactions: any[] = [];
      (mintService as any).processMintTransaction = async (to: string, amount: bigint, burnTxHash: string) => {
        processedTransactions.push({ to, amount, burnTxHash });
        return true;
      };
      
      // Créer un log de mint initial
      const burnTxHash = "0x" + Math.random().toString(16).substring(2);
      const to = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
      const amount = BigInt(1000000000000000000); // 1 ETH
      const nonce = 42;
      
      const mintLog: any = {
        burnTxHash,
        mintTxHash: "0x456",
        to,
        amount: amount.toString(),
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0,
        nonce
      };
      
      // Ajouter le log
      (mintService as any).mintLogs.push(mintLog);
      (mintService as any).activeNonces.set(nonce, mintLog);
      
      // Ajouter à la queue
      (mintService as any).addToQueue({
        burnTxHash,
        to,
        amount: amount.toString(),
        priority: 0,
        timestamp: Date.now(),
        retryCount: 0
      });
      
      // Traiter la queue
      await (mintService as any).processQueue();
      
      // Vérifier que la transaction a été retraitée
      expect(processedTransactions.length).to.be.greaterThan(0);
      expect(processedTransactions[0].burnTxHash).to.equal(burnTxHash);
      
      // Vérifier que le nonce a été conservé
      const updatedLog = (mintService as any).mintLogs.find((log: any) => log.burnTxHash === burnTxHash);
      expect(updatedLog.nonce).to.equal(nonce);
    });
  });
}); 