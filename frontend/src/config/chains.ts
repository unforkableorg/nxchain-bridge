import { Chain } from 'wagmi';

export const CXS_CHAIN: Chain = {
  id: 42025,
  name: 'CXS Chain',
  network: 'cxs',
  nativeCurrency: {
    decimals: 18,
    name: 'CXS',
    symbol: 'CXS',
  },
  rpcUrls: {
    default: {
      http: ['http://13.49.46.28:8545'],
    },
    public: {
      http: ['http://13.49.46.28:8545'],
    },
  },
  blockExplorers: {
    default: {
      name: 'CXS Explorer',
      url: 'http://13.49.46.28:4000',
    },
  },
};

export const NEXSTEP_CHAIN: Chain = {
  id: 42026,
  name: 'NexStep Chain',
  network: 'nexstep',
  nativeCurrency: {
    decimals: 18,
    name: 'NexStep',
    symbol: 'NexStep',
  },
  rpcUrls: {
    default: {
      http: ['http://13.49.46.28:8546'],
    },
    public: {
      http: ['http://13.49.46.28:8546'],
    },
  },
  blockExplorers: {
    default: {
      name: 'NexStep Explorer',
      url: 'http://13.49.46.28:4001',
    },
  },
};

export const NXCHAIN: Chain = {
  id: 785,
  name: 'NXChain',
  network: 'nxchain',
  nativeCurrency: {
    decimals: 18,
    name: 'NX',
    symbol: 'NX',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.nxchainscan.com/'],
    },
    public: {
      http: ['https://rpc.nxchainscan.com/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'NXChain Explorer',
      url: 'https://nxchainscan.com',
    },
  },
}; 