import { useState } from 'react';
import { ArrowRight, ExternalLink, Info, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const QUICK_PRODUCE = ['高麗菜', '番茄', '青蔥', '竹筍'];

export default function ProduceOriginPanel({ publicationUrl, openDataUrl }) {
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
          <h3>農產在哪 — 產地資料查詢</h3>
          <p>選擇農產品，查看目前資料狀態與市場行情入口。</p>
        </div>
        <div className="explorer-source-group">
          <SourceBadge type="Official Publication" label="官方來源已確認" />
          <SourceBadge type="Unavailable" label="產地資料介接中" />
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
          <Info size={18} className="shrink-0 text-amber-700" aria-hidden="true" />
          <span>
            <strong>{selectedProduce} 的正式產地統計尚未介接。</strong>
            目前不顯示推測縣市、虛構產量或排名；完成農業部資料 ETL 後，才會呈現主要產區、種植面積、收穫量與年度。
          </span>
        </div>

        <div className="official-source-links">
          {publicationUrl && (
            <a href={publicationUrl} target="_blank" rel="noreferrer">
              查看農業統計書刊 <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
          {openDataUrl && (
            <a href={openDataUrl} target="_blank" rel="noreferrer">
              查看農情調查開放資料 <ExternalLink size={14} aria-hidden="true" />
            </a>
          )}
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
