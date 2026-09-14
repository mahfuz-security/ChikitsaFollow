export type ChipTone = "default" | "open" | "progress" | "resolved" | "info";

const toneClass: Record<ChipTone, string> = {
  default: "chip",
  open: "chip chip-tonal-open",
  progress: "chip chip-tonal-progress",
  resolved: "chip chip-tonal-resolved",
  info: "chip chip-tonal-info"
};

export function Chip({ children, tone = "default" }: { children: string; tone?: ChipTone }) {
  return <span className={toneClass[tone]}>{children}</span>;
}

export function ChipList({ empty, items, tone }: { empty: string; items?: string[]; tone?: ChipTone }) {
  if (!items || items.length === 0) return <p className="muted">{empty}</p>;

  return (
    <div className="chips">
      {items.map((item) => (
        <Chip key={item} tone={tone}>
          {item}
        </Chip>
      ))}
    </div>
  );
}
