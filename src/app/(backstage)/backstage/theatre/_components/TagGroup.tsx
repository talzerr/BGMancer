export function TagGroup({
  label,
  tags,
  color = "text-foreground",
}: {
  label: string;
  tags: readonly string[];
  color?: string;
}) {
  return (
    <div>
      <span className="text-[10px] tracking-wider text-[var(--text-disabled)] uppercase">
        {label}
      </span>
      <div className="mt-0.5 flex flex-wrap gap-1">
        {tags.map((t) => (
          <span key={t} className={`font-mono text-[10px] ${color}`}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
