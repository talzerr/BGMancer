export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-medium tracking-wider text-[var(--text-tertiary)] uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}
