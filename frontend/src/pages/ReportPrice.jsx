import { useState } from 'react';
import { useApi, post } from '../hooks/useApi';
import './ReportPrice.css';

export default function ReportPrice() {
  const { data: productList } = useApi('/api/basket/products');
  const [form, setForm] = useState({ product_name: '', market_name: '', price: '', note: '' });
  const [status, setStatus] = useState(null); // 'ok' | 'error' | null

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product_name || !form.market_name || !form.price) {
      setStatus('missing');
      return;
    }
    try {
      await post('/api/report', { ...form, price: parseFloat(form.price) });
      setStatus('ok');
      setForm({ product_name: '', market_name: '', price: '', note: '' });
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="rp-page">
      <div className="rp-card card">
        <form onSubmit={handleSubmit} className="rp-form">
          <div className="rp-field">
            <label className="rp-label">品項名稱 *</label>
            {productList?.products?.length > 0 ? (
              <select
                name="product_name"
                className="input"
                value={form.product_name}
                onChange={handleChange}
              >
                <option value="">請選擇品項</option>
                {productList.products.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            ) : (
              <input
                name="product_name"
                className="input"
                placeholder="例如：高麗菜"
                value={form.product_name}
                onChange={handleChange}
              />
            )}
          </div>

          <div className="rp-field">
            <label className="rp-label">市場名稱 *</label>
            <input
              name="market_name"
              className="input"
              placeholder="例如：台北一、南門市場"
              value={form.market_name}
              onChange={handleChange}
            />
          </div>

          <div className="rp-field">
            <label className="rp-label">實際價格（元/公斤）*</label>
            <input
              name="price"
              type="number"
              min="0"
              step="0.5"
              className="input"
              placeholder="例如：35"
              value={form.price}
              onChange={handleChange}
            />
          </div>

          <div className="rp-field">
            <label className="rp-label">備註（選填）</label>
            <textarea
              name="note"
              className="input rp-textarea"
              placeholder="例如：特價、促銷、有機..."
              value={form.note}
              onChange={handleChange}
              rows={3}
            />
          </div>

          {status === 'missing' && (
            <p className="rp-msg rp-warn">請填寫所有必填欄位（標示 * 的項目）</p>
          )}
          {status === 'ok' && (
            <p className="rp-msg rp-ok">✅ 回報成功，謝謝您的貢獻！</p>
          )}
          {status === 'error' && (
            <p className="rp-msg rp-err">❌ 送出失敗，請稍後再試</p>
          )}

          <button className="btn btn-primary rp-submit" type="submit">送出回報</button>
        </form>
      </div>
    </div>
  );
}
