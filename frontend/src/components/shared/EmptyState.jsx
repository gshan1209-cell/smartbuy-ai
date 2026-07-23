export default function EmptyState({
  title = '目前沒有資料',
  description,
  action,
  children,
}) {
  return (
    <div className="ui-state">
      <strong>{title}</strong>
      {(description || children) && <p>{description || children}</p>}
      {action && <div className="ui-state-action">{action}</div>}
    </div>
  );
}
