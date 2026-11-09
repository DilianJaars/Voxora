import './globals.css';
import type { Metadata, Viewport } from 'next';
import Nav from '@/components/Nav';
import TrialBanner from '@/components/TrialBanner';
import ThemeSync from '@/components/ThemeSync';
import RegisterSW from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: 'Voxora – Paste anything. Listen to anything.',
  icons: { icon: '/icon.svg' },
  description: 'A free, natural-sounding text-to-speech reader. Upload PDFs, paste articles, YouTube links and listen in human-like voices.',
};
export const viewport: Viewport = { themeColor: '#0F1626', width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ThemeSync />
        <RegisterSW />
        <Nav />
        <TrialBanner />
        <main>{children}</main>
      </body>
    </html>
  );
}
