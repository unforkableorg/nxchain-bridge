import dotenv from 'dotenv';
dotenv.config();
import { expect } from "chai";
import { setTestMode } from "../../scripts/configProcess";
import { processTransactionsInBatches } from "../../scripts/ProcessTransaction/processTransaction";
import fs from 'fs';
import { getBurnLogsFile, getMintLogsFile } from "../../scripts/configProcess";


describe("Bridge Process Tests", () => {
    // we need to delete the data folder and create the test data folder
    before(() => {
        // Activer le mode test
        setTestMode(true);
        
        // Supprimer les fichiers de log dans le dossier data test
        const burnLogsFile = getBurnLogsFile();
        const mintLogsFile = getMintLogsFile();
        
        if (fs.existsSync(burnLogsFile)) {
            fs.unlinkSync(burnLogsFile);
        }
        if (fs.existsSync(mintLogsFile)) {
            fs.unlinkSync(mintLogsFile);
        }
    });

  it("should process all blocks from 21804739 to 21805739", async () => {
    // Exécuter processTransactionsInBatches 
    await processTransactionsInBatches(21804739, 21805739);
  });
  // check if the burnLogs.json and mintLogs.json are created
  it("should create the burnLogs.json and mintLogs.json files", () => {
    const burnLogsFile = getBurnLogsFile();
    const mintLogsFile = getMintLogsFile();
    expect(fs.existsSync(burnLogsFile)).to.be.true;
    expect(fs.existsSync(mintLogsFile)).to.be.true;
  });

});


