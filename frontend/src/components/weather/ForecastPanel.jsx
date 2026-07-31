import { useEffect, useState } from 'react';
import { fetchWeeklyForecast } from '../../lib/cwaApi';

const CITIES = [
  '臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市',
  '基隆市', '新竹市', '嘉義市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '屏東縣', '宜蘭縣', '花蓮縣',
  '臺東縣', '澎湖縣', '金門縣', '連江縣',
];

function formatTime(isoString) {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:00`;
}

export default function ForecastPanel() {
  const [city, setCity] = useState('臺中市');
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchWeeklyForecast(city)
      .then((data) => { if (!cancelled) setForecast(data); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [city]);

  return (
    <div className="weather-forecast-panel">
      <div className="weather-forecast-panel__header">
        <h2>一週天氣預報</h2>
        <select value={city} onChange={(e) => setCity(e.target.value)}>
          {CITIES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="weather-forecast-panel__status">載入中…</p>
      )}
      {error && (
        <p className="weather-forecast-panel__status weather-forecast-panel__error">{error}</p>
      )}

      {!loading && !error && (
        <table className="weather-forecast-panel__table">
          <thead>
            <tr>
              <th>時間</th>
              <th>天氣</th>
              <th>高溫</th>
              <th>低溫</th>
              <th>降雨</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((row) => (
              <tr key={row.startTime}>
                <td>{formatTime(row.startTime)}</td>
                <td>{row.Wx}</td>
                <td>{row.MaxT}°C</td>
                <td>{row.MinT}°C</td>
                <td>{row.PoP12h}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
