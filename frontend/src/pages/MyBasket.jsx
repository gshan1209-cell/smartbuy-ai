import { useState, useEffect, useCallback } from 'react';
import PriceCard from '../components/PriceCard';
import { useApi, get } from '../hooks/useApi';
import './MyBasket.css';

const LS_KEY = 'smartbuy_basket';

function loadBasket() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
  catch { return []; }
}

function saveBasket(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export default function MyBasket() {
  const { data: productList } = useApi('/api/basket/products');
  const [basket,  setBasket]  = useState(loadBasket);
  const [advices, setAdvices] = useState([]);
  const [loading, setLoading] = useState(false);

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
    </div>
  );
}
