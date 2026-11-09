import './globals.css';
import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import TrialBanner from '@/components/TrialBanner';
import ThemeSync from '@/components/ThemeSync';

export const metadata: Metadata = {
  title: 'Voxora – Paste anything. Listen to anything.',
  description: 'A free, natural-sounding text-to-speech reader. Upload PDFs, paste articles, YouTube links and listen in human-like voices.',
};
export const viewport: Viewport = { themeColor: '#0a0a0f', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen font-sans">
        <ThemeSync />
        <Nav />
        <TrialBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
