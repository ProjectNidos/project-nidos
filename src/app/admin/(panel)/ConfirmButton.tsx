'use client';

export default function ConfirmButton({ message, children }: { message: string; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
      className="text-ink/70 underline underline-offset-4 hover:text-ink"
    >
      {children}
    </button>
  );
}
