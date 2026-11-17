import { useEffect, useRef, useState, type RefObject } from 'react';

/** Width the "Dators" view renders the page at, then scales it down to fit. */
const DESKTOP = 1280;
const PHONE = 390;
const small = 'text-[13px] font-semibold uppercase tracking-[0.08em]';

/**
 * The real homepage in a frame, fed by the form's messages. Beside the form on
 * wide screens; a full-screen layer opened from the form on phones.
 */
export default function PreviewPane({
  locale,
  frameRef,
  open,
  onClose,
}: {
  locale: 'lv' | 'en';
  frameRef: RefObject<HTMLIFrameElement | null>;
  open: boolean;
  onClose: () => void;
}) {
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [wide, setWide] = useState(false);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const boxRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const overlay = open && !wide;

  useEffect(() => {
    const q = window.matchMedia('(min-width: 1024px)');
    const read = () => setWide(q.matches);
    read();
    q.addEventListener('change', read);
    return () => q.removeEventListener('change', read);
  }, []);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Phone layer: focus moves into it and Escape closes it.
  useEffect(() => {
    if (!overlay) return;
    backRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, onClose]);

  const scale = box.w ? Math.min(1, box.w / DESKTOP) : 1;
  const frameStyle =
    !wide ? { width: '100%', height: '100%' }
    : device === 'phone' ? { width: PHONE, height: '100%' }
    : { width: DESKTOP, height: box.h / scale, transform: `scale(${scale})`, transformOrigin: '0 0' };

  const tab = (value: 'desktop' | 'phone', label: string) => (
    <button
      type="button"
      aria-pressed={device === value}
      onClick={() => setDevice(value)}
      className={`${small} rounded-[3px] px-3 py-1.5 ${device === value ? 'bg-ink text-paper' : 'text-ink/70 hover:text-ink'}`}
    >
      {label}
    </button>
  );

  return (
    <section
      aria-label="Priekšskatījums"
      role={overlay ? 'dialog' : undefined}
      aria-modal={overlay || undefined}
      className={`${open ? 'fixed inset-0 z-50 flex p-3' : 'hidden'} flex-col gap-3 bg-paper lg:sticky lg:top-4 lg:z-auto lg:flex lg:h-[calc(100vh-2rem)] lg:p-0`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className={`${small} text-ink/70`}>Priekšskatījums · {locale.toUpperCase()}</p>
        <div className="hidden gap-1 lg:flex">
          {tab('desktop', 'Dators')}
          {tab('phone', 'Telefons')}
        </div>
        <button ref={backRef} type="button" onClick={onClose} className={`${small} rounded-[4px] bg-ink px-4 py-2 text-paper lg:hidden`}>
          Atpakaļ
        </button>
      </div>
      <div ref={boxRef} className="relative min-h-0 flex-1 overflow-hidden rounded-[4px] border border-ink/15 bg-paper-2">
        {/* On phones the page loads only when the preview opens: no hidden video eating mobile data. */}
        {wide || open ? (
          <iframe
            ref={frameRef}
            src={locale === 'lv' ? '/' : '/en'}
            title="Lapas priekšskatījums"
            style={frameStyle}
            className={`block border-0 bg-paper ${wide && device === 'phone' ? 'mx-auto' : ''}`}
          />
        ) : null}
      </div>
    </section>
  );
}
