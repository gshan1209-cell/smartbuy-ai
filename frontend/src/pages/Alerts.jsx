import { useCallback, useEffect, useState } from 'react';
import { Check, MessageCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Toast from '../components/Toast';
import EmptyState from '../components/shared/EmptyState';
import LoadingState from '../components/shared/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';
import {
  loadNotificationPage,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notificationsAdapter';
import './ConsumerPages.css';

const PAGE_SIZE = 20;
const CATEGORIES = ['全部', '價格', '天氣', '節氣', '互助網'];

export default function Alerts() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [toastMessage, showToast] = useToast();
  const [data, setData] = useState({ items: [], total: 0, unreadCount: 0 });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('全部');

  const load = useCallback(async (offset = 0) => {
    if (!isAuthenticated) return;

    if (offset === 0) setLoading(true);
    else setLoadingMore(true);
    setError('');

    try {
      const page = await loadNotificationPage({ limit: PAGE_SIZE, offset });
      setData((current) => ({
        ...page,
        items: offset === 0 ? page.items : [...current.items, ...page.items],
      }));
    } catch (err) {
      setError(err.message || '通知暫時無法取得');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) load(0);
    else setData({ items: [], total: 0, unreadCount: 0 });
  }, [isAuthenticated, load]);

  async function openNotification(item) {
    if (!item.isRead) {
      const previous = data;
      setData((current) => ({
        ...current,
        items: current.items.map((entry) => (
          entry.id === item.id ? { ...entry, isRead: true } : entry
        )),
        unreadCount: Math.max((current.unreadCount || 0) - 1, 0),
      }));

      try {
        await markNotificationRead(item.id);
      } catch {
        setData(previous);
        showToast('標記已讀失敗，請稍後再試');
        return;
      }
    }

    navigate(item.target);
  }

  async function markAllRead() {
    if (!data.unreadCount) return;
    const previous = data;
    setData((current) => ({
      ...current,
      unreadCount: 0,
      items: current.items.map((item) => ({ ...item, isRead: true })),
    }));

    try {
      await markAllNotificationsRead();
      showToast('所有通知已標為已讀');
    } catch {
      setData(previous);
      showToast('操作失敗，已恢復原狀態');
    }
  }

  const unsupported = category !== '全部' && category !== '互助網';
  const hasMore = data.items.length < data.total;

  return (
    <main className="consumer-page">
      <div className="consumer-page-inner">
        <header className="consumer-page-heading">
          <div>
            <p className="eyebrow">Alerts</p>
            <h1>提醒中心</h1>
            <p>集中查看互助網的回覆與按讚通知。</p>
          </div>
          {isAuthenticated && data.unreadCount > 0 && (
            <button className="outline-action" onClick={markAllRead}>
              <Check size={16} />全部標為已讀
            </button>
          )}
        </header>

        <nav className="alert-categories" aria-label="提醒分類">
          {CATEGORIES.map((item) => (
            <button
              type="button"
              key={item}
              className={category === item ? 'active' : ''}
              onClick={() => setCategory(item)}
            >
              {item}
              {item !== '互助網' && item !== '全部' ? '（尚未接入）' : ''}
            </button>
          ))}
        </nav>

        {!isAuthenticated && (
          <EmptyState
            title="登入後查看提醒"
            description="目前正式通知 API 只提供互助網通知，登入後即可查看你的通知。"
            action={<button className="consumer-link" onClick={() => navigate('/login')}>前往登入</button>}
          />
        )}

        {isAuthenticated && unsupported && (
          <EmptyState
            title={`${category}提醒尚未接入`}
            description="目前後端正式通知 API 只有互助網通知，這裡不建立虛構紀錄。"
          />
        )}

        {isAuthenticated && !unsupported && loading && (
          <LoadingState label="正在載入提醒…" />
        )}

        {isAuthenticated && !unsupported && error && !data.items.length && (
          <EmptyState
            title="提醒暫時無法載入"
            description={error}
            action={(
              <button className="consumer-link" onClick={() => load(0)}>
                <RefreshCw size={16} />重新載入
              </button>
            )}
          />
        )}

        {isAuthenticated && !unsupported && !loading && !error && !data.items.length && (
          <EmptyState
            title="目前沒有提醒"
            description="新的互助網回覆或按讚會顯示在這裡。"
          />
        )}

        {isAuthenticated && !unsupported && data.items.length > 0 && (
          <section className="alert-list" aria-label="通知列表">
            {data.items.map((item) => (
              <button
                type="button"
                className={`alert-item ${item.isRead ? '' : 'unread'}`}
                key={item.id}
                onClick={() => openNotification(item)}
              >
                <span className="alert-icon"><MessageCircle size={19} /></span>
                <span className="alert-copy">
                  <strong>{item.title}</strong>
                  <small>{item.createdAt || '時間未提供'}</small>
                </span>
                {!item.isRead && <span className="unread-dot" aria-label="未讀" />}
              </button>
            ))}

            {error && <p className="inline-error">{error}</p>}
            {hasMore && (
              <button
                type="button"
                className="outline-action alert-load-more"
                disabled={loadingMore}
                onClick={() => load(data.items.length)}
              >
                {loadingMore ? '載入中…' : '載入更多'}
              </button>
            )}
          </section>
        )}
      </div>
      <Toast message={toastMessage} />
    </main>
  );
}
