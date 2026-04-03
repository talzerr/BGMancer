export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
        {title}
      </h2>
      {children}
    </div>
  );
}
