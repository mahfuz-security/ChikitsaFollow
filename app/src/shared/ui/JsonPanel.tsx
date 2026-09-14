export function JsonPanel({ value }: { value: unknown }) {
  return <pre className="code-panel">{typeof value === "string" ? value : JSON.stringify(value ?? {}, null, 2)}</pre>;
}
