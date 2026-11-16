import type { Metadata } from 'next';
import { Figtree } from 'next/font/google';
import { connection } from 'next/server';
import '../globals.css';

const figtree = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-figtree', display: 'swap' });

export const metadata: Metadata = {
  title: 'Project Nidos — administrācija',
  robots: { index: false, follow: false },
};

export default async function AdminRoot({ children }: { children: React.ReactNode }) {
  await connection();
  return (
    <html lang="lv" className={figtree.variable}>
      <body className="min-h-screen bg-paper font-sans text-[16px] text-ink antialiased">{children}</body>
    </html>
  );
}
