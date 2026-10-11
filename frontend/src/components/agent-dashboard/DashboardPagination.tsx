interface Props { page: number; limit: number; total: number; totalPages: number; onPage: (page: number) => void; onLimit: (limit: 25 | 50 | 100) => void; }
export function DashboardPagination({ page, limit, total, totalPages, onPage, onLimit }: Props) {
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return <nav aria-label="Ticket pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-sm dark:border-gray-700">
    <p className="text-gray-600 dark:text-gray-300">{start}–{end} of {total}</p>
    <label className="flex items-center gap-2 text-gray-600 dark:text-gray-300">Rows per page
      <select aria-label="Rows per page" value={limit} onChange={(event) => onLimit(Number(event.target.value) as 25 | 50 | 100)} className="rounded border border-gray-300 bg-white px-2 py-1 dark:border-gray-600 dark:bg-gray-900">
        {[25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
      </select>
    </label>
    <div className="flex items-center gap-2">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600">Previous</button>
      <span aria-live="polite">Page {page} of {Math.max(totalPages, 1)}</span>
      <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40 dark:border-gray-600">Next</button>
    </div>
  </nav>;
}
