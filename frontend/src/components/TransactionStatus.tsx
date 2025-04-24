'use client';

import { useEffect, useState } from 'react';

interface TransactionStatusProps {
  txHash: string;
}

interface LogEntry {
  txHash: string;
  burnTxHash?: string;
  mintTxHash?: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  amount?: string;
  from?: string;
  to?: string;
}

export function TransactionStatus({ txHash }: TransactionStatusProps) {
  const [burnStatus, setBurnStatus] = useState<LogEntry | null>(null);
  const [mintStatus, setMintStatus] = useState<LogEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        // Fetch burn logs
        const burnResponse = await fetch('/api/burn-logs');
        if (!burnResponse.ok) {
          throw new Error('Failed to fetch burn logs');
        }
        const burnData = await burnResponse.json();
        if (Array.isArray(burnData)) {
          const burnEntry = burnData.find((log: LogEntry) => log.txHash === txHash);
          if (burnEntry) setBurnStatus(burnEntry);
        }

        // Fetch mint logs
        const mintResponse = await fetch('/api/mint-logs');
        if (!mintResponse.ok) {
          throw new Error('Failed to fetch mint logs');
        }
        const mintData = await mintResponse.json();
        if (Array.isArray(mintData)) {
          const mintEntry = mintData.find((log: LogEntry) => log.burnTxHash === txHash);
          if (mintEntry) setMintStatus(mintEntry);
        }
      } catch (err) {
        setError('Failed to fetch transaction status');
        console.error('Error fetching status:', err);
      }
    };

    const interval = setInterval(fetchStatus, 60000); // Poll every minute
    fetchStatus(); // Initial fetch

    return () => clearInterval(interval);
  }, [txHash]);

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

  if (error) {
    return <div className="text-red-600">{error}</div>;
  }

  return (
    <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
      <div className="space-y-2">
        <div className="text-sm font-medium">Burn Transaction</div>
        {burnStatus ? (
          <div className="space-y-1">
            <div className="text-sm">
              <span className="font-medium">Status: </span>
              <span className={burnStatus.status === 'success' ? 'text-green-600' : burnStatus.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}>
                {getStatusIcon(burnStatus.status)} {burnStatus.status}
              </span>
            </div>
            {burnStatus.amount && (
              <div className="text-sm">
                <span className="font-medium">Amount: </span>
                {burnStatus.amount} NX
              </div>
            )}
            <div className="text-sm">
              <span className="font-medium">Time: </span>
              {formatTimestamp(burnStatus.timestamp)}
            </div>
            <div className="text-sm">
              <span className="font-medium">Tx Hash: </span>
              <span className="font-mono text-xs">{burnStatus.txHash}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Loading burn status...</div>
        )}
      </div>

      {burnStatus?.status === 'success' && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Mint Transaction</div>
          {mintStatus ? (
            <div className="space-y-1">
              <div className="text-sm">
                <span className="font-medium">Status: </span>
                <span className={mintStatus.status === 'success' ? 'text-green-600' : mintStatus.status === 'failed' ? 'text-red-600' : 'text-yellow-600'}>
                  {getStatusIcon(mintStatus.status)} {mintStatus.status}
                </span>
              </div>
              {mintStatus.amount && (
                <div className="text-sm">
                  <span className="font-medium">Amount: </span>
                  {mintStatus.amount} NX
                </div>
              )}
              <div className="text-sm">
                <span className="font-medium">Time: </span>
                {formatTimestamp(mintStatus.timestamp)}
              </div>
              <div className="text-sm">
                <span className="font-medium">Tx Hash: </span>
                <span className="font-mono text-xs">{mintStatus.mintTxHash}</span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Waiting for mint...</div>
          )}
        </div>
      )}

      <div className="text-xs text-gray-500 mt-2">
        Note: Status updates every minute. Your transaction may be confirmed on-chain before appearing here.
      </div>
    </div>
  );
} 