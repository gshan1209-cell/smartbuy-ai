export default function EmptyState({ title='目前沒有資料', children }) { return <div className="ui-state"><strong>{title}</strong>{children && <p>{children}</p>}</div>; }
