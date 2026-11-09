import Link from 'next/link';
export default function Success() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <div className="text-5xl">🎉</div>
      <h1 className="mt-4 text-3xl font-extrabold">You're Premium!</h1>
      <p className="mt-2 text-zinc-400">Your payment is being confirmed — Premium unlocks the moment it clears (usually a few seconds). Refresh if you don't see it yet.</p>
      <Link href="/app" className="btn btn-primary mt-6">Start listening</Link>
    </div>
  );
}
