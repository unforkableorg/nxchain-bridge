'use client';

import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NXCHAIN } from '@/config/chains';
import '@rainbow-me/rainbowkit/styles.css';
import { injectedWallet, metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';

// Configuration avec seulement MetaMask et Injected wallets
const config = getDefaultConfig({
  appName: 'NXChain Bridge',
  projectId: '00000000000000000000000000000000',
  chains: [NXCHAIN],
  ssr: false,
  wallets: [
    {
      groupName: 'Recommended',
      wallets: [
        injectedWallet,
        metaMaskWallet,
      ],
    },
  ],
});

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
} 