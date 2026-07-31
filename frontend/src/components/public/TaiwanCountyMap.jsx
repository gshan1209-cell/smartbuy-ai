import { useEffect, useState } from 'react';
import { GeoJSON, MapContainer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COUNTY_GEOJSON_URL = '/geo/twCounty2010.geo.json';

function countyId(properties) {
  return properties?.name || properties?.NAME || properties?.COUNTYNAME || properties?.C_Name || '';
}

export default function TaiwanCountyMap({ selectedCounty, onSelectCounty, availableCounties = null }) {
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState(false);
  const bounds = [[21.8, 119.2], [25.5, 122.1]];

  useEffect(() => {
    fetch(COUNTY_GEOJSON_URL)
      .then((response) => { if (!response.ok) throw new Error('GeoJSON unavailable'); return response.json(); })
      .then(setGeojson)
      .catch(() => setError(true));
  }, []);

  function isAvailable(id) {
    if (!availableCounties || availableCounties.length === 0) return true;
    return availableCounties.includes(id);
  }

  function style(feature) {
    const id = countyId(feature.properties);
    const selected = id === selectedCounty;
    const active = isAvailable(id);

    if (selected) {
      return { color: '#047857', weight: 3, fillColor: '#10b981', fillOpacity: 0.95 };
    }
    if (!active) {
      return { color: '#d1d5db', weight: 1, fillColor: '#f3f4f6', fillOpacity: 0.45 };
    }
    return { color: '#fff', weight: 1.2, fillColor: '#b7dfc2', fillOpacity: 0.78 };
  }

  function onEachFeature(feature, layer) {
    const id = countyId(feature.properties);
    const active = isAvailable(id);
    const labelText = id + (active ? '' : '（無資料）');
    layer.bindTooltip(labelText, {
      permanent: true,
      direction: 'center',
      className: active ? 'county-map-label' : 'county-map-label county-map-label--disabled',
    });
    if (active) {
      layer.on({ click: () => onSelectCounty(id) });
    }
  }

  return (
    <div className="taiwan-county-map-wrapper">
      <div className="map-caption">
        <strong>臺灣地圖選取</strong>
        <span>正式行政區 GeoJSON · 點擊有資料的縣市切換</span>
      </div>
      {error && <p className="map-load-error">地圖資料暫時無法載入，請使用上方縣市選單。</p>}
      <MapContainer
        className="taiwan-leaflet-map"
        bounds={bounds}
        maxBounds={bounds}
        minZoom={7}
        maxZoom={10}
        zoom={7}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl
      >
        {geojson && (
          <GeoJSON
            key={`${selectedCounty}-${availableCounties?.join(',') || 'all'}`}
            data={geojson}
            style={style}
            onEachFeature={onEachFeature}
          />
        )}
      </MapContainer>
      <small className="map-attribution">行政區資料：g0v/twgeojson（CC0）</small>
    </div>
  );
}
