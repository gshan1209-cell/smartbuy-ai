import { useCallback, useEffect, useState } from 'react';
import { Calendar, ExternalLink, Info, MapPin, RefreshCw, Sparkles } from 'lucide-react';
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
  const countySource = data?.sources?.countyProduce;
  const isPartialError = pricesStatus === 'error' || pricesStatus === 'stale';
  const publicationUrl = data?.officialCountySources?.publication?.url;
  const openDataUrl = data?.officialCountySources?.openData?.url;

  return (
    <section className="home-agri-explorer-section" aria-label="農產探索">
      <HomeSectionHeader
        eyebrow="Agricultural Produce Explorer"
        title="農產探索"
        description="發現臺灣在地農特產品、本月當季推薦與農產來源。"
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
              <div className="explorer-source-group">
                <SourceBadge
                  type="Official Publication"
                  label="官方來源已確認"
                />
                <SourceBadge
                  type={countySource?.type || 'Unavailable'}
                  label={countySource?.status === 'demo' ? '目前內容：示範' : '資料介接中'}
                />
              </div>
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
                      <strong>{selectedCounty} 正式農產資料介接中</strong>
                      <p>官方統計來源已確認；待完成資料清理與 ETL 後，才會顯示縣市代表品項、面積、產量與排名。</p>
                    </div>
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

            <div className="official-agri-source-note">
              <Info size={17} aria-hidden="true" />
              <div>
                <strong>官方資料來源</strong>
                <p>縣市農產、生產面積、產量與排名將以農業部農業統計書刊及農情調查開放資料為準。</p>
                <div className="official-source-links">
                  {publicationUrl && (
                    <a href={publicationUrl} target="_blank" rel="noreferrer">
                      農業統計書刊 <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  )}
                  {openDataUrl && (
                    <a href={openDataUrl} target="_blank" rel="noreferrer">
                      農情調查開放資料 <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  )}
                </div>
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
              {data?.currentSolarTerm?.term_name && (
                <span className="monthly-term-tag">
                  目前節氣：<strong>{data.currentSolarTerm.term_name}</strong>
                </span>
              )}
            </div>

            <div className="monthly-produce-grid">
              {data?.monthlyProduce?.map((produce, index) => (
                <MonthlyProduceCard
                  key={produce.name}
                  produceItem={produce}
                  cookingSuggestion={data?.cookingSuggestions?.[index] || data?.cookingSuggestions?.[0]}
                />
              ))}
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
            <ProduceOriginPanel
              publicationUrl={publicationUrl}
              openDataUrl={openDataUrl}
            />
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
