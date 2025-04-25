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

// Test data for burn transactions
const testBurnLogs = [
  {
    txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    status: 'success',
    timestamp: 1704067200000, // 2024-01-01 00:00:00
    amount: '1.5',
    from: '0x1234567890abcdef1234567890abcdef12345678'
  },
  {
    txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    status: 'pending',
    timestamp: 1704067140000, // 2024-01-01 00:00:00 - 1 minute
    amount: '2.0',
    from: '0xabcdef1234567890abcdef1234567890abcdef12'
  },
  {
    txHash: '0x7890abcdef1234567890abcdef1234567890abcdef1234567890abcdef123456',
    status: 'failed',
    timestamp: 1704067080000, // 2024-01-01 00:00:00 - 2 minutes
    amount: '0.5',
    from: '0x7890abcdef1234567890abcdef1234567890abcd'
  }
];

export async function GET(request: Request) {
  try {
    // Get the address from the query parameters
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    // Read logs from file
    const logsPath = path.join(process.cwd(), '..', 'data', 'burnLogs.json');
    const logsData = fs.readFileSync(logsPath, 'utf-8');
    const logs = JSON.parse(logsData);

    // Transform logs to match the expected format
    const transformedLogs = logs.map((log: any) => {
      // Convert wei to ether for human readability
      const formattedAmount = formatWeiToEther(log.amount);
      
      return {
        txHash: log.transactionHash,
        status: 'success', // Since these are confirmed transactions
        timestamp: log.timestamp * 1000, // Convert to milliseconds
        amount: formattedAmount,
        from: log.from,
        type: log.type,
        tokenName: log.type === 'native' ? 'CXS' : 'NexStep'
      };
    });

    // Filter logs by address if provided
    let filteredLogs = transformedLogs;
    if (address) {
      filteredLogs = transformedLogs.filter((log: any) => 
        log.from?.toLowerCase() === address.toLowerCase()
      );
    }

    return NextResponse.json(filteredLogs);
  } catch (error) {
    console.error('Error reading burn logs:', error);
    return NextResponse.json({ error: 'Failed to read burn logs' }, { status: 500 });
  }
} 