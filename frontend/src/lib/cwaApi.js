const CITY_COORDS = {
  '臺北市': { lat: 25.0330, lon: 121.5654 },
  '新北市': { lat: 25.0120, lon: 121.4653 },
  '桃園市': { lat: 24.9936, lon: 121.3010 },
  '臺中市': { lat: 24.1477, lon: 120.6736 },
  '臺南市': { lat: 22.9998, lon: 120.2269 },
  '高雄市': { lat: 22.6273, lon: 120.3014 },
  '基隆市': { lat: 25.1276, lon: 121.7392 },
  '新竹市': { lat: 24.8066, lon: 120.9686 },
  '嘉義市': { lat: 23.4801, lon: 120.4491 },
  '新竹縣': { lat: 24.7036, lon: 121.1533 },
  '苗栗縣': { lat: 24.5602, lon: 120.8214 },
  '彰化縣': { lat: 24.0752, lon: 120.5161 },
  '南投縣': { lat: 23.9610, lon: 120.9720 },
  '雲林縣': { lat: 23.7092, lon: 120.5431 },
  '嘉義縣': { lat: 23.4518, lon: 120.2554 },
  '屏東縣': { lat: 22.6761, lon: 120.4942 },
  '宜蘭縣': { lat: 24.7021, lon: 121.7378 },
  '花蓮縣': { lat: 23.9871, lon: 121.6015 },
  '臺東縣': { lat: 22.7972, lon: 121.1071 },
  '澎湖縣': { lat: 23.5711, lon: 119.5793 },
  '金門縣': { lat: 24.4493, lon: 118.3765 },
  '連江縣': { lat: 26.1609, lon: 119.9522 },
};

const WMO_CODE = {
  0: '晴天', 1: '大致晴朗', 2: '部分多雲', 3: '陰天',
  45: '霧', 48: '凍霧',
  51: '輕毛毛雨', 53: '毛毛雨', 55: '濃毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '冰晶',
  80: '短暫陣雨', 81: '陣雨', 82: '強陣雨',
  85: '小陣雪', 86: '大陣雪',
  95: '雷陣雨', 96: '雷陣雨伴冰雹', 99: '強雷陣雨伴大冰雹',
};

export async function fetchWeeklyForecast(locationName) {
  const coords = CITY_COORDS[locationName];
  if (!coords) throw new Error(`查無「${locationName}」的座標資料`);

  const params = new URLSearchParams({
    latitude: coords.lat,
    longitude: coords.lon,
    daily: 'weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'Asia/Taipei',
    forecast_days: 7,
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo 請求失敗（${res.status}）`);

  const data = await res.json();
  const { time, weathercode, temperature_2m_max, temperature_2m_min, precipitation_probability_max } = data.daily;

  return time.map((date, i) => ({
    startTime: `${date}T00:00:00`,
    endTime: `${date}T23:59:59`,
    Wx: WMO_CODE[weathercode[i]] ?? '未知',
    MaxT: temperature_2m_max[i],
    MinT: temperature_2m_min[i],
    PoP12h: precipitation_probability_max[i] ?? 0,
  }));
}
