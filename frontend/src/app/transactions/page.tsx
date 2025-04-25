'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';

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

export default function TransactionsPage() {
  const router = useRouter();
  const [burnLogs, setBurnLogs] = useState<LogEntry[]>([]);
  const [mintLogs, setMintLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'burn' | 'mint'>('burn');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        // Fetch burn logs
        const burnResponse = await fetch('/api/burn-logs');
        if (!burnResponse.ok) {
          throw new Error('Failed to fetch burn logs');
        }
        const burnData = await burnResponse.json();
        if (Array.isArray(burnData)) {
          setBurnLogs(burnData);
        }

        // Fetch mint logs
        const mintResponse = await fetch('/api/mint-logs');
        if (!mintResponse.ok) {
          throw new Error('Failed to fetch mint logs');
        }
        const mintData = await mintResponse.json();
        if (Array.isArray(mintData)) {
          setMintLogs(mintData);
        }
      } catch (err) {
        setError('Failed to fetch transactions');
        console.error('Error fetching logs:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, []);

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
    return new Date(timestamp).toLocaleString();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Pagination logic
  const currentLogs = activeTab === 'burn' ? burnLogs : mintLogs;
  const totalPages = Math.ceil(currentLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = currentLogs.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: number) => {
    setItemsPerPage(value);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button 
          onClick={() => router.push('/')}
          className="text-blue-600 hover:text-blue-800 flex items-center"
        >
          ← Back to Bridge
        </button>
      </div>

      <div className="mb-6 w-full flex items-center justify-center [&>div]:w-full [&>div>button]:w-full">
        <ConnectButton />
      </div>

      <h1 className="text-2xl font-bold mb-6 text-gray-800">All Transactions</h1>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => {
                setActiveTab('burn');
                setCurrentPage(1);
              }}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'burn'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Burn Transactions
            </button>
            <button
              onClick={() => {
                setActiveTab('mint');
                setCurrentPage(1);
              }}
              className={`py-4 px-6 text-center border-b-2 font-medium text-sm ${
                activeTab === 'mint'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Mint Transactions
            </button>
          </nav>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">Loading transactions...</div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">Show</span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-sm text-gray-600">entries</span>
            </div>
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, currentLogs.length)} of {currentLogs.length} entries
            </div>
          </div>

          {activeTab === 'burn' ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      From
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tx Hash
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.length > 0 ? (
                    currentItems.map((log) => (
                      <tr key={log.txHash} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle(log.status)}`}>
                            {getStatusIcon(log.status)} {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.amount} {log.tokenName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatAddress(log.from || '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                          <a 
                            href={`https://ethernal.nxchainscan.com/transaction/${log.txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {formatAddress(log.txHash)}
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No burn transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      To
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Burn Tx
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Mint Tx
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentItems.length > 0 ? (
                    currentItems.map((log) => (
                      <tr key={log.mintTxHash} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle(log.status)}`}>
                            {getStatusIcon(log.status)} {log.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.amount} {log.tokenName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatAddress(log.to || '')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                          <a 
                            href={`https://ethernal.nxchainscan.com/transaction/${log.burnTxHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {formatAddress(log.burnTxHash || '')}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-500">
                          <a 
                            href={`#`}
                            className="text-gray-500 hover:text-gray-700 cursor-not-allowed"
                          >
                            {formatAddress(log.mintTxHash || '')}
                          </a>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                        No mint transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {currentLogs.length > 0 && (
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  First
                </button>
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1 rounded ${
                    currentPage === 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Next
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1 rounded ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 