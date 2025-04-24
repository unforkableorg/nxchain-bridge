'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSendTransaction } from 'wagmi';
import { TransactionStatus } from '@/components/TransactionStatus';
import { RecentTransactions } from '@/components/RecentTransactions';
import Link from 'next/link';

// Types de jetons disponibles
type TokenType = 'NEXSTEP' | 'CXS';

export default function Home() {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [selectedToken, setSelectedToken] = useState<TokenType>('NEXSTEP');
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();

  // Effet pour s'assurer que le composant ne s'exécute que côté client
  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleBridge = async () => {
    if (!amount || !isConnected || !address) return;
    
    setIsLoading(true);
    try {
      const burnAddress = process.env.NEXT_PUBLIC_BURN_ADDRESS;
      if (!burnAddress) {
        throw new Error('Burn address not configured');
      }

      // Convert amount to wei (assuming 18 decimals)
      const amountWei = BigInt(Math.floor(parseFloat(amount) * 1e18));

      if (selectedToken === 'NEXSTEP') {
        // Logique pour le jeton ERC20 NEXSTEP
        // Ici, vous devriez appeler la fonction approve du contrat NEXSTEP
        // puis appeler la fonction burn du contrat Bridge
        console.log('Burning NEXSTEP tokens...');
        // Exemple de code (à adapter selon vos contrats) :
        // const nexstepContract = new ethers.Contract(NEXSTEP_ADDRESS, NEXSTEP_ABI, signer);
        // await nexstepContract.approve(BRIDGE_ADDRESS, amountWei);
        // const bridgeContract = new ethers.Contract(BRIDGE_ADDRESS, BRIDGE_ABI, signer);
        // const tx = await bridgeContract.burn(amountWei);
        // setTxHash(tx.hash);
      } else {
        // Logique pour le jeton natif CXS
        // Envoyer une transaction native
        const hash = await sendTransactionAsync({
          to: burnAddress as `0x${string}`,
          value: amountWei,
        });
        setTxHash(hash);
      }
    } catch (error) {
      console.error('Bridge error:', error);
      alert('Failed to bridge tokens. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Rendu côté serveur (avant l'hydratation)
  if (!isClient) {
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
          <div className="mb-6">
            <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
          </div>
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
        <div className="mb-6">
          <ConnectButton />
        </div>

        {isConnected && (
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
            </div>

            <button
              onClick={handleBridge}
              disabled={isLoading || !amount}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Processing...' : `Bridge ${selectedToken}`}
            </button>

            {chainId && (
              <div className="text-sm text-gray-600 mt-4">
                Connected to Chain ID: {chainId}
              </div>
            )}

            {txHash && <TransactionStatus txHash={txHash} />}
          </div>
        )}
      </div>

      <RecentTransactions />
    </div>
  );
}
