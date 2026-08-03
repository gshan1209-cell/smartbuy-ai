export default function WindyMap() {
  return (
    <iframe
      title="Windy 天氣地圖"
      className="windy-map"
      src="https://embed.windy.com/embed2.html?lat=23.5&lon=121&zoom=5&level=surface&overlay=wind&product=ecmwf&menu=&message=true&marker=&calendar=now&pressure=&type=map&location=coordinates&detail=&metricWind=default&metricTemp=default&radarRange=-1"
      allowFullScreen
    />
  );
}
