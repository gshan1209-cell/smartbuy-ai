import { useState } from 'react';
import { ArrowRight, ExternalLink, Info, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const QUICK_PRODUCE = ['高麗菜', '番茄', '青蔥', '竹筍'];

export default function ProduceOriginPanel() {
  const navigate = useNavigate();
  const [selectedProduce, setSelectedProduce] = useState('高麗菜');
  const [customSearch, setCustomSearch] = useState('');

  function handleSearch(event) {
    event.preventDefault();
    if (customSearch.trim()) setSelectedProduce(customSearch.trim());
  }

  return (
    <Card className="produce-origin-panel">
      <div className="panel-header">
        <div>
          <h3>農產在哪 — 市場行情搜尋</h3>
          <p>本區只使用今日價格行情 API，搜尋蔬果即可查看同一資料源的菜價結果。</p>
        </div>
      </div>

      <div className="produce-selector-row">
        <div className="quick-produce-buttons">
          {QUICK_PRODUCE.map((item) => (
            <button
              key={item}
              type="button"
              className={`produce-btn ${selectedProduce === item ? 'produce-btn--active' : ''}`}
              onClick={() => setSelectedProduce(item)}
            >
              {item}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="origin-search-form">
          <label htmlFor="origin-produce-search" className="sr-only">輸入其他蔬果</label>
          <input
            id="origin-produce-search"
            value={customSearch}
            onChange={(event) => setCustomSearch(event.target.value)}
            placeholder="輸入其他蔬果"
          />
          <button type="submit" aria-label="確認查詢農產品">
            <Search size={16} aria-hidden="true" />
          </button>
        </form>
      </div>

      <div className="origin-result-box">
        <div className="origin-unavailable-notice">
          <Info size={18} className="shrink-0 text-emerald-700" aria-hidden="true" />
          <span>
            <strong>{selectedProduce} 的產地統計未列入本區呈現。</strong>
            這裡僅顯示與今日採買建議相同的市場價行情來源。
          </span>
        </div>

        <div className="origin-action-row">
          <button
            type="button"
            className="consumer-link"
            onClick={() => navigate(`/search?q=${encodeURIComponent(selectedProduce)}`)}
          >
            查看 {selectedProduce} 市場今天菜價 <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </Card>
  );
}
