import { useCallback, useState } from 'react';

import ForecastPanel from '../components/weather/ForecastPanel';
import WindyMap from '../components/weather/WindyMap';
import '../styles/weather.css';

const FORECAST_ZOOM_THRESHOLD = 6;

export default function Weather() {
  const [zoom, setZoom] = useState(5);

  const handleZoomChange = useCallback((newZoom) => {
    setZoom(newZoom);
  }, []);

  return (
    <div className="weather-page">
      <WindyMap onZoomChange={handleZoomChange} />
      {zoom >= FORECAST_ZOOM_THRESHOLD && <ForecastPanel />}
    </div>
  );
}
