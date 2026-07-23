export const MAP_COUNTIES = [
  { id: '宜蘭縣', name: '宜蘭', d: 'M 220 70 L 260 80 L 250 120 L 210 100 Z', cx: 235, cy: 92 },
  { id: '基隆市', name: '基隆', d: 'M 220 20 L 235 25 L 230 40 L 215 35 Z', cx: 225, cy: 30 },
  { id: '臺北市', name: '臺北', d: 'M 200 25 L 220 25 L 215 45 L 195 45 Z', cx: 207, cy: 35 },
  { id: '新北市', name: '新北', d: 'M 180 20 L 240 15 L 245 65 L 190 70 Z', cx: 200, cy: 55 },
  { id: '桃園市', name: '桃園', d: 'M 160 35 L 190 35 L 180 80 L 150 70 Z', cx: 170, cy: 55 },
  { id: '新竹縣', name: '竹縣', d: 'M 140 65 L 180 75 L 170 110 L 130 95 Z', cx: 155, cy: 86 },
  { id: '新竹市', name: '竹市', d: 'M 135 60 L 150 60 L 145 75 L 130 75 Z', cx: 140, cy: 67 },
  { id: '苗栗縣', name: '苗栗', d: 'M 120 95 L 165 105 L 150 145 L 110 130 Z', cx: 136, cy: 118 },
  { id: '臺中市', name: '臺中', d: 'M 110 130 L 190 145 L 180 185 L 100 170 Z', cx: 145, cy: 157 },
  { id: '彰化縣', name: '彰化', d: 'M 85 165 L 125 170 L 115 210 L 75 200 Z', cx: 100, cy: 186 },
  { id: '南投縣', name: '南投', d: 'M 125 170 L 195 185 L 180 250 L 115 230 Z', cx: 154, cy: 208 },
  { id: '雲林縣', name: '雲林', d: 'M 70 200 L 120 210 L 110 245 L 60 235 Z', cx: 90, cy: 222 },
  { id: '嘉義縣', name: '嘉縣', d: 'M 60 235 L 155 250 L 140 290 L 50 270 Z', cx: 100, cy: 261 },
  { id: '嘉義市', name: '嘉市', d: 'M 75 245 L 95 248 L 90 262 L 70 258 Z', cx: 82, cy: 253 },
  { id: '臺南市', name: '臺南', d: 'M 50 270 L 140 290 L 120 345 L 45 320 Z', cx: 88, cy: 306 },
  { id: '高雄市', name: '高雄', d: 'M 70 325 L 165 315 L 145 400 L 60 375 Z', cx: 110, cy: 353 },
  { id: '屏東縣', name: '屏東', d: 'M 100 375 L 145 375 L 125 470 L 80 460 Z', cx: 112, cy: 420 },
  { id: '花蓮縣', name: '花蓮', d: 'M 185 110 L 245 125 L 205 270 L 165 240 Z', cx: 200, cy: 185 },
  { id: '臺東縣', name: '臺東', d: 'M 155 250 L 205 270 L 165 410 L 125 365 Z', cx: 162, cy: 323 },
  { id: '澎湖縣', name: '澎湖', d: 'M 15 220 L 40 220 L 40 250 L 15 250 Z', cx: 27, cy: 235 },
  { id: '金門縣', name: '金門', d: 'M 10 110 L 35 110 L 35 135 L 10 135 Z', cx: 22, cy: 122 },
  { id: '連江縣', name: '馬祖', d: 'M 30 20 L 55 20 L 55 45 L 30 45 Z', cx: 42, cy: 32 },
];

export default function TaiwanCountyMap({ selectedCounty, onSelectCounty }) {
  function handleKeyDown(event, countyId) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelectCounty(countyId);
    }
  }

  return (
    <div className="taiwan-county-map-wrapper">
      <div className="map-caption">
        <strong>臺灣地圖選取</strong>
        <span>點擊地圖區塊可切換選取縣市</span>
      </div>
      <svg
        className="taiwan-county-svg"
        viewBox="0 0 280 490"
        role="img"
        aria-label="臺灣縣市互動地圖"
      >
        <g className="counties-group">
          {MAP_COUNTIES.map((county) => {
            const isSelected = selectedCounty === county.id;
            return (
              <g
                key={county.id}
                className={`county-path-group ${isSelected ? 'county-path-group--selected' : ''}`}
                tabIndex={0}
                role="button"
                aria-label={`${county.id}${isSelected ? ' (已選取)' : ''}`}
                onClick={() => onSelectCounty(county.id)}
                onKeyDown={(e) => handleKeyDown(e, county.id)}
              >
                <path
                  d={county.d}
                  className="county-shape"
                />
                <text
                  x={county.cx}
                  y={county.cy}
                  className="county-label-text"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {county.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
