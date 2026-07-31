import { useCallback, useEffect, useState } from 'react';
import { Coins, Gift, RefreshCw, TicketPercent } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { fetchCoupons, fetchMyCoupons, fetchPoints, redeemCoupon } from '../lib/rewardsApi';
import { createPointsDemoData } from './pointsDemoData';
import './PointsCenter.css';

const CHECK_IN_SESSION_KEY = 'smartbuy.points.checkin.completed';
const INITIAL_DEMO_DATA = createPointsDemoData();

function formatDate(value) {
  return value
    ? new Date(value).toLocaleString('zh-TW', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';
}

function hasCheckedInThisSession() {
  try {
    return globalThis.sessionStorage?.getItem(CHECK_IN_SESSION_KEY) === 'true';
  } catch {
    return false;
  }
}

function markCheckedInThisSession() {
  try {
    globalThis.sessionStorage?.setItem(CHECK_IN_SESSION_KEY, 'true');
    return true;
  } catch {
    return false;
  }
}

function addSessionCheckIn(summary) {
  return {
    ...summary,
    balance: (summary?.balance ?? 0) + 10,
    lifetime_earned: (summary?.lifetime_earned ?? 0) + 10,
    transactions: [
      {
        id: 'session-checkin',
        reason: '今日簽到',
        amount: 10,
        created_at: new Date().toISOString(),
      },
      ...(summary?.transactions || []),
    ],
  };
}

function couponStatusLabel(coupon) {
  if (coupon.member_coupon_status === 'used') return '已使用';
  if (coupon.member_coupon_status === 'expired') return '已過期';
  return '尚未使用';
}

export default function PointsCenter() {
  const { user, authLoading } = useAuth();
  const [points, setPoints] = useState(INITIAL_DEMO_DATA.points);
  const [coupons, setCoupons] = useState(INITIAL_DEMO_DATA.coupons);
  const [mine, setMine] = useState(INITIAL_DEMO_DATA.mine);
  const [loading, setLoading] = useState(false);
  const [demoMode, setDemoMode] = useState(true);
  const [checkedIn, setCheckedIn] = useState(hasCheckedInThisSession);
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState(null);

  const applyDemoData = useCallback(() => {
    const demo = createPointsDemoData();
    setPoints(hasCheckedInThisSession() ? addSessionCheckIn(demo.points) : demo.points);
    setCoupons(demo.coupons);
    setMine(demo.mine);
    setDemoMode(true);
  }, []);

  const load = useCallback(async () => {
    if (authLoading) return;
    if (!user) {
      applyDemoData();
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [summary, available, owned] = await Promise.all([
        fetchPoints(),
        fetchCoupons(),
        fetchMyCoupons(),
      ]);
      setPoints(hasCheckedInThisSession() ? addSessionCheckIn(summary) : summary);
      setCoupons(available);
      setMine(owned);
      setDemoMode(false);
    } catch {
      applyDemoData();
    } finally {
      setLoading(false);
    }
  }, [applyDemoData, authLoading, user]);

  useEffect(() => {
    load();
  }, [load]);

  function handleCheckIn() {
    if (checkedIn) return;
    markCheckedInThisSession();
    setCheckedIn(true);
    setPoints((current) => addSessionCheckIn(current));
    setMessage({
      type: 'success',
      text: '今日簽到完成，已在本次頁面工作階段增加 10 點。',
    });
  }

  async function handleRedeem(coupon) {
    setAction(coupon.id);
    setMessage(null);

    if (demoMode) {
      setPoints((current) => ({
        ...current,
        balance: current.balance - coupon.points_cost,
        lifetime_spent: current.lifetime_spent + coupon.points_cost,
        transactions: [
          {
            id: `demo-redeem-${coupon.id}`,
            reason: `兌換 ${coupon.title}`,
            amount: -coupon.points_cost,
            created_at: new Date().toISOString(),
          },
          ...(current.transactions || []),
        ],
      }));
      setCoupons((current) => current.map((item) => (
        item.id === coupon.id ? { ...item, owned: true } : item
      )));
      setMine((current) => [{
        ...coupon,
        id: `demo-owned-${coupon.id}`,
        redemption_code: `DEMO-${String(coupon.points_cost).padStart(3, '0')}`,
        member_coupon_status: 'active',
        redeemed_at: new Date().toISOString(),
      }, ...current]);
      setMessage({
        type: 'success',
        text: `展示兌換完成，已在本頁扣除 ${coupon.points_cost} 點。`,
      });
      setAction(null);
      return;
    }

    try {
      const result = await redeemCoupon(coupon.id);
      setMessage({
        type: 'success',
        text: `兌換成功，已扣除 ${coupon.points_cost} 點。兌換碼：${result.redemption_code}`,
      });
      await load();
    } catch {
      applyDemoData();
      setMessage({ type: 'info', text: '會員服務暫時無法使用，已切換為展示資料。' });
    } finally {
      setAction(null);
    }
  }

  return (
    <div className="points-page">
      <header className="points-heading">
        <div>
          <p className="eyebrow">SMARTBUY REWARDS</p>
          <h1>點數中心</h1>
          <p>每日簽到、分享高 CP 值好物都能累積點數。</p>
          {demoMode && <span className="points-data-note" role="status">展示資料</span>}
        </div>
        <button type="button" className="yz-btn yz-btn-gho" onClick={load} disabled={loading}>
          <RefreshCw size={16} />
          {loading ? '載入中…' : '重新整理'}
        </button>
      </header>

      {message && <div className={`points-alert ${message.type}`}>{message.text}</div>}

      <section className="points-summary-grid">
        <div className="points-balance-card">
          <Coins size={24} />
          <span>目前點數</span>
          <strong>{points?.balance?.toLocaleString('zh-TW') ?? '—'}</strong>
          <small>每日簽到 +10 點 · 分享商品 +20 點</small>
        </div>
        <div className="points-stat-card">
          <span>累積獲得</span>
          <strong>{points?.lifetime_earned?.toLocaleString('zh-TW') ?? '—'}</strong>
          <small>包含登入與好物推薦獎勵</small>
        </div>
        <div className="points-stat-card">
          <span>累積兌換</span>
          <strong>{points?.lifetime_spent?.toLocaleString('zh-TW') ?? '—'}</strong>
          <small>已用於兌換優惠券的點數</small>
        </div>
      </section>

      <section className="points-section points-checkin">
        <div className="points-section-title">
          <div>
            <h2>每日簽到</h2>
            <p>每日簽到可獲得 10 點。</p>
          </div>
        </div>
        <div className="points-checkin-action">
          <div>
            <strong>{checkedIn ? '今日已完成簽到' : '今天也來累積點數吧'}</strong>
            <span>簽到狀態僅保留於本次頁面工作階段。</span>
          </div>
          <button type="button" className="yz-btn yz-btn-g" onClick={handleCheckIn} disabled={checkedIn}>
            {checkedIn ? '今日已簽到' : '今日簽到'}
          </button>
        </div>
      </section>

      <section id="available-coupons" className="points-section">
        <div className="points-section-title">
          <div>
            <h2><TicketPercent size={20} />可兌換優惠券</h2>
            <p>每張券只能兌換一次，實際使用規則依商家公告。</p>
          </div>
        </div>
        {coupons.length === 0 ? (
          <div className="points-empty">目前沒有可兌換的優惠券。</div>
        ) : (
          <div className="coupon-card-grid">
            {coupons.map((coupon) => (
              <article className="coupon-card" key={coupon.id}>
                <div className="coupon-card-top">
                  <span className="coupon-icon"><Gift size={20} /></span>
                  <span className="coupon-cost">{coupon.points_cost} 點</span>
                </div>
                <h3>{coupon.title}</h3>
                <p>{coupon.description || '兌換後可於我的優惠券查看兌換碼。'}</p>
                <div className="coupon-meta">
                  <span>{coupon.discount_type === 'percent' ? `${coupon.discount_value}% off` : `折 ${coupon.discount_value} 元`}</span>
                  <span>{coupon.expires_at ? `至 ${formatDate(coupon.expires_at)}` : '無期限'}</span>
                </div>
                <button
                  type="button"
                  className="yz-btn yz-btn-g coupon-redeem-btn"
                  onClick={() => handleRedeem(coupon)}
                  disabled={action === coupon.id || coupon.owned || (points?.balance ?? 0) < coupon.points_cost}
                >
                  {coupon.owned
                    ? '已兌換'
                    : action === coupon.id
                      ? '兌換中…'
                      : (points?.balance ?? 0) < coupon.points_cost
                        ? '點數不足'
                        : demoMode ? '展示兌換' : '立即兌換'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="owned-coupons" className="points-section">
        <div className="points-section-title">
          <div>
            <h2>我的優惠券</h2>
            <p>兌換成功後，請在結帳或使用優惠時出示兌換碼。</p>
          </div>
        </div>
        {mine.length === 0 ? (
          <div className="points-empty">還沒有優惠券，先去兌換一張吧。</div>
        ) : (
          <div className="owned-coupon-list">
            {mine.map((coupon) => (
              <div className="owned-coupon" key={coupon.id}>
                <div>
                  <strong>{coupon.title}</strong>
                  <span>{coupon.description || 'SmartBuy AI 優惠券'}</span>
                  <span className="owned-coupon-status">狀態：{couponStatusLabel(coupon)}</span>
                </div>
                <code>{coupon.redemption_code}</code>
                <small>到期日：{coupon.expires_at ? formatDate(coupon.expires_at) : '無期限'}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="point-history" className="points-section points-history">
        <div className="points-section-title">
          <div>
            <h2>點數紀錄</h2>
            <p>每筆獎勵與兌換都會留下紀錄。</p>
          </div>
        </div>
        {(points?.transactions || []).length === 0 ? (
          <div className="points-empty">目前還沒有點數紀錄。</div>
        ) : (
          <div>
            {points.transactions.map((item) => (
              <div className="points-transaction" key={item.id}>
                <div>
                  <strong>{item.reason}</strong>
                  <small>{formatDate(item.created_at)}</small>
                </div>
                <b className={item.amount > 0 ? 'positive' : 'negative'}>
                  {item.amount > 0 ? '+' : ''}{item.amount} 點
                </b>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
