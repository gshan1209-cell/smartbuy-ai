import ForecastPanel from '../components/weather/ForecastPanel';
import WindyMap from '../components/weather/WindyMap';
import '../styles/weather.css';

export default function Weather() {
  return (
    <div className="weather-page">
      <WindyMap />
      <ForecastPanel />
    </div>
  );
}
