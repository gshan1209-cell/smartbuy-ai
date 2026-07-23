import { useRef } from 'react';

const TABS = [
  { id: 'local', label: '在地特色', description: '探索臺灣各縣市代表農特產品' },
  { id: 'monthly', label: '本月尚青', description: '當月盛產蔬果與即時行情' },
  { id: 'origin', label: '農產在哪', description: '查詢蔬果主要產地與生長分佈' },
];

export default function AgricultureExplorerTabs({ activeTab, onTabChange }) {
  const tabRefs = useRef([]);

  function handleKeyDown(event, index) {
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      nextIndex = (index + 1) % TABS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = 0;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = TABS.length - 1;
    }

    if (nextIndex !== index) {
      onTabChange(TABS[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div
      className="agri-explorer-tabs"
      role="tablist"
      aria-label="農產探索功能分頁"
    >
      {TABS.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`agri-tab-${tab.id}`}
            ref={(el) => { tabRefs.current[idx] = el; }}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`agri-tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            className={`agri-tab-button ${isActive ? 'agri-tab-button--active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
          >
            <span className="agri-tab-title">{tab.label}</span>
            <span className="agri-tab-desc">{tab.description}</span>
          </button>
        );
      })}
    </div>
  );
}
