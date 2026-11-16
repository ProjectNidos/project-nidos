'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics';

/** One page_view per page, including client-side navigations. */
export default function Beacon() {
  const pathname = usePathname();
  useEffect(() => {
    track('page_view');
  }, [pathname]);
  return null;
}
