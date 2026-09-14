import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  // Per §6.5: numeric columns right-align for scanability. Pass
  // `numeric: true` to opt a column into right alignment + tabular
  // numerals (applied via the .num-cell class on every rendered <td>).
  numeric?: boolean;
};

function rowKey(row: unknown, index: number): string {
  const r = row as Record<string, unknown>;
  return String(r.itemId ?? r.id ?? index);
}

// Hairline-header table per §6.5: no filled header background, glass
// hover (no color text change), zebra striping off. Container uses
// Level 2 glass for the "card" feeling without competing with primary
// content cards.
export function DataTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.numeric ? "num-cell" : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)}>
              {columns.map((column) => (
                <td key={column.key} className={column.numeric ? "num-cell" : undefined} data-numeric={column.numeric ? "" : undefined}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
