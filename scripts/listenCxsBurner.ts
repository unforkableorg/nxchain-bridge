import { ethers } from "hardhat";
// Import de la fonction depuis un fichier séparé
import { mintNewTokens } from './mintTokens';



async function setupEventListeners(cxsBurner: any) {
  // Écoute de l'événement CxsReceived
  cxsBurner.on("CxsReceived", (from: string, amount: bigint, event: any) => {
    console.log("\nNouvelle transaction CXS reçue:");
    console.log(`De: ${from}`);
    console.log(`Montant: ${ethers.formatEther(amount)} CXS`);
    console.log(`Hash de la transaction: ${event.log.transactionHash}`);
  });

  // Écoute de l'événement CxsBurned
  cxsBurner.on("CxsBurned", async (amount: bigint, event: any) => {
    console.log("\nCXS brûlés:");
    console.log(`Montant brûlé: ${ethers.formatEther(amount)} CXS`);
    console.log(`Hash de la transaction: ${event.log.transactionHash}`);

    // Récupérer l'adresse de l'expéditeur de la transaction
    const tx = await event.log.getTransaction();
    const from = tx.from;

    // Appel de la fonction de minting
    const success = await mintNewTokens(from, amount, event.log.transactionHash);
    if (success) {
      console.log(`Minting des tokens initié avec succès pour l'adresse ${from}`);
    } else {
      console.log(`Échec du minting des tokens pour l'adresse ${from}`);
    }
  });

  // Gestion des erreurs
  cxsBurner.on("error", (error: Error) => {
    console.error("Erreur lors de l'écoute des événements:", error);
  });
}

async function main() {
  const cxsBurnerAddress = ""; // À remplir avec l'adresse du contrat
  const RPC_URL = "https://rpc.nxchainscan.com/";
  const RECONNECT_DELAY = 5000; // 5 secondes

  while (true) {
    try {
      console.log("Connexion au réseau NXChain...");
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      
      // Vérification de la connexion
      await provider.getNetwork();
      console.log("Connecté au réseau NXChain");

      // Création d'une instance du contrat avec le provider
      const CxsBurner = await ethers.getContractFactory("CxsBurner");
      const cxsBurner = CxsBurner.attach(cxsBurnerAddress).connect(provider);

      console.log("Démarrage de l'écoute des événements CxsBurner...");
      await setupEventListeners(cxsBurner);

      // Attendre que le provider soit déconnecté
      await new Promise((resolve) => {
        provider.on("error", () => resolve(null));
        provider.on("disconnect", () => resolve(null));
      });

      console.log("Déconnexion détectée, tentative de reconnexion...");
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));

    } catch (error) {
      console.error("Erreur:", error);
      console.log(`Tentative de reconnexion dans ${RECONNECT_DELAY/1000} secondes...`);
      await new Promise(resolve => setTimeout(resolve, RECONNECT_DELAY));
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
  process.exitCode = 1;
}); 