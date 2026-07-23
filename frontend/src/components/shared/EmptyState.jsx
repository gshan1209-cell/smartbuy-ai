export default function EmptyState({
  title = '目前沒有資料',
  description,
  children,
}) {
  return (
    <div className="ui-state">
      <strong>{title}</strong>
      {(description || children) && <p>{description || children}</p>}
    </div>
  );
}
