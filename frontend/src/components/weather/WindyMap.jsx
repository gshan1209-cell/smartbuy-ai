import { useEffect, useRef } from 'react';
import { fetchWeeklyForecast } from '../../lib/cwaApi';

const LEAFLET_SRC = 'https://unpkg.com/leaflet@1.4.0/dist/leaflet.js';
const WINDY_SRC = 'https://api.windy.com/assets/map-forecast/libBoot.js';

const TAIWAN_CITIES = [
  { name: '臺北市', lat: 25.0330, lon: 121.5654 },
  { name: '新北市', lat: 25.0120, lon: 121.4653 },
  { name: '桃園市', lat: 24.9936, lon: 121.3010 },
  { name: '臺中市', lat: 24.1477, lon: 120.6736 },
  { name: '臺南市', lat: 22.9998, lon: 120.2269 },
  { name: '高雄市', lat: 22.6273, lon: 120.3014 },
  { name: '基隆市', lat: 25.1276, lon: 121.7392 },
  { name: '新竹市', lat: 24.8066, lon: 120.9686 },
  { name: '嘉義市', lat: 23.4801, lon: 120.4491 },
  { name: '新竹縣', lat: 24.7036, lon: 121.1533 },
  { name: '苗栗縣', lat: 24.5602, lon: 120.8214 },
  { name: '彰化縣', lat: 24.0752, lon: 120.5161 },
  { name: '南投縣', lat: 23.9610, lon: 120.9720 },
  { name: '雲林縣', lat: 23.7092, lon: 120.5431 },
  { name: '嘉義縣', lat: 23.4518, lon: 120.2554 },
  { name: '屏東縣', lat: 22.6761, lon: 120.4942 },
  { name: '宜蘭縣', lat: 24.7021, lon: 121.7378 },
  { name: '花蓮縣', lat: 23.9871, lon: 121.6015 },
  { name: '臺東縣', lat: 22.7972, lon: 121.1071 },
  { name: '澎湖縣', lat: 23.5711, lon: 119.5793 },
  { name: '金門縣', lat: 24.4493, lon: 118.3765 },
  { name: '連江縣', lat: 26.1609, lon: 119.9522 },
];

const forecastCache = new Map();

async function getCityForecast(name) {
  if (forecastCache.has(name)) return forecastCache.get(name);
  const data = await fetchWeeklyForecast(name);
  forecastCache.set(name, data);
  return data;
}

function formatTime(isoString) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
}

function buildPopupHTML(name, forecast) {
  const row = forecast[0];
  if (!row) {
    return `<div class="weather-city-popup"><div class="weather-city-popup__name">${name}</div><div class="weather-city-popup__error">無資料</div></div>`;
  }
  return `
    <div class="weather-city-popup">
      <div class="weather-city-popup__name">${name}</div>
      <div class="weather-city-popup__time">${formatTime(row.startTime)} ～ ${formatTime(row.endTime)}</div>
      <div class="weather-city-popup__wx">${row.Wx}</div>
      <div class="weather-city-popup__temp">🌡 ${row.MinT}°C ～ ${row.MaxT}°C</div>
      <div class="weather-city-popup__pop">🌧 降雨機率 ${row.PoP12h}%</div>
    </div>
  `;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded) {
        resolve();
      } else {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
      }
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

export default function WindyMap({ onZoomChange }) {
  const initialized = useRef(false);
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const options = {
      key: import.meta.env.VITE_WINDY_API_KEY ?? '',
      lat: 23.5,
      lon: 121,
      zoom: 5,
    };

    loadScript(LEAFLET_SRC)
      .then(() => loadScript(WINDY_SRC))
      .then(() => {
        window.windyInit(options, (windyAPI) => {
          const { store, map } = windyAPI;
          store.set('overlay', 'wind');

          map.on('zoomend', () => {
            onZoomChangeRef.current(map.getZoom());
          });

          const L = window.L;
          TAIWAN_CITIES.forEach(({ name, lat, lon }) => {
            const marker = L.circleMarker([lat, lon], {
              radius: 7,
              fillColor: '#ffffff',
              fillOpacity: 0.25,
              color: '#ffffff',
              weight: 1.5,
              opacity: 0.6,
              interactive: true,
            }).addTo(map);

            marker.bindPopup('', {
              closeButton: false,
              maxWidth: 220,
              className: 'weather-city-popup-container',
            });

            marker.on('mouseover', async () => {
              marker.getPopup().setContent(
                `<div class="weather-city-popup"><div class="weather-city-popup__name">${name}</div><div class="weather-city-popup__loading">載入中…</div></div>`
              );
              marker.openPopup();

              try {
                const forecast = await getCityForecast(name);
                if (marker.isPopupOpen()) {
                  marker.getPopup().setContent(buildPopupHTML(name, forecast));
                }
              } catch (err) {
                console.error(`[城市天氣] ${name} 載入失敗:`, err);
                if (marker.isPopupOpen()) {
                  marker.getPopup().setContent(
                    `<div class="weather-city-popup"><div class="weather-city-popup__name">${name}</div><div class="weather-city-popup__error">載入失敗：${err.message}</div></div>`
                  );
                }
              }
            });

            marker.on('mouseout', () => {
              marker.closePopup();
            });
          });
        });
      })
      .catch((err) => {
        console.error('[WindyMap] 初始化失敗:', err);
      });
  }, []);

  return <div id="windy" className="windy-map" />;
}
