import { useEffect, useState } from 'react';
import { Bell, Check, MessageCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { useAuth } from '../context/AuthContext';
import { loadNotificationPage, markAllNotificationsRead, markNotificationRead } from '../lib/notificationsAdapter';
import './ConsumerPages.css';

export default function Alerts() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [category, setCategory] = useState('全部');
  const load = () => { if (!isAuthenticated) return; setLoading(true); setError(''); loadNotificationPage({ limit: 20, offset: 0 }).then(setData).catch((err) => setError(err.message || '通知暫時無法取得')).finally(() => setLoading(false)); };
  useEffect(load, [isAuthenticated]);
  const markRead = (item) => { if (item.isRead) return; setData((current) => ({ ...current, items: current.items.map((entry) => entry.id === item.id ? { ...entry, isRead: true } : entry), unreadCount: Math.max((current.unreadCount || 0) - 1, 0) })); markNotificationRead(item.id).catch(() => load()); };
  const categories = ['全部', '價格', '天氣', '節氣', '互助網']; const unsupported = category !== '全部' && category !== '互助網';
  return <main className="consumer-page"><div className="consumer-page-inner"><header className="consumer-page-heading"><div><p className="eyebrow">Alerts</p><h1>提醒中心</h1><p>集中查看互助網的回覆與按讚通知。</p></div>{isAuthenticated && <button className="outline-action" onClick={() => { markAllNotificationsRead().then(load).catch(() => {}); }}><Check size={16} />全部標為已讀</button>}</header><nav className="alert-categories" aria-label="提醒分類">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}{item !== '互助網' && item !== '全部' ? '（尚未接入）' : ''}</button>)}</nav>{!isAuthenticated && <EmptyState title="登入後查看提醒" description="目前正式通知 API 只提供互助網通知，登入後即可查看你的通知。" action={<button className="consumer-link" onClick={() => navigate('/login')}>前往登入</button>} />}{isAuthenticated && unsupported && <EmptyState title={`${category}提醒尚未接入`} description="目前後端正式通知 API 只有互助網通知，這裡不建立虛構紀錄。" />}{isAuthenticated && !unsupported && loading && <LoadingState label="正在載入提醒…" />}{isAuthenticated && !unsupported && error && <EmptyState title="提醒暫時無法載入" description={error} action={<button className="consumer-link" onClick={load}><RefreshCw size={16} />重新載入</button>} />}{isAuthenticated && !unsupported && !loading && !error && data?.items?.length === 0 && <EmptyState title="目前沒有提醒" description="新的互助網回覆或按讚會顯示在這裡。" />}{isAuthenticated && !unsupported && !loading && !error && data?.items?.length > 0 && <section className="alert-list" aria-label="通知列表">{data.items.map((item) => <article className={`alert-item ${item.isRead ? '' : 'unread'}`} key={item.id} onClick={() => { markRead(item); navigate(`/mutual-aid?post=${item.postId}`); }}><div className="alert-icon"><MessageCircle size={19} /></div><div><strong>{item.type === 'mutual_aid_reply' ? `${item.actorName} 回覆了你的貼文` : `${item.actorName} 按讚了你的貼文`}</strong><p>{item.createdAt || '時間未提供'}</p></div>{!item.isRead && <span className="unread-dot" aria-label="未讀" />}</article>)}</section>}</div></main>;
}
