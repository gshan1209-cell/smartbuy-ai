import { useState } from 'react';
import { ArrowRight, Info, MapPin, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Card from '../shared/Card';
import SourceBadge from './SourceBadge';

const SAMPLE_PRODUCE_ORIGINS = {
  高麗菜: { origins: ['彰化縣', '雲林縣', '南投縣'], statusNote: '正式農業部產區資料尚未介接 API' },
  番茄: { origins: ['嘉義縣', '高雄市', '臺南市'], statusNote: '正式農業部產區資料尚未介接 API' },
  青蔥: { origins: ['宜蘭縣', '彰化縣', '雲林縣'], statusNote: '正式農業部產區資料尚未介接 API' },
  竹筍: { origins: ['新北市', '臺南市', '嘉義縣'], statusNote: '正式農業部產區資料尚未介接 API' },
};

export default function ProduceOriginPanel() {
  const navigate = useNavigate();
  const [selectedProduce, setSelectedProduce] = useState('高麗菜');
  const [customSearch, setCustomSearch] = useState('');

  const currentInfo = SAMPLE_PRODUCE_ORIGINS[selectedProduce] || {
    origins: ['雲林縣', '彰化縣'],
    statusNote: '正式農業部產區資料尚未介接 API',
  };

  function handleSearch(e) {
    e.preventDefault();
    if (customSearch.trim()) {
      setSelectedProduce(customSearch.trim());
    }
  }

  return (
    <Card className="produce-origin-panel">
      <div className="panel-header">
        <div>
          <h3>農產在哪 — 主要產地查詢</h3>
          <p>搜尋或選擇農產品，了解主要生產縣市與行情。</p>
        </div>
        <SourceBadge type="Unavailable" label="產地 API: 尚未接入" />
      </div>

      <div className="produce-selector-row">
        <div className="quick-produce-buttons">
          {Object.keys(SAMPLE_PRODUCE_ORIGINS).map((item) => (
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
          <input
            value={customSearch}
            onChange={(e) => setCustomSearch(e.target.value)}
            placeholder="輸入其他蔬果"
            aria-label="輸入其他蔬果"
          />
          <button type="submit" aria-label="搜尋產地">
            <Search size={16} />
          </button>
        </form>
      </div>

      <div className="origin-result-box">
        <div className="origin-title">
          <MapPin size={20} className="text-emerald-700" />
          <h4><strong>{selectedProduce}</strong> 的主要生產縣市與市場區域</h4>
        </div>

        <div className="origin-counties-list">
          {currentInfo.origins.map((county) => (
            <div key={county} className="origin-county-tag">
              <span>{county}</span>
            </div>
          ))}
        </div>

        <div className="origin-unavailable-notice">
          <Info size={16} className="shrink-0 text-amber-700" />
          <span>
            <strong>資料狀態說明：</strong>
            正式縣市栽培面積、產量排名與詳細產區 API 尚未正式介接。
            上述為種子參考資料，請點擊下方按鈕查詢各批發市場即時成交行情。
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
