import Link from 'next/link';
export default function Success() {
  return (
    <div className="mx-auto max-w-md px-5 py-20 sm:py-28">
      <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Payment received</h1>
      <p className="mt-3 text-mute">Premium unlocks as soon as the payment is confirmed, usually within seconds. If you do not see it yet, refresh the page.</p>
      <Link href="/app" className="btn btn-primary mt-8">Start listening</Link>
    </div>
  );
}
