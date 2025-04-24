import { NextResponse } from 'next/server';

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

    // Filter logs by address if provided
    let logs = testBurnLogs;
    if (address) {
      logs = testBurnLogs.filter(log => 
        log.from?.toLowerCase() === address.toLowerCase()
      );
    }

    // In production, you would read from a file or database
    // const logs = JSON.parse(await fs.readFile('burn-logs.json', 'utf-8'));
    
    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error reading burn logs:', error);
    return NextResponse.json({ error: 'Failed to read burn logs' }, { status: 500 });
  }
} 