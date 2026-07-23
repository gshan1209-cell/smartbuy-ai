import { useMemo, useState } from 'react';

export const TAIWAN_REGIONS = [
  {
    id: 'north',
    name: '北部',
    counties: ['臺北市', '新北市', '基隆市', '桃園市', '新竹縣', '新竹市', '宜蘭縣'],
  },
  {
    id: 'central',
    name: '中部',
    counties: ['臺中市', '苗栗縣', '彰化縣', '南投縣', '雲林縣'],
  },
  {
    id: 'south',
    name: '南部',
    counties: ['高雄市', '臺南市', '嘉義縣', '嘉義市', '屏東縣'],
  },
  {
    id: 'east_island',
    name: '東部及離島',
    counties: ['花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'],
  },
];

export const ALL_COUNTIES = TAIWAN_REGIONS.flatMap((r) => r.counties);

export default function CountySelector({ selectedCounty, onSelectCounty }) {
  const [selectedRegionId, setSelectedRegionId] = useState(() => {
    const found = TAIWAN_REGIONS.find((r) => r.counties.includes(selectedCounty));
    return found ? found.id : 'north';
  });

  const activeRegion = useMemo(() => (
    TAIWAN_REGIONS.find((r) => r.id === selectedRegionId) || TAIWAN_REGIONS[0]
  ), [selectedRegionId]);

  function handleRegionChange(regionId) {
    setSelectedRegionId(regionId);
    const region = TAIWAN_REGIONS.find((r) => r.id === regionId);
    if (region && region.counties.length > 0) {
      onSelectCounty(region.counties[0]);
    }
  }

  return (
    <div className="county-selector">
      <div className="county-selector-top">
        <label htmlFor="county-dropdown-select" className="sr-only">選擇縣市</label>
        <select
          id="county-dropdown-select"
          className="county-dropdown"
          value={selectedCounty}
          onChange={(e) => {
            const county = e.target.value;
            onSelectCounty(county);
            const found = TAIWAN_REGIONS.find((r) => r.counties.includes(county));
            if (found) setSelectedRegionId(found.id);
          }}
        >
          {ALL_COUNTIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <div className="region-chips" role="radiogroup" aria-label="臺灣分區切換">
          {TAIWAN_REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={selectedRegionId === r.id}
              className={`region-chip ${selectedRegionId === r.id ? 'region-chip--active' : ''}`}
              onClick={() => handleRegionChange(r.id)}
            >
              {r.name}
            </button>
          ))}
        </div>
      </div>

      <div className="county-chips" role="radiogroup" aria-label="縣市選取">
        {activeRegion.counties.map((county) => {
          const isSelected = selectedCounty === county;
          return (
            <button
              key={county}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={`county-chip ${isSelected ? 'county-chip--selected' : ''}`}
              onClick={() => onSelectCounty(county)}
            >
              {county}
            </button>
          );
        })}
      </div>
    </div>
  );
}
