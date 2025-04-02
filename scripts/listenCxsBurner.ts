import { ethers } from "hardhat";

async function main() {
  // Adresse du contrat CxsBurner (à remplacer par l'adresse réelle après déploiement)
  const cxsBurnerAddress = "";
  
  // Connexion au réseau
  const provider = new ethers.JsonRpcProvider("https://rpc.nxchainscan.com/");
  
  // Création d'une instance du contrat avec le provider
  const CxsBurner = await ethers.getContractFactory("CxsBurner");
  const cxsBurner = CxsBurner.attach(cxsBurnerAddress).connect(provider);

  console.log("Démarrage de l'écoute des événements CxsBurner...");

  // Écoute de l'événement CxsReceived
  cxsBurner.on("CxsReceived", (from, amount, event) => {
    console.log("\nNouvelle transaction CXS reçue:");
    console.log(`De: ${from}`);
    console.log(`Montant: ${ethers.formatEther(amount)} CXS`);
    console.log(`Hash de la transaction: ${event.log.transactionHash}`);
  });

  // Écoute de l'événement CxsBurned
  cxsBurner.on("CxsBurned", (amount, event) => {
    console.log("\nCXS brûlés:");
    console.log(`Montant brûlé: ${ethers.formatEther(amount)} CXS`);
    console.log(`Hash de la transaction: ${event.log.transactionHash}`);
  });

  // Gestion des erreurs
  cxsBurner.on("error", (error) => {
    console.error("Erreur lors de l'écoute des événements:", error);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 