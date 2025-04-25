import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Fonction pour formater les montants de wei en ether
function formatWeiToEther(wei: string): string {
  // Convertir la chaîne en nombre
  const weiNumber = BigInt(wei);
  // Diviser par 10^18 pour obtenir l'ether
  const etherNumber = Number(weiNumber) / 1e18;
  // Formater avec 4 décimales maximum
  return etherNumber.toFixed(4);
}

// Test data for mint transactions
const testMintLogs = [
  {
    burnTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    mintTxHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    status: 'success',
    timestamp: 1704067200000, // 2024-01-01 00:00:00
    amount: '1.5',
    to: '0x1234567890abcdef1234567890abcdef12345678'
  },
  {
    burnTxHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    mintTxHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    status: 'pending',
    timestamp: 1704067140000, // 2024-01-01 00:00:00 - 1 minute
    amount: '2.0',
    to: '0xabcdef1234567890abcdef1234567890abcdef12'
  },
  {
    burnTxHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    mintTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    status: 'failed',
    timestamp: 1704067080000, // 2024-01-01 00:00:00 - 2 minutes
    amount: '0.5',
    to: '0x7890abcdef1234567890abcdef1234567890abcd'
  }
];

export async function GET(request: Request) {
  try {
    // Get the address from the query parameters
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    // Read logs from file
    const logsPath = path.join(process.cwd(), '..', 'data', 'mintLogs.json');
    const logsData = fs.readFileSync(logsPath, 'utf-8');
    const logs = JSON.parse(logsData);

    // Transform logs to match the expected format
    const transformedLogs = logs.map((log: any) => {
      // Convert wei to ether for human readability
      const formattedAmount = formatWeiToEther(log.amount);
      
      return {
        burnTxHash: log.burnTxHash,
        mintTxHash: log.mintTxHash,
        status: log.status === 'completed' ? 'success' : log.status === 'processing' ? 'pending' : 'failed',
        timestamp: log.timestamp,
        amount: formattedAmount,
        to: log.to,
        tokenName: 'REVO'
      };
    });

    // Filter logs by address if provided
    let filteredLogs = transformedLogs;
    if (address) {
      filteredLogs = transformedLogs.filter((log: any) => 
        log.to?.toLowerCase() === address.toLowerCase()
      );
    }

    return NextResponse.json(filteredLogs);
  } catch (error) {
    console.error('Error reading mint logs:', error);
    return NextResponse.json({ error: 'Failed to read mint logs' }, { status: 500 });
  }
} 