'use client';

import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSendTransaction, useWriteContract } from 'wagmi';
import type { UseWriteContractReturnType } from 'wagmi';
import { TransactionStatus } from '@/components/TransactionStatus';
import { RecentTransactions } from '@/components/RecentTransactions';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther, Hash } from 'viem';

// ABI minimal pour le contrat ERC20
const NEXSTEP_ABI = [
  {
    "constant": false,
    "inputs": [
      {
        "name": "_spender",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "approve",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {
        "name": "_to",
        "type": "address"
      },
      {
        "name": "_value",
        "type": "uint256"
      }
    ],
    "name": "transfer",
    "outputs": [
      {
        "name": "",
        "type": "bool"
      }
    ],
    "payable": false,
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

// Adresse du contrat NEXSTEP
const NEXSTEP_ADDRESS = '0x432e4997060f2385bdb32cdc8be815c6b22a8a61' as const;

// Adresse de burn par défaut avec possibilité de surcharge via .env.local
const DEFAULT_BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const BURN_ADDRESS = (process.env.NEXT_PUBLIC_BURN_ADDRESS || DEFAULT_BURN_ADDRESS) as `0x${string}`;
console.log('Configured burn address:', BURN_ADDRESS);

// Types de jetons disponibles
type TokenType = 'NEXSTEP' | 'CXS';

interface TransactionResult {
  hash: Hash;
}

export default function Home() {
  const [amount, setAmount] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<`0x${string}`>('0x0000000000000000000000000000000000000000');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string>('');
  const [isClient, setIsClient] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenType>('NEXSTEP');
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  
  const { writeContractAsync: transferNexstep } = useWriteContract();

  // Taux de conversion depuis les variables d'environnement
  const NEXSTEP_RATE = process.env.NEXT_PUBLIC_NEXSTEP_TO_REVO_RATE ? parseFloat(process.env.NEXT_PUBLIC_NEXSTEP_TO_REVO_RATE) : 1;
  const CXS_RATE = process.env.NEXT_PUBLIC_CXS_TO_REVO_RATE ? parseFloat(process.env.NEXT_PUBLIC_CXS_TO_REVO_RATE) : 1;

  // Calcul du montant de REVO à recevoir
  const revoAmount = amount ? parseFloat(amount) * (selectedToken === 'NEXSTEP' ? NEXSTEP_RATE : CXS_RATE) : 0;

  const [error, setError] = useState<string>('');

  // Effet pour s'assurer que le composant ne s'exécute que côté client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleBridge = async () => {
    if (!amount || !isConnected || !address) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Using burn address:', BURN_ADDRESS); // Debug log
      
      // Convert amount to wei (assuming 18 decimals)
      const amountWei = parseEther(amount);

      try {
        if (selectedToken === 'NEXSTEP') {
          console.log('Initiating NEXSTEP transfer to:', BURN_ADDRESS, 'amount:', amountWei.toString()); // Debug log
          const hash = await transferNexstep({
            address: NEXSTEP_ADDRESS,
            abi: NEXSTEP_ABI,
            functionName: 'transfer',
            args: [BURN_ADDRESS, amountWei],
          });
          setTxHash(hash);
        } else {
          console.log('Initiating CXS transfer to:', BURN_ADDRESS, 'amount:', amountWei.toString()); // Debug log
          const hash = await sendTransactionAsync({
            to: BURN_ADDRESS,
            value: amountWei,
          });
          setTxHash(hash);
        }
      } catch (txError: any) {
        // Gérer silencieusement les rejets de transaction
        if (txError.message?.includes('User rejected') || 
            txError.details?.includes('User rejected') ||
            txError.cause?.message?.includes('User rejected')) {
          console.log('Transaction cancelled');
          return; // Sortir silencieusement
        }
        // Relancer l'erreur si ce n'est pas un rejet utilisateur
        throw txError;
      }
    } catch (error: any) {
      console.error('Bridge error:', error);
      if (error.message?.includes('User rejected') || 
          error.details?.includes('User rejected') ||
          error.cause?.message?.includes('User rejected')) {
        // Ne rien afficher pour les rejets utilisateur
        return;
      } else if (error.message?.includes('Configuration:')) {
        setError(error.message);
      } else {
        setError('Échec du bridge. Veuillez réessayer.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransfer = async () => {
    try {
      const hash = await transferNexstep({
        address: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`,
        abi: NEXSTEP_ABI,
        functionName: 'transfer',
        args: [recipientAddress, parseEther(amount)],
      });
      setTxHash(hash);
    } catch (error) {
      console.error('Transfer error:', error);
      alert('Failed to transfer tokens. Please try again.');
    }
  };

  // Rendu côté serveur (avant l'hydratation)
  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center min-h-[50vh]">
          <div className="h-10 bg-gray-200 rounded animate-pulse w-48"></div>
        </div>
      </div>
    );
  }

  // Rendu côté client (après l'hydratation)
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-800 to-gray-900 bg-clip-text text-transparent">
          NXChain Bridge
        </h1>
        <Link 
          href="/transactions" 
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
        >
          View All Transactions
        </Link>
      </div>

      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Token
            </label>
            <div className="flex space-x-2 mb-4">
              <button
                onClick={() => setSelectedToken('NEXSTEP')}
                className={`flex-1 py-2 px-4 rounded-md text-center ${
                  selectedToken === 'NEXSTEP'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                NEXSTEP (ERC20)
              </button>
              <button
                onClick={() => setSelectedToken('CXS')}
                className={`flex-1 py-2 px-4 rounded-md text-center ${
                  selectedToken === 'CXS'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                CXS (Native)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Amount ({selectedToken})
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              className="w-full p-2 border rounded-md text-black placeholder-gray-500"
              min="0"
              step="0.000000000000000001"
            />
            {amount && (
              <div className="mt-2 text-sm text-gray-600">
                You will receive: {revoAmount.toFixed(4)} REVO
              </div>
            )}
          </div>

          <div className="hidden">
            <ConnectButton />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 text-red-700 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={isConnected ? handleBridge : () => {
              const connectButton = document.querySelector('[data-testid="rk-connect-button"]') as HTMLButtonElement;
              if (connectButton) connectButton.click();
            }}
            disabled={isConnected && (isLoading || !amount)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isConnected 
              ? (isLoading 
                ? 'Processing...' 
                : amount 
                  ? `Bridge ${amount} ${selectedToken} → ${revoAmount.toFixed(4)} REVO`
                  : `Bridge ${selectedToken}`
              )
              : 'Connecter le portefeuille'
            }
          </button>

          {chainId && (
            <div className="text-sm text-gray-600 mt-4">
              Connected to Chain ID: {chainId}
            </div>
          )}

          {txHash && <TransactionStatus txHash={txHash} />}
        </div>
      </div>

      <RecentTransactions />
    </div>
  );
}
