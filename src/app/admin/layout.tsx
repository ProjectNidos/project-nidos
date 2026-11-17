import type { Metadata } from 'next';
import { IBM_Plex_Mono, Inter } from 'next/font/google';
import { connection } from 'next/server';
import '../globals.css';

// The same faces as dailradesdizains.lv: Inter for text, IBM Plex Mono for small labels.
// next/font serves them from this site, so no visitor request goes to Google.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });
const mono = IBM_Plex_Mono({ subsets: ['latin', 'latin-ext'], weight: ['400', '700'], variable: '--font-plex-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Project Nidos — administrācija',
  robots: { index: false, follow: false },
};

export default async function AdminRoot({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="lv" className={`${inter.variable} ${mono.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-[16px] text-ink antialiased">{children}</body>
    </html>
  );
}
