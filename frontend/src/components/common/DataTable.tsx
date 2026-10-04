import type { ReactNode } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  accessor?: keyof T;
  className?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];

  /**
   * Provides a stable React key for each row.
   * Falls back to the row index when omitted.
   */
  keyExtractor?: (item: T, index: number) => string | number;

  /**
   * Pagination.
   */
  page?: number;
  pageSize?: number;
  total?: number;
  pages?: number;
  totalPages?: number;

  /**
   * Pagination callbacks.
   */
  onPageChange?: (page: number) => void;
  onPrevPage?: () => void;
  onNextPage?: () => void;

  /**
   * Optional table state / appearance.
   */
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function getCellValue<T>(
  item: T,
  column: DataTableColumn<T>,
): ReactNode {
  if (column.render) {
    return column.render(item);
  }

  if (column.accessor) {
    const value = item[column.accessor];

    if (
      value === null ||
      value === undefined
    ) {
      return "—";
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    return JSON.stringify(value);
  }

  return "—";
}

export function DataTable<T>({
  data,
  columns,
  keyExtractor,
  page = 1,
  pageSize = 0,
  total,
  pages,
  totalPages,
  onPageChange,
  onPrevPage,
  onNextPage,
  loading = false,
  emptyMessage = "No data available.",
  className = "",
}: DataTableProps<T>): React.JSX.Element {
  const resolvedPages =
    totalPages ??
    pages ??
    (total !== undefined && pageSize > 0
      ? Math.max(
          1,
          Math.ceil(total / pageSize),
        )
      : 1);

  const canGoPrevious = page > 1;
  const canGoNext = page < resolvedPages;

  function handlePrevious(): void {
    if (!canGoPrevious) {
      return;
    }

    if (onPrevPage) {
      onPrevPage();
      return;
    }

    if (onPageChange) {
      onPageChange(page - 1);
    }
  }

  function handleNext(): void {
    if (!canGoNext) {
      return;
    }

    if (onNextPage) {
      onNextPage();
      return;
    }

    if (onPageChange) {
      onPageChange(page + 1);
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border border-surface-700 bg-surface-800 ${className}`}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-surface-700 bg-surface-800">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                    column.className ?? ""
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-surface-700/60">
            {loading && (
              <tr>
                <td
                  colSpan={Math.max(columns.length, 1)}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  Loading...
                </td>
              </tr>
            )}

            {!loading &&
              data.length === 0 && (
                <tr>
                  <td
                    colSpan={Math.max(
                      columns.length,
                      1,
                    )}
                    className="px-4 py-10 text-center text-sm text-gray-500"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              )}

            {!loading &&
              data.map((item, index) => (
                <tr
                  key={
                    keyExtractor
                      ? keyExtractor(item, index)
                      : index
                  }
                  className="transition-colors hover:bg-surface-700/30"
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`px-4 py-3 text-gray-300 ${
                        column.className ?? ""
                      }`}
                    >
                      {getCellValue(
                        item,
                        column,
                      )}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {resolvedPages > 1 && (
        <div className="flex items-center justify-between border-t border-surface-700 px-4 py-3">
          <p className="text-xs text-gray-500">
            Page {page} of {resolvedPages}
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={
                !canGoPrevious || loading
              }
              className="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <button
              type="button"
              onClick={handleNext}
              disabled={
                !canGoNext || loading
              }
              className="rounded-lg border border-surface-600 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-surface-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable;