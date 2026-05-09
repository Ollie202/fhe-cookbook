# Frontend integration — `@zama-fhe/sdk` + `@zama-fhe/react-sdk` v3

The **v3 SDK** is the current Zama frontend stack (verified against the official `fhevm-react-template`, May 2026). It supersedes the older `@zama-fhe/relayer-sdk` v0.x and the deprecated `fhevmjs`.

> **Working reference:** the official template at `https://github.com/zama-ai/fhevm-react-template` — specifically `packages/nextjs/components/DappWrapperWithProviders.tsx` (provider setup) and `packages/nextjs/hooks/fhecounter-example/useFHECounterWagmi.tsx` (full hook pattern).

## Install

```bash
pnpm add @zama-fhe/sdk @zama-fhe/react-sdk @rainbow-me/rainbowkit \
  @tanstack/react-query viem wagmi
```

The two packages split responsibility:
- `@zama-fhe/sdk` — relayer transports, storage, types, low-level primitives.
- `@zama-fhe/react-sdk` — React Query-based hooks (`useEncrypt`, `useUserDecrypt`, `useAllow`, `useIsAllowed`).

## Provider setup (do this once at the app root)

```tsx
'use client';
import { ZamaProvider } from '@zama-fhe/react-sdk';
import {
  IndexedDBStorage,
  RelayerWeb,
  SepoliaConfig,
} from '@zama-fhe/sdk';
import { RelayerCleartext, hardhatCleartextConfig } from '@zama-fhe/sdk/cleartext';
import { useChainId, WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { wagmiConfig } from './wagmi';
import { WagmiSigner } from './wagmiSigner';

const signer = new WagmiSigner({ config: wagmiConfig });
const storage = new IndexedDBStorage('KeypairStore', 1);
const sessionStorage = new IndexedDBStorage('SignatureStore', 1);

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});

function ZamaRuntime({ children }: { children: React.ReactNode }) {
  const chainId = useChainId();
  const relayer = useMemo(() => {
    if (chainId === 31337) return new RelayerCleartext(hardhatCleartextConfig);
    return new RelayerWeb({
      getChainId: () => signer.getChainId(),
      transports: { [SepoliaConfig.chainId]: SepoliaConfig },
    });
  }, [chainId]);

  return (
    <ZamaProvider relayer={relayer} signer={signer} storage={storage} sessionStorage={sessionStorage}>
      {children}
    </ZamaProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ZamaRuntime>{children}</ZamaRuntime>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

Two important details:
- `IndexedDBStorage` persists the keypair + EIP-712 session across reloads. Without it, every refresh asks the user to re-sign.
- `RelayerCleartext` is the local-anvil mock; `RelayerWeb` talks to the Sepolia/mainnet hosted relayer. Pick by `chainId`.

## Encrypting an input

```tsx
import { useEncrypt } from '@zama-fhe/react-sdk';
import { bytesToHex } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';

const encrypt = useEncrypt();
const { writeContractAsync } = useWriteContract();
const { address } = useAccount();

async function deposit(amount: bigint) {
  const enc = await encrypt.mutateAsync({
    values: [{ value: amount, type: 'euint64' }], // type matches the contract param
    contractAddress: CONTRACT_ADDRESS,
    userAddress: address!,
  });

  await writeContractAsync({
    address: CONTRACT_ADDRESS,
    abi: ABI,
    functionName: 'deposit',
    args: [bytesToHex(enc.handles[0]!), bytesToHex(enc.inputProof)],
    gas: 15_000_000n, // FHE ops are gas-heavy; cap well below Sepolia's 16.7M block limit
  });
}
```

For multiple inputs in one call, pass an array:

```ts
const enc = await encrypt.mutateAsync({
  values: [
    { value: giveAmount, type: 'euint64' },
    { value: getAmount, type: 'euint64' },
  ],
  contractAddress, userAddress,
});
// enc.handles[0], enc.handles[1], enc.inputProof
```

## User-decrypting an output

The contract must have called `FHE.allow(handle, user)`. Then the hook handles keypair generation, EIP-712 signing, caching, and the actual decrypt — all internally.

```tsx
import { useAllow, useIsAllowed, useUserDecrypt } from '@zama-fhe/react-sdk';
import { ZERO_HANDLE } from '@zama-fhe/sdk';

const handles = useMemo(() => {
  if (!countHandle || countHandle === ZERO_HANDLE) return [];
  return [{ handle: countHandle as `0x${string}`, contractAddress: CONTRACT_ADDRESS }];
}, [countHandle]);

const { mutate: allow, isPending: isAllowing } = useAllow();
const { data: isAllowed } = useIsAllowed({ contractAddresses: [CONTRACT_ADDRESS] });
const [enabled, setEnabled] = useState(false);
const decrypt = useUserDecrypt({ handles }, { enabled: enabled && !!isAllowed });

async function readClear() {
  setEnabled(true);
  if (!isAllowed) {
    allow([CONTRACT_ADDRESS]); // one-time per session per contract
    return;
  }
  // decrypt.data[handle] becomes the plaintext bigint
}
```

`ZERO_HANDLE` (`0x00...00`) is the sentinel for an uninitialised slot — guard against it before adding to the decrypt list.

## Public decryption (post-settlement)

When the contract has called `FHE.makePubliclyDecryptable(handle)`:

```ts
import { usePublicDecrypt } from '@zama-fhe/react-sdk';

const { data } = usePublicDecrypt({ handles: [{ handle, contractAddress }] });
// data[handle] === plaintext bigint, no permit needed
```

## Lifecycle events (optional UX polish)

```tsx
import { ZamaSDKEvents } from '@zama-fhe/sdk';

useEffect(() => {
  const ctrl = new AbortController();
  const { CredentialsCached, DecryptEnd } = ZamaSDKEvents;
  window.addEventListener(CredentialsCached, () => setMsg('credentials ready'), { signal: ctrl.signal });
  window.addEventListener(DecryptEnd, () => setMsg('decrypted'), { signal: ctrl.signal });
  return () => ctrl.abort();
}, []);
```

## Common mistakes

- **Using `@zama-fhe/relayer-sdk` directly.** That package still publishes (v0.4.x), but the official template has migrated. Use `@zama-fhe/sdk` + `@zama-fhe/react-sdk` v3 for new code.
- **Mismatched type strings.** `type: 'euint64'` must match the contract parameter; using `'euint32'` against an `externalEuint64` input will fail at the relayer.
- **Skipping `useAllow`.** `useUserDecrypt` won't fire until `useIsAllowed({ contractAddresses })` returns true. Call `allow([contractAddress])` first.
- **Forgetting `bytesToHex`.** `enc.handles[0]` and `enc.inputProof` are `Uint8Array` — viem's `writeContract` wants `0x` hex strings.
- **No `gas` override.** FHE writes routinely need 5-15M gas; without an explicit `gas` field wagmi's estimate can come up short.
- **Building a single instance manually.** The legacy `createInstance(SepoliaConfig)` pattern is gone — use `<ZamaProvider>` and the hooks.

## Migration cheatsheet (relayer-sdk v0.x → SDK v3)

| Old | New |
|---|---|
| `import { createInstance, SepoliaConfig } from '@zama-fhe/relayer-sdk'` | `import { RelayerWeb, SepoliaConfig } from '@zama-fhe/sdk'` |
| `instance.createEncryptedInput(c, u).add64(x).encrypt()` | `useEncrypt().mutateAsync({ values: [{value: x, type: 'euint64'}], contractAddress: c, userAddress: u })` |
| `instance.userDecrypt(...)` (manual EIP-712) | `useUserDecrypt({ handles })` (auto) |
| Manual `instance.generateKeypair()` + `signTypedData` | `useAllow()` once per session |
| `instance.publicDecrypt([h])` | `usePublicDecrypt({ handles: [...] })` |
