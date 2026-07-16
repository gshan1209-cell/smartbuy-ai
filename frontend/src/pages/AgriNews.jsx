import { useState, useEffect } from 'react';
import { loadSavedNews, toggleSavedNews } from '../lib/savedNews';
import { loadBasket } from '../lib/basket';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';
const PAGE_SIZE = 12;

function matchedBasketItems(article, basket) {
  const text = (article.title ?? '') + ' ' + (article.summary ?? '');
  return basket.filter(name => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `(?<![\\u4e00-\\u9fff])${escaped}(?![\\u4e00-\\u9fff])`
    );
    return pattern.test(text);
  });
}

function formatDate(raw) {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

export default function AgriNews() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [savedIds, setSavedIds] = useState(() => loadSavedNews().map(a => a.id));
  const [basket] = useState(loadBasket);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('');

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
    setLoading(true);
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
        const rows = Array.isArray(data) ? data : (data.articles ?? []);
        setTotal(data.total ?? 0);
        setArticles(rows.map(row => ({
          id:          row.id ?? `fallback-${Math.random()}`,
          title:       row.title ?? '',
          date:        formatDate(row.published_date),
          source:      row.source_name ?? '',
          url:         row.source_url ?? '',
          summary:     (row.content_text ?? '').slice(0, 200).trim(),
          fullContent: row.content_text ?? '',
        })));
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [debouncedQuery, page, sourceFilter]);

  function handleToggleSave(e, article) {
    e.stopPropagation();
    const toSave = { ...article, summary: article.fullContent };
    const next = toggleSavedNews(toSave);
    setSavedIds(next.map(a => a.id));
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="yz-page" style={{ padding: '32px 40px 60px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>📰 農產新知</h1>
        <p style={{ fontSize: 13, color: 'var(--yz-mut)', marginBottom: 20 }}>
          彙整農業部、各大媒體農業相關報導，掌握最新產銷動態。
        </p>

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
            資料載入失敗：{error}
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
            const saved = savedIds.includes(article.id);
            const related = matchedBasketItems(article, basket);
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

                {related.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--yz-or)', fontWeight: 600, marginTop: 8 }}>
                    🧺 與你的菜籃相關：{related.join('、')}
                  </p>
                )}

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
      </div>
    </div>
  );
}
