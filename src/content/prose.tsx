/** Small building blocks for the long legal pages. */
export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12" aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="text-[20px] leading-snug font-medium">
        {n}. {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink/85 [&_a]:underline [&_a]:underline-offset-4 [&_li]:mt-2 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[14px]">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="border-b border-ink/30 py-2 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[0]}>
              {r.map((c, i) => (
                <td key={i} className="border-b border-ink/10 py-2 pr-4 align-top">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const EMAIL = 'support@projectnidos.eu';
export const Mail = () => <a href={`mailto:${EMAIL}`}>{EMAIL}</a>;
