const riskStyle = {
  '高':   { bg: 'bg-amber-50 border-amber-300',  text: 'text-amber-900',  icon: '⚠️' },
  '很高': { bg: 'bg-red-50 border-red-300',      text: 'text-red-900',    icon: '🚨' },
  '中':   { bg: 'bg-blue-50 border-blue-200',    text: 'text-blue-900',   icon: 'ℹ️' },
};

export default function AlertCard({ title, message, riskLevel }) {
  const style = riskStyle[riskLevel] || { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-900', icon: 'ℹ️' };
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 mb-3 ${style.bg}`}>
      <span className="text-xl mt-0.5">{style.icon}</span>
      <div>
        <p className={`font-semibold text-sm ${style.text}`}>{title}</p>
        <p className={`text-sm mt-0.5 leading-relaxed ${style.text} opacity-80`}>{message}</p>
      </div>
    </div>
  );
}
