function getSortDirection(sort, key) {
  if (!sort || sort.key !== key) return 'none';
  return sort.direction === 'desc' ? 'descending' : 'ascending';
}

export default function ResponsiveDataTable({
  columns,
  rows = [],
  rowKey,
  loading,
  emptyTitle = '目前沒有資料',
  error,
  sort,
  onSort,
  page,
  pageSize,
  total,
  onPageChange,
  onRowClick,
  mobileCardRenderer,
}) {
  if (loading) return <div className="table-state">載入中…</div>;
  if (error) return <div className="table-state table-error">{error}</div>;
  if (!rows.length) return <div className="table-state">{emptyTitle}</div>;

  const hasPagination = Boolean(
    onPageChange
      && Number.isFinite(page)
      && Number.isFinite(pageSize)
      && Number.isFinite(total)
      && pageSize > 0,
  );
  const pageCount = hasPagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;

  function activateRow(event, row) {
    if (!onRowClick || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    onRowClick(row);
  }

  return (
    <div className="responsive-table">
      <table>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortable = Boolean(onSort && column.sortable !== false);
              return (
                <th
                  key={column.key}
                  className={column.hideOnTablet ? 'hide-on-tablet' : undefined}
                  aria-sort={sortable ? getSortDirection(sort, column.key) : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      className="table-sort-button"
                      onClick={() => onSort(column.key)}
                    >
                      {column.label}
                      {sort?.key === column.key ? (sort.direction === 'desc' ? ' ↓' : ' ↑') : ''}
                    </button>
                  ) : column.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowKey ? rowKey(row) : index}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => activateRow(event, row)}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={column.hideOnTablet ? 'hide-on-tablet' : undefined}
                >
                  {column.render ? column.render(row) : row[column.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {mobileCardRenderer && (
        <div className="mobile-table-cards">
          {rows.map((row, index) => (
            <article
              key={rowKey ? rowKey(row) : index}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => activateRow(event, row)}
            >
              {mobileCardRenderer(row)}
            </article>
          ))}
        </div>
      )}

      {hasPagination && pageCount > 1 && (
        <nav className="table-pagination" aria-label="資料表分頁">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            上一頁
          </button>
          <span>第 {page}／{pageCount} 頁</span>
          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
          >
            下一頁
          </button>
        </nav>
      )}
    </div>
  );
}
