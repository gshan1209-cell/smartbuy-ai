import { useCallback, useEffect, useState } from 'react';
import { Coins, Gift, RefreshCw, TicketPercent } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchCoupons, fetchMyCoupons, fetchPoints, redeemCoupon } from '../lib/rewardsApi';
import './PointsCenter.css';

function formatDate(value) {
  return value ? new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function PointsCenter() {
  const { user } = useAuth();
  const [points, setPoints] = useState(null);
  const [coupons, setCoupons] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const [summary, available, owned] = await Promise.all([fetchPoints(), fetchCoupons(), fetchMyCoupons()]);
      setPoints(summary);
      setCoupons(available);
      setMine(owned);
    } catch (err) {
      setError(err.message || '點數資料暫時無法載入。');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function handleRedeem(coupon) {
    setAction(coupon.id);
    setMessage(null);
    try {
      const result = await redeemCoupon(coupon.id);
      setMessage({ type: 'success', text: `兌換成功，已扣除 ${coupon.points_cost} 點。兌換碼：${result.redemption_code}` });
      await load();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || '兌換失敗。' });
    } finally {
      setAction(null);
    }
  }

  if (!user) {
    return <div className="points-page points-guest"><Coins size={36} /><h1>點數中心</h1><p>登入後即可領取每日點數、分享好物並兌換優惠券。</p><Link className="yz-btn yz-btn-g" to="/login">前往登入</Link></div>;
  }

  return (
    <div className="points-page">
      <header className="points-heading">
        <div><p className="eyebrow">SMARTBUY REWARDS</p><h1>點數中心</h1><p>登入送點數，分享高 CP 值好物也能累積點數。</p></div>
        <button type="button" className="yz-btn yz-btn-gho" onClick={load} disabled={loading}><RefreshCw size={16} />{loading ? '載入中…' : '重新整理'}</button>
      </header>
      {error && <div className="points-alert error">{error} 請確認資料庫 migration 已套用。</div>}
      {message && <div className={`points-alert ${message.type}`}>{message.text}</div>}

      <section className="points-summary-grid">
        <div className="points-balance-card"><Coins size={24} /><span>目前點數</span><strong>{points?.balance?.toLocaleString('zh-TW') ?? '—'}</strong><small>每日登入 +10 點 · 好物推薦 +20 點</small></div>
        <div className="points-stat-card"><span>累積獲得</span><strong>{points?.lifetime_earned?.toLocaleString('zh-TW') ?? '—'}</strong><small>包含登入與好物推薦獎勵</small></div>
        <div className="points-stat-card"><span>累積兌換</span><strong>{points?.lifetime_spent?.toLocaleString('zh-TW') ?? '—'}</strong><small>已用於兌換優惠券的點數</small></div>
      </section>

      <section className="points-section"><div className="points-section-title"><div><h2><TicketPercent size={20} />可兌換優惠券</h2><p>每張券只能兌換一次，實際使用規則依商家公告。</p></div></div>
        {loading ? <div className="points-empty">正在載入優惠券…</div> : coupons.length === 0 ? <div className="points-empty">目前沒有可兌換的優惠券。</div> : <div className="coupon-card-grid">{coupons.map(coupon => <article className="coupon-card" key={coupon.id}><div className="coupon-card-top"><span className="coupon-icon"><Gift size={20} /></span><span className="coupon-cost">{coupon.points_cost} 點</span></div><h3>{coupon.title}</h3><p>{coupon.description || '兌換後可於我的優惠券查看兌換碼。'}</p><div className="coupon-meta"><span>{coupon.discount_type === 'percent' ? `${coupon.discount_value}% off` : `折 ${coupon.discount_value} 元`}</span><span>{coupon.expires_at ? `至 ${formatDate(coupon.expires_at)}` : '無期限'}</span></div><button type="button" className="yz-btn yz-btn-g coupon-redeem-btn" onClick={() => handleRedeem(coupon)} disabled={action === coupon.id || coupon.owned || (points?.balance ?? 0) < coupon.points_cost}>{coupon.owned ? '已兌換' : action === coupon.id ? '兌換中…' : (points?.balance ?? 0) < coupon.points_cost ? '點數不足' : '立即兌換'}</button></article>)}</div>}
      </section>

      <section className="points-section"><div className="points-section-title"><div><h2>我的優惠券</h2><p>兌換成功後，請在結帳或使用優惠時出示兌換碼。</p></div></div>{mine.length === 0 ? <div className="points-empty">還沒有優惠券，先去兌換一張吧。</div> : <div className="owned-coupon-list">{mine.map(coupon => <div className="owned-coupon" key={coupon.id}><div><strong>{coupon.title}</strong><span>{coupon.description || 'SmartBuy AI 優惠券'}</span></div><code>{coupon.redemption_code}</code><small>{formatDate(coupon.created_at)}</small></div>)}</div>}</section>

      <section className="points-section points-history"><div className="points-section-title"><div><h2>點數紀錄</h2><p>每筆獎勵與兌換都會留下紀錄。</p></div></div>{(points?.transactions || []).length === 0 ? <div className="points-empty">目前還沒有點數紀錄。</div> : <div>{points.transactions.map(item => <div className="points-transaction" key={item.id}><div><strong>{item.reason}</strong><small>{formatDate(item.created_at)}</small></div><b className={item.amount > 0 ? 'positive' : 'negative'}>{item.amount > 0 ? '+' : ''}{item.amount} 點</b></div>)}</div>}</section>
    </div>
  );
}
