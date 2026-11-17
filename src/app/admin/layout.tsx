import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { connection } from 'next/server';
import '../globals.css';

// Inter, as on dailradesdizains.lv. next/font serves it from this site, so no visitor request goes to Google.
const inter = Inter({ subsets: ['latin', 'latin-ext'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'Project Nidos — administrācija',
  robots: { index: false, follow: false },
};

export default async function AdminRoot({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="lv" className={inter.variable}>
      <body className="min-h-screen bg-paper font-sans text-[16px] text-ink antialiased">{children}</body>
    </html>
  );
}
