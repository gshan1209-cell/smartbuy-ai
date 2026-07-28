import { useState, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { fetchFavorites, addFavorite, removeFavorite } from '../lib/favoritesService';
import { useToast } from '../hooks/useToast';
import Toast from '../components/Toast';
import MutualAid from './MutualAid';
import './AgriNews.css';

const API_BASE = import.meta.env.VITE_API_URL ?? '';
const PAGE_SIZE = 12;
const NEWS_CACHE_PREFIX = 'smartbuy:agri-news:v1:';
const INFO_SHARE_COPY = {
  title: '資訊分享',
  description: '產地、栽培、產品與採購相關的實用分享集中在這裡。',
  action: '前往資訊分享',
};

function getNewsCacheKey({ query = '', source = '', page = 1 } = {}) {
  return `${NEWS_CACHE_PREFIX}${JSON.stringify({ query: query.trim(), source, page })}`;
}

function readNewsCache(key) {
  try {
    const cached = JSON.parse(window.localStorage.getItem(key) || 'null');
    return cached && Array.isArray(cached.articles) ? cached : null;
  } catch (_) {
    return null;
  }
}

function writeNewsCache(key, payload) {
  try {
    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch (_) {
    // Storage may be disabled or full; the API result remains usable.
  }
}

function normalizeNewsResponse(data) {
  const rows = Array.isArray(data) ? data : (Array.isArray(data?.articles) ? data.articles : []);
  return {
    total: Number.isFinite(Number(data?.total)) ? Number(data.total) : rows.length,
    articles: rows.map(row => ({
      id:          row.id ?? `fallback-${Math.random()}`,
      title:       row.title ?? '',
      date:        formatDate(row.published_date),
      source:      row.source_name ?? '',
      url:         row.source_url ?? '',
      summary:     (row.content_text ?? '').slice(0, 200).trim(),
      fullContent: row.content_text ?? '',
    })),
  };
}

function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

function AgriNewsArticles() {
  const [searchParams] = useSearchParams();
  const searchParamString = searchParams.toString();
  const initialCache = readNewsCache(getNewsCacheKey({
    query: searchParams.get('q') || '',
    source: searchParams.get('source') || '',
    page: 1,
  }));
  const [articles, setArticles] = useState(initialCache?.articles || []);
  const [loading, setLoading] = useState(!initialCache);
  const [error, setError] = useState(null);
  const [stale, setStale] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState(() => searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(() => searchParams.get('q') || '');
  const [savedIds, setSavedIds] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(initialCache?.total || 0);
  const [sources, setSources] = useState([]);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [sourceFilter, setSourceFilter] = useState(() => searchParams.get('source') || '');
  const [toastMsg, showToast] = useToast();

  useEffect(() => {
    setQuery(searchParams.get('q') || '');
    setSourceFilter(searchParams.get('source') || '');
  }, [searchParamString]);

  useEffect(() => {
    let cancelled = false;
    fetchFavorites('news')
      .then(data => { if (!cancelled) setSavedIds(data.map(a => String(a.id))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    fetch(`${API_BASE}/api/news/sources`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => setSources(data.sources ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [debouncedQuery, sourceFilter]);

  useEffect(() => {
    setExpandedId(null);
    const cacheKey = getNewsCacheKey({ query: debouncedQuery, source: sourceFilter, page });
    const cached = readNewsCache(cacheKey);
    if (cached) {
      setArticles(cached.articles);
      setTotal(cached.total);
    }
    setStale(false);
    setLoading(!cached);
    setError(null);
    const params = new URLSearchParams({
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    });
    if (debouncedQuery.trim()) params.set('q', debouncedQuery.trim());
    if (sourceFilter) params.set('source', sourceFilter);
    fetch(`${API_BASE}/api/news?${params}`)
      .then(async r => {
        if (!r.ok) {
          let msg = `HTTP ${r.status}`;
          try {
            const body = await r.json();
            if (body?.detail) msg = body.detail;
          } catch (_) {}
          throw new Error(msg);
        }
        return r.json();
      })
      .then(data => {
        const normalized = normalizeNewsResponse(data);
        setTotal(normalized.total);
        setArticles(normalized.articles);
        setStale(false);
        writeNewsCache(cacheKey, normalized);
      })
      .catch(err => {
        if (!cached) setError(err.message);
        setStale(Boolean(cached));
      })
      .finally(() => setLoading(false));
  }, [debouncedQuery, page, sourceFilter, reloadNonce]);

  function handleToggleSave(e, article) {
    e.stopPropagation();
    const id = String(article.id);
    if (savedIds.includes(id)) {
      setSavedIds(prev => prev.filter(x => x !== id));
      removeFavorite('news', id)
        .then(() => showToast('已從我的菜籃移除'))
        .catch(() => {
          setSavedIds(prev => [...prev, id]);
          showToast('操作失敗，請稍後再試');
        });
    } else {
      setSavedIds(prev => [...prev, id]);
      addFavorite('news', id, {
        title: article.title,
        summary: article.fullContent,
        source: article.source,
        url: article.url,
        date: article.date,
      })
        .then(() => showToast('已加入我的菜籃'))
        .catch(() => {
          setSavedIds(prev => prev.filter(x => x !== id));
          showToast('操作失敗，請稍後再試');
        });
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="yz-page" style={{ padding: '32px 40px 60px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <input
              className="yz-input"
              placeholder="搜尋標題或內容關鍵字..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ maxWidth: 360, paddingRight: query ? 28 : undefined }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                title="清除搜尋"
                style={{
                  position: 'absolute', right: 8, top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 14, color: 'var(--yz-mut)', padding: 0, lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>

          {sources.length > 0 && (
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              className="yz-input"
              style={{ maxWidth: 180, cursor: 'pointer' }}
            >
              <option value="">全部來源</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}

          {(sourceFilter || query) && (
            <button
              onClick={() => { setSourceFilter(''); setQuery(''); }}
              style={{
                fontSize: 12, color: 'var(--yz-mut)', background: 'none',
                border: '1px solid var(--yz-bdr)', borderRadius: 6,
                padding: '4px 10px', cursor: 'pointer',
              }}
            >
              清除篩選
            </button>
          )}
        </div>

        {loading && (
          <p style={{ fontSize: 13, color: 'var(--yz-mut)', padding: '32px 0', textAlign: 'center' }}>
            載入中…
          </p>
        )}
        {!loading && error && (
          <p style={{ fontSize: 13, color: '#e53e3e', padding: '32px 0', textAlign: 'center' }}>
            資料暫時無法取得：{error}{' '}
            <button type="button" onClick={() => setReloadNonce(value => value + 1)} style={{ color: 'var(--yz-g)', background: 'none', border: 0, cursor: 'pointer' }}>
              重試
            </button>
          </p>
        )}
        {!loading && stale && (
          <p style={{ fontSize: 12, color: 'var(--yz-or)', margin: '0 0 16px' }}>
            目前顯示本機快取的新知，最新資料暫時無法取得；{` `}
            <button type="button" onClick={() => setReloadNonce(value => value + 1)} style={{ color: 'var(--yz-g)', background: 'none', border: 0, cursor: 'pointer', padding: 0 }}>
              重新整理
            </button>
          </p>
        )}
        {!loading && !error && articles.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--yz-mut)', padding: '32px 0', textAlign: 'center' }}>
            {debouncedQuery ? `找不到符合「${debouncedQuery}」的文章` : '目前沒有文章'}
          </p>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 440px), 1fr))',
          gap: 16,
        }}>
          {articles.map(article => {
            const expanded = expandedId === article.id;
            const saved = savedIds.includes(String(article.id));
            return (
              <div
                key={article.id}
                className="yz-card"
                style={{ padding: '18px 20px', cursor: 'pointer' }}
                onClick={() => setExpandedId(expanded ? null : article.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={{
                    fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
                    background: 'var(--yz-bg2)', color: 'var(--yz-mut)', border: '1px solid var(--yz-bdr)',
                  }}>
                    {article.source}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--yz-dim)' }}>{article.date}</span>
                    <button
                      onClick={e => handleToggleSave(e, article)}
                      title={saved ? '取消收藏' : '收藏'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 16, padding: 0, lineHeight: 1,
                        color: saved ? 'var(--yz-or)' : 'var(--yz-dim)',
                      }}
                    >
                      {saved ? '★' : '☆'}
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, lineHeight: 1.5 }}>
                  {article.title}
                </h3>

                <p style={{
                  fontSize: 13, color: 'var(--yz-mut)', lineHeight: 1.7,
                  display: '-webkit-box', WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: expanded ? 'unset' : 2,
                  overflow: expanded ? 'visible' : 'hidden',
                }}>
                  {article.summary}
                </p>

                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', marginTop: 12,
                  borderTop: '1px solid var(--yz-bdr)', paddingTop: 10,
                }}>
                  {article.url ? (
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{
                        fontSize: 12, color: 'var(--yz-g)', textDecoration: 'none',
                        padding: '4px 10px', borderRadius: 6,
                        border: '1px solid var(--yz-bdr)',
                        background: 'var(--yz-bg2)',
                        display: 'inline-block',
                      }}
                    >
                      閱讀原文 ↗
                    </a>
                  ) : (
                    <span />
                  )}
                  <span style={{ fontSize: 12, color: 'var(--yz-g)', fontWeight: 600 }}>
                    {expanded ? '收合 ↑' : '展開 →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {totalPages > 1 && (
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            gap: 6, marginTop: 32, flexWrap: 'wrap',
          }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid var(--yz-bdr)',
                background: 'var(--yz-bg2)', color: 'var(--yz-txt)',
                cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.4 : 1, fontSize: 13,
              }}
            >
              ‹ 上頁
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce((acc, n, idx, arr) => {
                if (idx > 0 && n - arr[idx - 1] > 1) acc.push('...');
                acc.push(n);
                return acc;
              }, [])
              .map((item, idx) =>
                item === '...'
                  ? <span key={`ellipsis-${idx}`} style={{ fontSize: 13, color: 'var(--yz-mut)', padding: '0 4px' }}>…</span>
                  : (
                    <button
                      key={item}
                      onClick={() => setPage(item)}
                      style={{
                        padding: '4px 10px', borderRadius: 6, fontSize: 13,
                        border: '1px solid var(--yz-bdr)',
                        background: page === item ? 'var(--yz-g)' : 'var(--yz-bg2)',
                        color: page === item ? '#fff' : 'var(--yz-txt)',
                        cursor: 'pointer', fontWeight: page === item ? 700 : 400,
                      }}
                    >
                      {item}
                    </button>
                  )
              )
            }

            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid var(--yz-bdr)',
                background: 'var(--yz-bg2)', color: 'var(--yz-txt)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1, fontSize: 13,
              }}
            >
              下頁 ›
            </button>

            <span style={{ fontSize: 12, color: 'var(--yz-mut)', marginLeft: 8 }}>
              共 {total} 筆
            </span>
          </div>
        )}

        <section className="agri-news-info-callout" aria-label={INFO_SHARE_COPY.title}>
          <div>
            <strong>{INFO_SHARE_COPY.title}</strong>
            <span>{INFO_SHARE_COPY.description}</span>
          </div>
          <Link className="agri-news-info-link" to="/news?section=information-sharing">查看資訊分享</Link>
        </section>
      </div>
      <Toast message={toastMsg} />
    </div>
  );
}

function ContentHubTabs({ activeSection }) {
  return (
    <nav className="content-hub-tabs" aria-label="新知與資訊分享分頁">
      <Link
        className={activeSection === 'news' ? 'is-active' : ''}
        to="/news"
        aria-current={activeSection === 'news' ? 'page' : undefined}
      >
        📰 農產新知
      </Link>
      <Link
        className={activeSection === 'information-sharing' ? 'is-active' : ''}
        to="/news?section=information-sharing"
        aria-current={activeSection === 'information-sharing' ? 'page' : undefined}
      >
        📣 資訊分享
      </Link>
    </nav>
  );
}

export default function AgriNews() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const isInformationSharing = pathname === '/information-sharing'
    || searchParams.get('section') === 'information-sharing';
  const activeSection = isInformationSharing ? 'information-sharing' : 'news';

  return (
    <div className="content-hub-page">
      <ContentHubTabs activeSection={activeSection} />
      {isInformationSharing ? <MutualAid allowedTypes={['資訊分享']} /> : <AgriNewsArticles />}
    </div>
  );
}
