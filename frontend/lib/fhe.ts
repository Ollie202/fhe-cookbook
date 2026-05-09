'use client';
import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk';

let instancePromise: ReturnType<typeof createInstance> | null = null;

export function getFheInstance() {
  if (!instancePromise) instancePromise = createInstance(SepoliaConfig);
  return instancePromise;
}

export const AUCTION_ADDRESS = (process.env.NEXT_PUBLIC_AUCTION_ADDRESS ?? '0x0') as `0x${string}`;
export const TOKEN_ADDRESS = (process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? '0x0') as `0x${string}`;
export const VOTE_ADDRESS = (process.env.NEXT_PUBLIC_VOTE_ADDRESS ?? '0x0') as `0x${string}`;

export const AUCTION_ABI = [
  {
    type: 'function',
    name: 'bid',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'encBid', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestSettlement',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ name: 'requestId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deadline',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'settled',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'revealedBid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'revealedWinner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'itemDescription',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
] as const;
