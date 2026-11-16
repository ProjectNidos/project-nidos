import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/auth';
import LoginForm from './LoginForm';

export default async function LoginPage() {
  if (await getAdmin()) redirect('/admin');
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-[1.75rem] leading-tight font-light">Project Nidos</h1>
        <p className="mt-1 text-[15px] text-ink/70">Administrācijas panelis</p>
        <LoginForm />
        <Link href="/" className="mt-10 inline-block text-[14px] text-ink/70 underline underline-offset-4">
          Uz mājaslapu
        </Link>
      </div>
    </main>
  );
}
