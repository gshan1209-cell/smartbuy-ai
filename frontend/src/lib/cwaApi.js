const BASE_URL = '/cwa-api/api/v1/rest/datastore/F-D0047-091';

const ELEMENT_NAMES = {
  Wx: 'WeatherDescription',
  MaxT: 'MaxT',
  MinT: 'MinT',
  PoP12h: 'PoP12h',
};

function parseLocation(location) {
  const elements = {};
  for (const el of location.weatherElement) {
    elements[el.elementName] = el.time;
  }

  const wxTimes = elements[ELEMENT_NAMES.Wx] || [];
  const maxTTimes = elements[ELEMENT_NAMES.MaxT] || [];
  const minTTimes = elements[ELEMENT_NAMES.MinT] || [];
  const popTimes = elements[ELEMENT_NAMES.PoP12h] || [];

  return wxTimes.map((entry, i) => ({
    startTime: entry.startTime,
    endTime: entry.endTime,
    Wx: entry.elementValue?.[0]?.value ?? '—',
    MaxT: maxTTimes[i]?.elementValue?.[0]?.value ?? '—',
    MinT: minTTimes[i]?.elementValue?.[0]?.value ?? '—',
    PoP12h: popTimes[i]?.elementValue?.[0]?.value ?? '—',
  }));
}

export async function fetchWeeklyForecast(locationName) {
  const params = new URLSearchParams({
    Authorization: import.meta.env.VITE_CWA_API_KEY ?? '',
    LocationName: locationName,
    ElementName: Object.values(ELEMENT_NAMES).join(','),
  });

  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`CWA API 錯誤：${res.status}`);

  const json = await res.json();
  const locations = json?.records?.Locations?.[0]?.Location;
  if (!locations?.length) throw new Error(`找不到「${locationName}」的預報資料`);

  return parseLocation(locations[0]);
}
