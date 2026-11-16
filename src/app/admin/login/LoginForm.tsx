'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from '../actions';

const field = 'mt-1 block w-full rounded-none border-0 border-b border-ink/30 bg-transparent px-0 py-2 text-[16px] outline-none focus:border-ink';

export default function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  return (
    <form action={action} className="mt-10 grid gap-6">
      <label className="block text-[14px] text-ink/70">
        E-pasts
        <input name="email" type="email" autoComplete="username" required className={field} />
      </label>
      <label className="block text-[14px] text-ink/70">
        Parole
        <input name="password" type="password" autoComplete="current-password" required className={field} />
      </label>
      {state.error ? (
        <p role="alert" className="rounded-[3px] bg-peach px-3 py-2 text-[14px]">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-[4px] bg-ink py-3 text-[15px] font-medium text-paper disabled:opacity-60"
      >
        {pending ? 'Ienāk…' : 'Ienākt'}
      </button>
    </form>
  );
}
