export default function SourceBadge({ type = 'Official API', label }) {
  const badgeConfig = {
    'Official API': { text: '正式 API', className: 'source-badge--official' },
    'Official Publication': { text: '官方統計', className: 'source-badge--publication' },
    'Static Seed': { text: 'Static Seed', className: 'source-badge--seed' },
    Demo: { text: '示範資料', className: 'source-badge--demo' },
    Unavailable: { text: '尚未接入', className: 'source-badge--unavailable' },
  }[type] || { text: type, className: 'source-badge--default' };

  return (
    <span className={`source-badge ${badgeConfig.className}`}>
      {label || badgeConfig.text}
    </span>
  );
}
