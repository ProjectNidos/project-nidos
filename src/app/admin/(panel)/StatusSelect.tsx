'use client';

/** Saves the new status as soon as it is chosen. */
export default function StatusSelect({ defaultValue, options }: { defaultValue: string; options: { value: string; label: string }[] }) {
  return (
    <label className="flex items-center gap-2 text-[14px] text-ink/70">
      Statuss
      <select
        name="status"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-[4px] border border-ink/30 bg-paper px-2 py-1.5 text-[15px] text-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
