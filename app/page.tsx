import Link from 'next/link';
import { PLAN } from '@/lib/plans';

const features = [
  ['🎧', 'Human-sounding voices', '5 free natural voices, 20+ with Premium. US, UK, Australian and South African accents.'],
  ['📄', 'Read anything', 'PDF, DOCX, EPUB, TXT, web articles, YouTube transcripts, Google Drive & Dropbox links.'],
  ['📸', 'Photo to speech', 'Snap a page of a book. We OCR it and read it out loud.'],
  ['✨', 'Follow along', 'Sentence highlighting, auto-scroll, speed from 0.5x, night mode and a dyslexia-friendly font.'],
  ['📚', 'Your library', 'Everything saved. Resume exactly where you left off, on any device.'],
  ['🧬', 'Clone a voice', 'Upload 10 seconds of audio and have your documents read in that voice (Premium).'],
];

export default function Home() {
  return (
    <div>
      <section className="glow relative overflow-hidden">
        <div className="mx-auto max-w-4xl px-4 pb-20 pt-20 text-center sm:pt-28">
          <span className="rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-xs font-semibold text-brand-glow">The free Speechify alternative</span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">
            Paste anything.<br /><span className="bg-gradient-to-r from-brand-soft to-accent bg-clip-text text-transparent">Listen to anything.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Voxora turns PDFs, articles, books and videos into natural, human-sounding audio. Free to start, from just R{PLAN.monthlyZAR}/month for everything.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/app" className="btn btn-primary !px-8 !py-3.5 text-base">▶ Start listening free</Link>
            <Link href="/login" className="btn btn-ghost !px-8 !py-3.5 text-base">Get {PLAN.trialMonths} months of Premium free</Link>
          </div>
          <p className="mt-4 text-xs text-zinc-500">No card needed. New accounts get {PLAN.trialMonths} months of Premium on us — we remind you before it ends.</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(([i, t, d]) => (
          <div key={t} className="card">
            <div className="text-2xl">{i}</div>
            <h3 className="mt-3 font-bold">{t}</h3>
            <p className="mt-1 text-sm text-zinc-400">{d}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-4 pb-24 text-center">
        <h2 className="text-3xl font-extrabold">Premium is R{PLAN.monthlyZAR}/month</h2>
        <p className="mt-3 text-zinc-400">Unlimited listening, 20+ voices, voice cloning, AI summaries & notes, translation, offline listening and more. Or R{PLAN.yearlyZAR}/year.</p>
        <Link href="/pricing" className="btn btn-primary mt-6">See pricing</Link>
      </section>
      <footer className="border-t border-line py-8 text-center text-xs text-zinc-500">© {new Date().getFullYear()} Voxora</footer>
    </div>
  );
}
