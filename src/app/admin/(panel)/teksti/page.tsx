import { requireAdmin } from '@/lib/auth';
import { sessionClient } from '@/lib/supabase';
import { EDITABLE, getText } from '@/lib/texts';
import lv from '../../../../../messages/lv.json';
import en from '../../../../../messages/en.json';
import TextsForm from './TextsForm';

export default async function TextsPage() {
  await requireAdmin();
  const { data } = await (await sessionClient()).from('site_texts').select('key, locale, value');
  const saved = new Map((data ?? []).map((r) => [`${r.locale}:${r.key}`, r.value as string]));

  const rows = EDITABLE.map((e) => ({
    ...e,
    lv: { value: saved.get(`lv:${e.key}`) ?? getText(lv, e.key) ?? '', edited: saved.has(`lv:${e.key}`), original: getText(lv, e.key) ?? '' },
    en: { value: saved.get(`en:${e.key}`) ?? getText(en, e.key) ?? '', edited: saved.has(`en:${e.key}`), original: getText(en, e.key) ?? '' },
  }));

  return (
    // data-wide: the panel layout drops its max width here, so the preview gets the room.
    <div data-wide>
      <h1 className="text-[1.75rem] font-light">Teksti</h1>
      <p className="mt-2 max-w-[65ch] text-[15px] leading-relaxed text-ink/70">
        Mainiet mājaslapas tekstus abās valodās. Priekšskatījumā redzams, kā teksts izskatīsies lapā, jau rakstot;
        apmeklētāji izmaiņas redzēs pēc saglabāšanas. Lai atgrieztu sākotnējo tekstu, notīriet lauku un saglabājiet.
      </p>
      <TextsForm rows={rows} />
    </div>
  );
}
