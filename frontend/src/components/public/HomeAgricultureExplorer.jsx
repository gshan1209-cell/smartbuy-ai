import { useCallback, useEffect, useState } from 'react';
import { Calendar, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import AgricultureExplorerTabs from './AgricultureExplorerTabs';
import CountySelector from './CountySelector';
import HomeSectionHeader from './HomeSectionHeader';
import LocalSpecialtyCard from './LocalSpecialtyCard';
import MonthlyProduceCard from './MonthlyProduceCard';
import ProduceOriginPanel from './ProduceOriginPanel';
import SourceBadge from './SourceBadge';
import TaiwanCountyMap from './TaiwanCountyMap';
import { loadHomeAgricultureExplorer } from '../../lib/homeAgricultureExplorerAdapter';

export default function HomeAgricultureExplorer() {
  const [activeTab, setActiveTab] = useState('local');
  const [selectedCounty, setSelectedCounty] = useState('宜蘭縣');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (county, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await loadHomeAgricultureExplorer(county, data);
      setData(res);
    } catch (err) {
      setError(err?.message || '農產探索資料整理失敗。');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [data]);

  useEffect(() => {
    loadData(selectedCounty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCounty]);

  const pricesStatus = data?.sources?.prices?.status;
  const isPartialError = pricesStatus === 'error' || pricesStatus === 'stale';

  return (
    <section className="home-agri-explorer-section" aria-label="農產探索">
      <HomeSectionHeader
        eyebrow="Agricultural Produce Explorer"
        title="農產探索"
        description="發現臺灣在地農特產品、本月當季盛產與生產地分佈。"
      >
        {isPartialError && (
          <span className="dashboard-partial-badge">行情 API 部分異常</span>
        )}
        <button
          type="button"
          className="explorer-refresh-btn"
          onClick={() => loadData(selectedCounty, true)}
          disabled={refreshing}
          aria-label="重新整理農產探索資料"
        >
          <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          {refreshing ? '整理中…' : '重新整理'}
        </button>
      </HomeSectionHeader>

      <AgricultureExplorerTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="agri-explorer-content-box">
        {/* TAB 1: 在地特色 */}
        {activeTab === 'local' && (
          <div
            id="agri-tabpanel-local"
            role="tabpanel"
            aria-labelledby="agri-tab-local"
            className="agri-tabpanel"
          >
            <div className="local-explorer-heading">
              <div className="flex items-center gap-2">
                <MapPin className="text-emerald-700" size={22} />
                <h3>{selectedCounty} · 在地特色農產</h3>
              </div>
              <SourceBadge type="Unavailable" label="縣市資料: 正式 API 尚未接入" />
            </div>

            <CountySelector
              selectedCounty={selectedCounty}
              onSelectCounty={setSelectedCounty}
            />

            <div className="local-explorer-grid">
              <div className="desktop-map-container">
                <TaiwanCountyMap
                  selectedCounty={selectedCounty}
                  onSelectCounty={setSelectedCounty}
                />
              </div>

              <div className="local-specialties-container">
                {loading && !data && (
                  <div className="explorer-loading">正在載入 {selectedCounty} 特色農產…</div>
                )}
                {error && !data && (
                  <div className="explorer-error">
                    <p>{error}</p>
                    <button type="button" onClick={() => loadData(selectedCounty)}>重新載入</button>
                  </div>
                )}
                {data?.localSpecialties?.length > 0 && (
                  <div className="specialties-cards-grid">
                    {data.localSpecialties.map((item) => (
                      <LocalSpecialtyCard key={item.name} item={item} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: 本月尚青 */}
        {activeTab === 'monthly' && (
          <div
            id="agri-tabpanel-monthly"
            role="tabpanel"
            aria-labelledby="agri-tab-monthly"
            className="agri-tabpanel"
          >
            <div className="monthly-explorer-heading">
              <div className="flex items-center gap-2">
                <Calendar className="text-emerald-700" size={22} />
                <h3>{data?.selectedMonth || '本月'}尚青 · 當季盛產品項</h3>
              </div>
              {data?.currentSolarTerm?.term_name && (
                <span className="monthly-term-tag">
                  目前節氣：<strong>{data.currentSolarTerm.term_name}</strong>
                </span>
              )}
            </div>

            <div className="monthly-produce-grid">
              {data?.monthlyProduce?.map((produce, idx) => (
                <MonthlyProduceCard
                  key={produce.name}
                  produceItem={produce}
                  cookingSuggestion={data?.cookingSuggestions?.[idx] || data?.cookingSuggestions?.[0]}
                />
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: 農產在哪 */}
        {activeTab === 'origin' && (
          <div
            id="agri-tabpanel-origin"
            role="tabpanel"
            aria-labelledby="agri-tab-origin"
            className="agri-tabpanel"
          >
            <ProduceOriginPanel />
          </div>
        )}
      </div>

      <div className="explorer-footer-meta">
        <Sparkles size={14} className="text-emerald-600 inline mr-1" />
        <span>資料來源：SmartBuy AI 即時行情與節氣 Engine · 檢查時間：{data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString('zh-TW') : '未提供'}</span>
      </div>
    </section>
  );
}
