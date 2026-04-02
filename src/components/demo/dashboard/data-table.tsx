'use client';

interface Column<T> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  render?: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyField: string;
}

export function DataTable<T>({ columns, rows, keyField }: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`pb-2 text-xs font-medium text-neutral-500 ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr
              key={String((row as Record<string, unknown>)[keyField] ?? rowIdx)}
              className="border-b border-neutral-100"
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2 ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
