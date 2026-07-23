import { useEffect, useState } from 'react';
import { GeoJSON, MapContainer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const COUNTY_GEOJSON_URL = '/geo/twCounty2010.geo.json';

function countyId(properties) {
  return properties?.name || properties?.NAME || properties?.COUNTYNAME || properties?.C_Name || '';
}

export default function TaiwanCountyMap({ selectedCounty, onSelectCounty }) {
  const [geojson, setGeojson] = useState(null);
  const [error, setError] = useState(false);
  const bounds = [[21.8, 119.2], [25.5, 122.1]];

  useEffect(() => {
    fetch(COUNTY_GEOJSON_URL)
      .then((response) => { if (!response.ok) throw new Error('GeoJSON unavailable'); return response.json(); })
      .then(setGeojson)
      .catch(() => setError(true));
  }, []);

  function style(feature) {
    const selected = countyId(feature.properties) === selectedCounty;
    return { color: selected ? '#047857' : '#fff', weight: selected ? 3 : 1.2, fillColor: selected ? '#10b981' : '#b7dfc2', fillOpacity: selected ? 0.95 : 0.78 };
  }

  function onEachFeature(feature, layer) {
    const id = countyId(feature.properties);
    layer.bindTooltip(id, { permanent: true, direction: 'center', className: 'county-map-label' });
    layer.on({ click: () => onSelectCounty(id) });
  }

  return <div className="taiwan-county-map-wrapper"><div className="map-caption"><strong>臺灣地圖選取</strong><span>正式行政區 GeoJSON · 點擊縣市切換</span></div>{error && <p className="map-load-error">地圖資料暫時無法載入，請使用上方縣市選單。</p>}<MapContainer className="taiwan-leaflet-map" bounds={bounds} maxBounds={bounds} minZoom={7} maxZoom={10} zoom={7} scrollWheelZoom={false} zoomControl={false} attributionControl><GeoJSON key={selectedCounty} data={geojson || { type: 'FeatureCollection', features: [] }} style={style} onEachFeature={onEachFeature} /></MapContainer><small className="map-attribution">行政區資料：g0v/twgeojson（CC0）</small></div>;
}
