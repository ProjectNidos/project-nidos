import { requireAdmin } from '@/lib/auth';
import { signOut } from '../actions';
import AdminNav from './AdminNav';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  return (
    <>
      <header className="border-b border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-8">
            <span className="text-[17px] font-semibold tracking-tight">Project Nidos</span>
            <AdminNav />
          </div>
          <div className="flex items-center gap-4 text-[14px]">
            <span className="hidden text-ink/70 md:inline">{user.email}</span>
            <a href="/" target="_blank" rel="noopener" className="underline underline-offset-4">
              Skatīt lapu
            </a>
            <form action={signOut}>
              <button type="submit" className="rounded-[4px] border border-ink/30 px-3 py-1.5 hover:border-ink">
                Iziet
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </>
  );
}
