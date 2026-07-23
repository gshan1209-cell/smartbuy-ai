import { seasonalRecommendations } from '../data/seasonalRecommendations';
import { get } from '../hooks/useApi';

const COUNTY_SPECIALTIES_SEED = {
  臺北市: [{ name: '竹筍', desc: '木柵關渡優質綠竹筍，質地細緻嫩甜。' }],
  新北市: [{ name: '竹筍', desc: '八里與三峽優質綠竹筍，口感爽脆。' }, { name: '山藥', desc: '雙溪與平溪高山野生風味山藥。' }],
  基隆市: [{ name: '山藥', desc: '基隆特產山藥，營養豐富口感綿密。' }],
  桃園市: [{ name: '水蜜桃', desc: '拉拉山高海拔水蜜桃，甜美多汁。' }, { name: '青蔥', desc: '大溪地區優質青蔥。' }],
  新竹縣: [{ name: '柿子', desc: '新竹新埔柿餅與甜柿，風味獨特。' }, { name: '水梨', desc: '新埔與竹東高梨。' }],
  新竹市: [{ name: '米粉', desc: '新竹著名米粉與在地農產。' }],
  宜蘭縣: [{ name: '青蔥', desc: '三星蔥質地柔嫩、蔥香濃厚。' }, { name: '高麗菜', desc: '四季平台高山高麗菜。' }],
  臺中市: [{ name: '水梨', desc: '東勢與和平高海拔雪梨與新興梨。' }, { name: '芋頭', desc: '大甲芋頭綿密香濃。' }],
  苗栗縣: [{ name: '草莓', desc: '大湖草莓香味濃郁品質優良。' }, { name: '紅棗', desc: '公館獨特紅棗特產。' }],
  彰化縣: [{ name: '高麗菜', desc: '溪州與二水平地高麗菜重鎮。' }, { name: '葡萄', desc: '大村與埔心巨峰葡萄。' }],
  南投縣: [{ name: '百香果', desc: '埔里百香果產量豐富甜度高。' }, { name: '高麗菜', desc: '仁愛鄉與信義鄉高山高麗菜。' }],
  雲林縣: [{ name: '西瓜', desc: '二崙與西螺優質甜美西瓜。' }, { name: '蒜頭', desc: '莿桐與虎尾優質國產蒜頭。' }],
  高雄市: [{ name: '番茄', desc: '路竹與阿蓮美濃聖女與小番茄。' }, { name: '芭樂', desc: '燕巢芭樂脆甜多汁品質最佳。' }],
  臺南市: [{ name: '芒果', desc: '玉井與楠西愛文芒果香甜多汁。' }, { name: '胡麻', desc: '安定與善化國產優質胡麻。' }],
  嘉義縣: [{ name: '番茄', desc: '太保與水上玉女小番茄。' }, { name: '甜瓜', desc: '水上與新港溫室網紋甜瓜。' }],
  嘉義市: [{ name: '米', desc: '嘉義好米與在地優質蔬果。' }],
  屏東縣: [{ name: '蓮霧', desc: '林邊與南州黑珍珠蓮霧。' }, { name: '洋蔥', desc: '恆春半島風吹優質洋蔥。' }],
  花蓮縣: [{ name: '西瓜', desc: '鳳林與玉里沙質大西瓜。' }, { name: '金針花', desc: '赤科山與六十石山金針。' }],
  臺東縣: [{ name: '釋迦', desc: '太麻里與卑南大目與鳳梨釋迦。' }, { name: '洛神花', desc: '金峰與太麻里優質洛神花。' }],
  澎湖縣: [{ name: '絲瓜', desc: '澎湖稜角絲瓜口感清甜脆口。' }],
  金門縣: [{ name: '芋頭', desc: '烈嶼芋頭香鬆綿密。' }],
  連江縣: [{ name: '蘿蔔', desc: '馬祖優質高山蘿蔔。' }],
};

function sourceState(result, previousValue) {
  if (result.status === 'fulfilled') {
    const value = result.value;
    const empty = value == null
      || (Array.isArray(value) && value.length === 0)
      || (typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0);
    return { status: empty ? 'empty' : 'ready', value, error: null };
  }

  if (previousValue != null) {
    return {
      status: 'stale',
      value: previousValue,
      error: result.reason?.message || '資料讀取失敗，沿用上次快取。',
    };
  }

  return {
    status: 'error',
    value: null,
    error: result.reason?.message || '資料來源載入失敗。',
  };
}

export async function loadHomeAgricultureExplorer(selectedCounty = '宜蘭縣', previous = null) {
  const [solarTermResult, productsResult] = await Promise.allSettled([
    get('/api/solar-term'),
    get('/api/products'),
  ]);

  const solarTermSource = sourceState(solarTermResult, previous?.sources?.solarTerm?.value);
  const productsSource = sourceState(productsResult, previous?.sources?.prices?.value);

  const solarTermData = solarTermSource.value;
  const products = Array.isArray(productsSource.value)
    ? productsSource.value
    : (productsSource.value?.items || []);

  const termName = solarTermData?.term_name || '當季';
  const seed = seasonalRecommendations[termName] || seasonalRecommendations.default;

  // Local specialties matched with prices
  const specialtiesSeed = COUNTY_SPECIALTIES_SEED[selectedCounty] || [
    { name: '高麗菜', desc: '在地當季優質蔬菜。' },
    { name: '番茄', desc: '在地鮮甜優質蔬果。' },
  ];

  const localSpecialties = specialtiesSeed.map((sp) => {
    const matched = products.find(
      (p) => (p.product_name || p.crop_name) === sp.name
        || (p.product_name || p.crop_name || '').includes(sp.name),
    );

    return {
      name: sp.name,
      description: sp.desc,
      todayPrice: matched?.today_price ?? matched?.price_detail?.today_price ?? null,
      status: matched?.status || matched?.price_status || matched?.price_detail?.status || '正常',
      transDate: matched?.trans_date || matched?.latest_trade_date || matched?.updated_at || '—',
      sourceType: productsSource.status === 'ready' ? 'Official API' : 'Static Seed',
    };
  });

  // Monthly / Seasonal produce matched with prices
  const monthlyProduce = seed.recommendedProducts.map((pName) => {
    const matched = products.find(
      (p) => (p.product_name || p.crop_name) === pName
        || (p.product_name || p.crop_name || '').includes(pName),
    );

    return {
      name: pName,
      todayPrice: matched?.today_price ?? matched?.price_detail?.today_price ?? null,
      status: matched?.status || matched?.price_status || matched?.price_detail?.status || (productsSource.status === 'error' ? '載入失敗' : '正常'),
      transDate: matched?.trans_date || matched?.latest_trade_date || matched?.updated_at || '—',
    };
  });

  const currentMonth = new Date().getMonth() + 1;

  return {
    currentSolarTerm: solarTermData,
    selectedCounty,
    selectedMonth: `${currentMonth} 月`,
    localSpecialties,
    monthlyProduce,
    cookingSuggestions: seed.cookingSuggestions || [],
    sources: {
      solarTerm: {
        status: solarTermSource.status,
        type: 'Official API',
        updatedAt: new Date().toISOString(),
        error: solarTermSource.error,
        value: solarTermData,
      },
      prices: {
        status: productsSource.status,
        type: 'Official API',
        updatedAt: new Date().toISOString(),
        error: productsSource.error,
        value: productsSource.value,
      },
      countyProduce: {
        status: 'unavailable',
        type: 'Unavailable',
        updatedAt: new Date().toISOString(),
        error: '正式縣市農產資料 API 尚未介接',
      },
    },
    fetchedAt: new Date().toISOString(),
  };
}
