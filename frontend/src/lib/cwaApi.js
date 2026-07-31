const BASE_URL = '/cwa-api/api/v1/rest/datastore/F-D0047-091';

const ELEMENT_NAME = {
  Wx: '天氣現象',
  MaxT: '最高溫度',
  MinT: '最低溫度',
  PoP12h: '12小時降雨機率',
};

const VALUE_FIELD = {
  Wx: 'Weather',
  MaxT: 'MaxTemperature',
  MinT: 'MinTemperature',
  PoP12h: 'ProbabilityOfPrecipitation',
};

function parseLocation(location) {
  const byTime = new Map();

  for (const element of location.WeatherElement) {
    const key = Object.keys(ELEMENT_NAME).find((k) => ELEMENT_NAME[k] === element.ElementName);
    if (!key) continue;

    for (const t of element.Time) {
      const entry = byTime.get(t.StartTime) ?? { startTime: t.StartTime, endTime: t.EndTime };
      entry[key] = t.ElementValue[0]?.[VALUE_FIELD[key]];
      byTime.set(t.StartTime, entry);
    }
  }

  return Array.from(byTime.values()).sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export async function fetchWeeklyForecast(locationName) {
  const params = new URLSearchParams({
    Authorization: import.meta.env.VITE_CWA_API_KEY ?? '',
    LocationName: locationName,
    ElementName: Object.values(ELEMENT_NAME).join(','),
  });

  const res = await fetch(`${BASE_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`CWA API 請求失敗（${res.status}）`);

  const data = await res.json();
  const location = data?.records?.Locations?.[0]?.Location?.[0];
  if (!location) throw new Error(`查無「${locationName}」的預報資料`);

  return parseLocation(location);
}
