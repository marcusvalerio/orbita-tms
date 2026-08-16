export function StatCard({
  label,
  value,
  suffix,
  accent = "cosmic",
}: {
  label: string;
  value: string | number;
  suffix?: string;
  accent?: "cosmic" | "opal" | "orange" | "cinnamon";
}) {
  const accentClass = {
    cosmic: "text-cosmic-ink",
    opal: "text-blue-opal",
    orange: "text-rowdy-orange",
    cinnamon: "text-cinnamon",
  }[accent];

  return (
    <div className="rounded-lg border border-cosmic-ink/10 bg-white/60 px-5 py-4">
      <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/50 mb-1.5">
        {label}
      </p>
      <p className={`font-display font-semibold text-3xl tabular ${accentClass}`}>
        {value}
        {suffix && <span className="text-lg font-medium ml-0.5">{suffix}</span>}
      </p>
    </div>
  );
}
