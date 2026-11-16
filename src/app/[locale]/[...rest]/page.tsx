import { notFound } from 'next/navigation';

// Any unknown address inside a locale renders that locale's not-found page.
export default function CatchAll() {
  notFound();
}
