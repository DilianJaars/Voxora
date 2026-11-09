import Link from 'next/link';
import { PLAN } from '@/lib/plans';
import { VOICES } from '@/lib/voices';
import { Icon } from '@/components/Icons';
import LiveDemo from '@/components/LiveDemo';
import LandingVoices from '@/components/LandingVoices';

const SOURCES = [
  ['paste', 'Pasted text', 'Anything you can copy'],
  ['file', 'Documents', 'PDF, Word, EPUB and plain text, with chapter navigation'],
  ['link', 'Web articles', 'Paste a link and we pull out the article text'],
  ['video', 'YouTube', 'Reads the video transcript'],
  ['cloud', 'Google Drive and Dropbox', 'Paste a share link'],
  ['camera', 'Photos of pages', 'Take a picture of a book page and it is read aloud'],
];

export default function Home() {
  const premiumVoices = VOICES.filter((v) => !v.free).length;
  return (
    <div>
      <section className="mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:pt-24">
        <div>
          <h1 className="text-[2.75rem] font-extrabold leading-[1.02] tracking-[-0.03em] sm:text-6xl lg:text-[4.25rem]">
            Paste anything.<br />Listen to anything.
          </h1>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-mute">
            Voxora reads PDFs, articles, books and video transcripts aloud in natural voices. It is free to use, and R{PLAN.monthlyZAR} a month unlocks everything.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/app" className="btn btn-primary !px-6 !py-3 text-base">Start listening</Link>
            <Link href="/login" className="btn btn-quiet !px-6 !py-3 text-base">Get {PLAN.trialMonths} months of Premium free</Link>
          </div>
          <p className="mt-4 max-w-md text-sm text-mute">New accounts start with Premium for {PLAN.trialMonths} months, no card needed. We email you before it ends.</p>
        </div>
        <LiveDemo />
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Bring whatever you need to get through</h2>
            <p className="mt-4 max-w-sm text-mute">Reading goes with you. Drop a file, paste a link or photograph a page.</p>
          </div>
          <ul>
            {SOURCES.map(([icon, title, desc]) => (
              <li key={title} className="flex items-start gap-4 border-t border-line py-5 last:border-b">
                <Icon name={icon} size={22} className="mt-0.5 shrink-0 text-mark" />
                <div><div className="font-semibold">{title}</div><div className="text-mute">{desc}</div></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Voices that sound like people</h2>
            <p className="mt-4 max-w-sm text-mute">Natural pacing, real pauses, and the right tone for questions and exclamations. Five voices are free, and Premium adds {premiumVoices} more in American, British, Australian and South African accents, plus voice cloning from a 10-second sample.</p>
          </div>
          <LandingVoices />
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-20 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">R{PLAN.monthlyZAR} a month, or R{PLAN.yearlyZAR} a year</h2>
            <p className="mt-3 max-w-lg text-mute">Unlimited listening, all voices, cloning, summaries, translation and offline listening. The first {PLAN.trialMonths} months are on us.</p>
          </div>
          <Link href="/pricing" className="btn btn-primary !px-6 !py-3 text-base">See what is included</Link>
        </div>
      </section>

      <footer className="border-t border-line py-8 text-center text-sm text-mute">Voxora</footer>
    </div>
  );
}
