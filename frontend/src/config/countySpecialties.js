/**
 * 各縣市策展的在地代表性作物。
 * 品名對應 demo_catalog.py 的 DEMO_CROP_NAMES，確保 API 能查到即時行情。
 */
export const COUNTY_SPECIALTIES = {
  '臺北市': {
    tagline: '都會蔬菜集散地',
    crops: [
      { name: '甘藍-改良種', description: '台北市場最大宗蔬菜，葉片肥厚、脆甜多汁' },
      { name: '番茄-牛番茄', description: '肉質厚實果酸適中，煮湯生食兩相宜' },
      { name: '絲瓜', description: '夏日家常首選，口感滑嫩清爽' },
      { name: '甘薯葉', description: '台灣庶民蔬菜代表，清炒蒜香風味佳' },
    ],
  },
  '臺中市': {
    tagline: '中部高山果鄉',
    crops: [
      { name: '梨-寶島甘露梨', description: '梨山高山梨，清甜細緻多汁，中部之寶' },
      { name: '桃子-水蜜桃', description: '梨山限定高山桃，香氣馥郁入口即化' },
      { name: '芒果-金煌', description: '台中平原名產，果肉厚實、纖維少甜度高' },
      { name: '酪梨', description: '中部新興明星果品，富含健康油脂' },
    ],
  },
  '高雄市': {
    tagline: '南台灣熱帶鮮果',
    crops: [
      { name: '木瓜-網室紅肉', description: '高雄平地網室栽培，果肉橙紅甜軟' },
      { name: '洋蔥-本產', description: '美濃特產本土洋蔥，甘甜不嗆辛' },
      { name: '西瓜-大西瓜', description: '南台灣陽光充沛，甜度與水分俱佳' },
      { name: '番茄-牛番茄', description: '高屏平原主力蔬果，果型飽滿色澤鮮豔' },
    ],
  },
};

/** 找不到縣市策展資料時的全台通用展示品項 */
export const FALLBACK_SPECIALTIES = [
  { name: '甘藍-改良種', description: '全台種植最廣的蔬菜，價格親民' },
  { name: '番茄-牛番茄', description: '南北市場皆有行情，料理百搭' },
  { name: '西瓜-大西瓜', description: '全台夏季代表水果，消暑聖品' },
  { name: '胡蘿蔔-清洗', description: '常備根莖蔬菜，供貨穩定' },
];
