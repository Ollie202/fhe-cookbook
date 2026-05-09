'use client';
import { useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient, useReadContract } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { getFheInstance, AUCTION_ABI, AUCTION_ADDRESS } from '@/lib/fhe';

type LogLine = { ts: number; msg: string };

export function AuctionPanel() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const { data: deadline } = useReadContract({ abi: AUCTION_ABI, address: AUCTION_ADDRESS, functionName: 'deadline' });
  const { data: settled, refetch: refetchSettled } = useReadContract({ abi: AUCTION_ABI, address: AUCTION_ADDRESS, functionName: 'settled' });
  const { data: revealedBid, refetch: refetchBid } = useReadContract({ abi: AUCTION_ABI, address: AUCTION_ADDRESS, functionName: 'revealedBid' });
  const { data: revealedWinner, refetch: refetchWinner } = useReadContract({ abi: AUCTION_ABI, address: AUCTION_ADDRESS, functionName: 'revealedWinner' });
  const { data: item } = useReadContract({ abi: AUCTION_ABI, address: AUCTION_ADDRESS, functionName: 'itemDescription' });

  const [bidAmount, setBidAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const log = (msg: string) => setLogs((l) => [...l, { ts: Date.now(), msg }]);

  const isLive = useMemo(() => {
    if (!deadline) return false;
    return Date.now() / 1000 < Number(deadline);
  }, [deadline]);

  async function placeBid() {
    if (!address || !walletClient || !bidAmount) return;
    setBusy(true);
    try {
      log(`Encrypting bid ${bidAmount} for ${AUCTION_ADDRESS}...`);
      const instance = await getFheInstance();
      const input = instance.createEncryptedInput(AUCTION_ADDRESS, address);
      input.add64(BigInt(bidAmount));
      const enc = await input.encrypt();
      log(`Got handle ${enc.handles[0].slice(0, 18)}... + ${enc.inputProof.length}-byte proof`);

      const txHash = await walletClient.writeContract({
        abi: AUCTION_ABI,
        address: AUCTION_ADDRESS,
        functionName: 'bid',
        args: [enc.handles[0], enc.inputProof as `0x${string}`],
      });
      log(`Submitted tx ${txHash}`);
      const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash });
      log(`Confirmed in block ${receipt.blockNumber} ✓`);
    } catch (e: any) {
      log(`ERROR: ${e?.shortMessage ?? e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function settle() {
    if (!walletClient) return;
    setBusy(true);
    try {
      log('Requesting settlement...');
      const txHash = await walletClient.writeContract({
        abi: AUCTION_ABI,
        address: AUCTION_ADDRESS,
        functionName: 'requestSettlement',
        args: [],
      });
      log(`Submitted tx ${txHash}`);
      await publicClient!.waitForTransactionReceipt({ hash: txHash });
      log('Settlement requested. Decryption oracle will call back in ~30-60s.');
      const poll = setInterval(async () => {
        await refetchSettled();
        await refetchBid();
        await refetchWinner();
      }, 5000);
      setTimeout(() => clearInterval(poll), 120000);
    } catch (e: any) {
      log(`ERROR: ${e?.shortMessage ?? e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Sealed-Bid Auction</h1>
      <p className="muted">Bids are encrypted client-side and stay encrypted on-chain. Only the winning bid is revealed at settlement.</p>

      <div className="card">
        <h2>{(item as string) || 'loading...'}</h2>
        <div className="row" style={{ marginBottom: 16 }}>
          <span className={`badge ${isLive ? 'live' : 'over'}`}>
            {isLive ? 'BIDDING OPEN' : settled ? 'SETTLED' : 'BIDDING CLOSED'}
          </span>
          <span className="tag">contract: {AUCTION_ADDRESS}</span>
        </div>

        {!isConnected ? (
          <button onClick={() => connect({ connector: injected() })}>Connect wallet</button>
        ) : (
          <>
            <div className="row" style={{ marginBottom: 12 }}>
              <span className="tag">{address}</span>
              <button className="secondary" onClick={() => disconnect()}>Disconnect</button>
            </div>

            {isLive ? (
              <div className="row">
                <input
                  placeholder="Bid amount (e.g. 250)"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value.replace(/[^\d]/g, ''))}
                  disabled={busy}
                />
                <button onClick={placeBid} disabled={busy || !bidAmount}>
                  {busy ? 'Encrypting…' : 'Submit sealed bid'}
                </button>
              </div>
            ) : !settled ? (
              <button onClick={settle} disabled={busy}>{busy ? 'Working…' : 'Settle auction'}</button>
            ) : (
              <div className="card" style={{ marginTop: 0, background: '#0e1a0e', borderColor: '#1f3a1f' }}>
                <h2>Winner revealed</h2>
                <p><strong>{(revealedWinner as string) || '—'}</strong></p>
                <p className="muted">Winning bid: <strong>{revealedBid?.toString() ?? '—'}</strong></p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Activity</h2>
        <div className="log">
          {logs.length === 0 ? <span style={{ color: '#5b6479' }}>(no activity yet)</span> :
            logs.map((l) => <div key={l.ts}>[{new Date(l.ts).toLocaleTimeString()}] {l.msg}</div>)}
        </div>
      </div>
    </div>
  );
}
