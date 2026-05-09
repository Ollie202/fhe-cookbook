import { AuctionPanel } from '@/components/AuctionPanel';

export default function Page() {
  return (
    <main className="container">
      <AuctionPanel />
      <p className="muted" style={{ marginTop: 24, textAlign: 'center' }}>
        Built with the <a href="https://github.com/anthropics/zama-cookbook">zama-cookbook</a> agent skill.
      </p>
    </main>
  );
}
