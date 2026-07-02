import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PriceCard from '../components/PriceCard';
import { useApi, get } from '../hooks/useApi';
import { loadSavedNews, removeSavedNews } from '../lib/savedNews';
import { loadBasket, saveBasket } from '../lib/basket';
import './MyBasket.css';

// 找出收藏文章標題/內文中提到的菜籃品項，供「與你的菜籃相關」標示使用
function matchedBasketItems(article, basket) {
  return basket.filter(name => article.title.includes(name) || article.summary.includes(name));
}

export default function MyBasket() {
  const navigate = useNavigate();
  const { data: productList } = useApi('/api/basket/products');
  const [basket,  setBasket]  = useState(loadBasket);
  const [advices, setAdvices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedNews, setSavedNews] = useState(loadSavedNews);

  function handleRemoveSavedNews(id) {
    setSavedNews(removeSavedNews(id));
  }

  const fetchAdvice = useCallback(async (items) => {
    if (!items.length) { setAdvices([]); return; }
    setLoading(true);
    try {
      const data = await get(`/api/basket/advice?items=${encodeURIComponent(items.join(','))}`);
      setAdvices(data);
    } catch { setAdvices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchAdvice(basket);
  }, [basket, fetchAdvice]);

  function addItem(name) {
    if (!name || basket.includes(name)) return;
    const next = [...basket, name];
    setBasket(next);
    saveBasket(next);
  }

  function removeItem(name) {
    const next = basket.filter(n => n !== name);
    setBasket(next);
    saveBasket(next);
  }

  function clearBasket() {
    setBasket([]);
    saveBasket([]);
  }

  return (
    <div className="container mb-page">
      <h1 className="page-title">🧺 我的菜籃</h1>
      <p className="mb-desc">加入常買的品項，一鍵查看今日採買建議。清單儲存於本機，不會上傳。</p>

      {/* 加入品項 */}
      <div className="mb-add-row">
        <select
          className="input mb-select"
          defaultValue=""
          onChange={e => { addItem(e.target.value); e.target.value = ''; }}
        >
          <option value="" disabled>+ 選擇品項加入菜籃</option>
          {(productList?.products || [])
            .filter(p => !basket.includes(p))
            .map(p => <option key={p} value={p}>{p}</option>)
          }
        </select>
        {basket.length > 0 && (
          <button className="btn btn-secondary" onClick={clearBasket}>清空菜籃</button>
        )}
      </div>

      {/* 已選品項 chips */}
      {basket.length > 0 && (
        <div className="mb-chips">
          {basket.map(name => (
            <span key={name} className="mb-chip">
              {name}
              <button className="mb-chip-remove" onClick={() => removeItem(name)}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* 採買建議 */}
      {basket.length === 0 && (
        <p className="empty">菜籃是空的，請從上方選擇品項</p>
      )}

      {loading && <div className="spinner" />}

      {!loading && advices.length > 0 && (
        <div className="mb-grid">
          {advices.map((item, i) => (
            <PriceCard key={i} item={item} />
          ))}
        </div>
      )}

      {/* 收藏文章（來自農產新知頁，獨立於品項清單） */}
      <h2 className="page-title" style={{ fontSize: 20, marginTop: 40 }}>📰 收藏文章</h2>
      {savedNews.length === 0 ? (
        <p className="empty">還沒有收藏的文章，前往<a href="/news" onClick={e => { e.preventDefault(); navigate('/news'); }} style={{ color: 'var(--green)', fontWeight: 500 }}>農產新知</a>看看</p>
      ) : (
        <div className="mb-grid">
          {savedNews.map(article => {
            const related = matchedBasketItems(article, basket);
            return (
              <div key={article.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span className="badge badge-green">{article.tag}</span>
                  <button className="mb-chip-remove" onClick={() => handleRemoveSavedNews(article.id)} title="取消收藏">×</button>
                </div>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{article.title}</h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: related.length ? 8 : 0 }}>{article.summary}</p>
                {related.length > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--orange-dark)', fontWeight: 500 }}>
                    🧺 與你的菜籃相關：{related.join('、')}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
