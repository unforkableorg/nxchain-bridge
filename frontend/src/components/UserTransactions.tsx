'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

interface LogEntry {
  txHash: string;
  burnTxHash?: string;
  mintTxHash?: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  amount?: string;
  from?: string;
  to?: string;
  tokenName?: string;
}

export function UserTransactions() {
  const [burnLogs, setBurnLogs] = useState<LogEntry[]>([]);
  const [mintLogs, setMintLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { address, isConnected } = useAccount();

  useEffect(() => {
    const fetchLogs = async () => {
      if (!isConnected || !address) return;
      
      try {
        // Fetch burn logs for the connected wallet
        const burnResponse = await fetch(`/api/burn-logs?address=${address}`);
        if (!burnResponse.ok) {
          throw new Error('Failed to fetch burn logs');
        }
        const burnData = await burnResponse.json();
        if (Array.isArray(burnData)) {
          setBurnLogs(burnData);
        }

        // Fetch mint logs for the connected wallet
        const mintResponse = await fetch(`/api/mint-logs?address=${address}`);
        if (!mintResponse.ok) {
          throw new Error('Failed to fetch mint logs');
        }
        const mintData = await mintResponse.json();
        if (Array.isArray(mintData)) {
          setMintLogs(mintData);
        }
      } catch (err) {
        setError('Failed to fetch your transactions');
        console.error('Error fetching logs:', err);
      }
    };

    const interval = setInterval(fetchLogs, 60000); // Poll every minute
    fetchLogs(); // Initial fetch

    return () => clearInterval(interval);
  }, [address, isConnected]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'pending':
        return '⏳';
      case 'failed':
        return '❌';
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'pending':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'failed':
        return 'bg-red-100 border-red-300 text-red-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  if (!isConnected) {
    return null;
  }

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">Your Recent Transactions</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-800">Your Burn Transactions</h3>
          {burnLogs.length > 0 ? (
            <div className="space-y-3">
              {burnLogs.map((log) => (
                <div key={log.txHash} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(log.status)}`}>
                      {getStatusIcon(log.status)} {log.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-700">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-800">
                    <span className="font-medium">Amount: </span>
                    {log.amount} {log.tokenName}
                  </div>
                  <div className="mt-1 text-xs font-mono text-gray-700 truncate">
                    Tx: {log.txHash}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600">No burn transactions found for your wallet</div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-800">Your Mint Transactions</h3>
          {mintLogs.length > 0 ? (
            <div className="space-y-3">
              {mintLogs.map((log) => (
                <div key={log.mintTxHash} className="p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusStyle(log.status)}`}>
                      {getStatusIcon(log.status)} {log.status.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-700">{formatTimestamp(log.timestamp)}</span>
                  </div>
                  <div className="mt-2 text-sm text-gray-800">
                    <span className="font-medium">Amount: </span>
                    {log.amount} {log.tokenName}
                  </div>
                  <div className="mt-1 text-xs font-mono text-gray-700 truncate">
                    Burn Tx: {log.burnTxHash}
                  </div>
                  <div className="mt-1 text-xs font-mono text-gray-700 truncate">
                    Mint Tx: {log.mintTxHash}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-600">No mint transactions found for your wallet</div>
          )}
        </div>
      </div>
    </div>
  );
} 