import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, Info, MapPin, RefreshCw, Sparkles } from 'lucide-react';
import AgricultureExplorerTabs from './AgricultureExplorerTabs';
import CountySelector from './CountySelector';
import HomeSectionHeader from './HomeSectionHeader';
import LocalSpecialtyCard from './LocalSpecialtyCard';
import MonthlyProduceCard from './MonthlyProduceCard';
import ProduceOriginPanel from './ProduceOriginPanel';
import TaiwanCountyMap from './TaiwanCountyMap';
import { loadHomeAgricultureExplorer, mapMarketsToCounties } from '../../lib/homeAgricultureExplorerAdapter';

export default function HomeAgricultureExplorer({ markets = [] }) {
  const [activeTab, setActiveTab] = useState('local');
  const availableCounties = useMemo(() => mapMarketsToCounties(markets), [markets]);
  const [selectedCounty, setSelectedCounty] = useState('臺中市');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (availableCounties.length > 0 && selectedCounty !== '全部' && !availableCounties.includes(selectedCounty)) {
      setSelectedCounty(availableCounties[1] || '全部');
    }
  }, [availableCounties, selectedCounty]);

  const loadData = useCallback(async (county, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await loadHomeAgricultureExplorer(county, data, isRefresh);
      setData(response);
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
  const isPriceError = pricesStatus === 'error';
  const visibleProduce = useMemo(() => {
    const source = activeTab === 'monthly' ? data?.monthlyProduce : data?.localSpecialties;
    return [...(source || [])].sort((left, right) => {
      const leftPrice = Number.isFinite(Number(left.todayPrice)) ? Number(left.todayPrice) : Number.POSITIVE_INFINITY;
      const rightPrice = Number.isFinite(Number(right.todayPrice)) ? Number(right.todayPrice) : Number.POSITIVE_INFINITY;
      return leftPrice - rightPrice || String(left.name).localeCompare(String(right.name), 'zh-Hant');
    });
  }, [activeTab, data]);

  return (
    <section className="home-agri-explorer-section" aria-label="農產探索">
      <HomeSectionHeader
        eyebrow="Agricultural Produce Explorer"
        title="農產探索"
        description="使用今日採買建議相同的價格行情 API，呈現此市場所能取得的品項。"
      >
        {isPriceError && (
          <span className="dashboard-partial-badge">行情 API 異常</span>
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
              <div className="local-explorer-heading-note">
                <p>本區僅使用與「今日採買建議」相同的價格行情 API，不包含其他官方農產統計來源。</p>
              </div>
            </div>
            <CountySelector
              selectedCounty={selectedCounty}
              onSelectCounty={setSelectedCounty}
              availableCounties={availableCounties}
            />

            <div className="local-explorer-grid">
              <div className="desktop-map-container">
                <TaiwanCountyMap
                  selectedCounty={selectedCounty}
                  onSelectCounty={setSelectedCounty}
                  availableCounties={availableCounties}
                />
              </div>

              <div className="local-specialties-container">
                {loading && !data && (
                  <div className="explorer-loading">正在整理 {selectedCounty} 農產資料…</div>
                )}
                {error && !data && (
                  <div className="explorer-error">
                    <p>{error}</p>
                    <button type="button" onClick={() => loadData(selectedCounty)}>重新載入</button>
                  </div>
                )}
                {!loading && !error && !data?.localSpecialties?.length && (
                  <div className="explorer-unavailable-card">
                    <Info size={22} aria-hidden="true" />
                    <div>
                      <strong>{selectedCounty} 目前未取得今日價格行情資料</strong>
                      <p>請切換其他縣市或前往查價頁面查看最新菜價。</p>
                    </div>
                  </div>
                )}
                {visibleProduce.length > 0 && (
                  <div className="specialties-cards-grid">
                    {visibleProduce.map((item) => (
                      <LocalSpecialtyCard key={item.name} item={item} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="official-agri-source-note">
              <Info size={17} aria-hidden="true" />
              <div>
                <strong>資料來源說明</strong>
                <p>本區資料直接來自「今日採買建議」使用的價格行情 API，不包含其他官方農產統計來源。</p>
              </div>
            </div>
          </div>
        )}

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
                <h3>{data?.selectedMonth || '本月'}尚青 · 當季推薦品項</h3>
              </div>
            </div>

            <div className="monthly-produce-grid">
              {visibleProduce.map((produce) => {
                return (
                  <MonthlyProduceCard
                    key={produce.name}
                    produceItem={produce}
                  />
                );
              })}
            </div>
          </div>
        )}

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
        <span>
          即時行情與節氣使用 SmartBuy AI 正式 API；縣市農產統計來源已確認但尚未完成 ETL。檢查時間：
          {data?.fetchedAt ? new Date(data.fetchedAt).toLocaleString('zh-TW') : '未提供'}
        </span>
      </div>
    </section>
  );
}
