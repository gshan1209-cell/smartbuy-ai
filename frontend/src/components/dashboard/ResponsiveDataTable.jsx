export default function ResponsiveDataTable({ columns, rows = [], rowKey, loading, emptyTitle = '目前沒有資料', error, onRowClick, mobileCardRenderer }) {
  if (loading) return <div className="table-state">載入中…</div>;
  if (error) return <div className="table-state table-error">{error}</div>;
  if (!rows.length) return <div className="table-state">{emptyTitle}</div>;
  return <div className="responsive-table"><table><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey ? rowKey(row) : index} tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(row)} onKeyDown={(event) => { if (onRowClick && ['Enter', ' '].includes(event.key)) onRowClick(row); }}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key] ?? '—'}</td>)}</tr>)}</tbody></table>{mobileCardRenderer && <div className="mobile-table-cards">{rows.map((row, index) => <article key={rowKey ? rowKey(row) : index} onClick={() => onRowClick?.(row)}>{mobileCardRenderer(row)}</article>)}</div>}</div>;
}
