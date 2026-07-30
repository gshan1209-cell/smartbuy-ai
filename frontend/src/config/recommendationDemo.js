const DEMO_CATEGORIES = [
  { key: 'leafy-vegetables', label: '葉菜類', description: '高麗菜、青江菜、菠菜等葉菜。' },
  { key: 'fruit-vegetables', label: '果菜類', description: '番茄、甜椒、小黃瓜等果菜。' },
  { key: 'root-vegetables', label: '根莖類', description: '蘿蔔、地瓜、馬鈴薯等根莖。' },
  { key: 'fruit', label: '水果類', description: '當季水果與家庭常備水果。' },
  { key: 'mushrooms', label: '菇菌類', description: '香菇、杏鮑菇、金針菇等菇菌。' },
];

const DEMO_MARKETS = ['台北市場', '三重市場', '台中市場', '高雄市場', '花蓮市場'];

const ITEMS = {
  'leafy-vegetables': [
    ['高麗菜', '便宜', 32, 46, '可優先採買', '低於近期平均，家庭份量適合先買一顆。', 'high', '白菜'],
    ['青江菜', '便宜', 28, 35, '今天可買', '價格穩定且適合快速料理，適合補充一餐。', 'high', '小白菜'],
    ['菠菜', '正常', 48, 50, '按需採買', '接近近期平均，建議依當天菜單購買。', 'medium', '地瓜葉'],
    ['空心菜', '正常', 42, 41, '維持比較', '行情平穩，市場間價差可能比單日漲跌更重要。', 'medium', 'A菜'],
    ['芥藍', '偏貴', 68, 54, '可延後', '高於近期平均，先找替代葉菜可降低支出。', 'low', '青江菜'],
    ['地瓜葉', '便宜', 35, 44, '適合順手帶', '價格友善，與主菜搭配能完成一餐。', 'medium', '空心菜'],
  ],
  'fruit-vegetables': [
    ['牛番茄', '便宜', 58, 72, '可優先採買', '低於近期平均，適合一次買足兩到三餐。', 'high', '大番茄'],
    ['小黃瓜', '正常', 45, 43, '按需採買', '價格接近平均，建議依保存期限控制數量。', 'medium', '絲瓜'],
    ['甜椒', '正常', 82, 80, '維持比較', '行情平穩，挑外觀與產地即可。', 'medium', '彩椒'],
    ['茄子', '便宜', 38, 49, '今天可買', '價格落在近期低檔，適合搭配主菜。', 'high', '絲瓜'],
    ['絲瓜', '偏貴', 63, 52, '先找替代品', '價格高於近期平均，可改買小黃瓜。', 'low', '小黃瓜'],
    ['苦瓜', '正常', 55, 56, '維持比較', '價格平穩，按照家庭需求分量採買。', 'low', '絲瓜'],
  ],
  'root-vegetables': [
    ['白蘿蔔', '便宜', 24, 31, '可優先採買', '低於近期平均，耐保存且適合湯品。', 'high', '紅蘿蔔'],
    ['紅蘿蔔', '正常', 36, 35, '按需採買', '行情接近平均，適合與白蘿蔔搭配。', 'medium', '白蘿蔔'],
    ['馬鈴薯', '正常', 52, 50, '維持比較', '價格穩定，留意規格與包裝份量。', 'medium', '地瓜'],
    ['地瓜', '便宜', 44, 57, '今天可買', '價格相對友善，適合當早餐或家庭備糧。', 'high', '馬鈴薯'],
    ['洋蔥', '偏貴', 48, 39, '可延後', '近期價格偏高，可先減少採買量。', 'low', '高麗菜'],
    ['山藥', '資料不足', null, null, '等待資料', '目前可用行情不足，先不做價格判斷。', 'low', '地瓜'],
  ],
  fruit: [
    ['香蕉', '便宜', 48, 60, '可優先採買', '價格低於近期平均，適合家庭日常補充。', 'high', '芭樂'],
    ['芭樂', '正常', 58, 57, '按需採買', '行情接近平均，挑成熟度與份量即可。', 'medium', '香蕉'],
    ['鳳梨', '便宜', 72, 88, '今天可買', '價格相對友善，適合家庭分享。', 'high', '西瓜'],
    ['西瓜', '正常', 210, 205, '維持比較', '單顆價格穩定，建議比較重量單價。', 'medium', '鳳梨'],
    ['水梨', '偏貴', 118, 96, '可延後', '高於近期平均，先以當季替代水果取代。', 'low', '芭樂'],
    ['木瓜', '正常', 64, 62, '按需採買', '價格平穩，適合依成熟度分批購買。', 'low', '香蕉'],
  ],
  mushrooms: [
    ['杏鮑菇', '便宜', 62, 78, '可優先採買', '低於近期平均，耐保存且料理彈性高。', 'high', '鴻喜菇'],
    ['香菇', '正常', 96, 92, '維持比較', '價格接近平均，注意規格與新鮮度。', 'medium', '杏鮑菇'],
    ['金針菇', '便宜', 31, 38, '今天可買', '價格友善，適合火鍋與湯品。', 'high', '鴻喜菇'],
    ['鴻喜菇', '正常', 48, 46, '按需採買', '行情穩定，可依菜單選擇。', 'medium', '杏鮑菇'],
    ['秀珍菇', '偏貴', 78, 65, '可延後', '價格偏高，先用杏鮑菇替代。', 'low', '杏鮑菇'],
    ['舞菇', '資料不足', null, null, '等待資料', '目前可用行情不足，先不做價格判斷。', 'low', '香菇'],
  ],
};

function roleItem(tuple, market, role) {
  const [product_name, price_status, today_price, recent_average, action, reason, priority, substitute] = tuple;
  const roleReason = role === 'farmer'
    ? `${reason} 生產端可依銷售節奏分批安排。`
    : role === 'merchant'
      ? `${reason} 通路端可搭配替代品做彈性陳列。`
      : reason;
  return { product_name, market_name: market, price_status, today_price, recent_average, action, reason: roleReason, priority, substitute };
}

export function getRecommendationDemo(categoryKey, market = DEMO_MARKETS[0]) {
  const category = DEMO_CATEGORIES.find((item) => item.key === categoryKey) || DEMO_CATEGORIES[0];
  const rows = ITEMS[category.key] || ITEMS['leafy-vegetables'];
  const role_recommendations = {
    consumer: {
      role: 'consumer', role_label: '消費者', perspective: '家庭採買端',
      summary: '先買價格友善又好保存的品項，今天完成一到兩餐即可。',
      market_outlook: '目前市場有幾項低於近期平均，可優先比較後分批採買。',
      shopping_strategy: '先買便宜品，再用替代品控制預算；偏貴品項不要追價。',
      items: rows.map((row) => roleItem(row, market, 'consumer')),
    },
    farmer: {
      role: 'farmer', role_label: '農民', perspective: '農業生產端',
      summary: '把價格訊號分成可出貨、觀察與需避開三類，降低一次性決策風險。',
      market_outlook: '需求穩定但品項間價差明顯，適合分批出貨並保留替代通路。',
      shopping_strategy: '優先檢查成本與採收節奏，對偏貴品項觀察是否能持續。',
      items: rows.map((row) => roleItem(row, market, 'farmer')),
    },
    merchant: {
      role: 'merchant', role_label: '商家', perspective: '通路銷售端',
      summary: '用熱門與價格友善品項帶動進店，再以替代品維持陳列彈性。',
      market_outlook: '低價品適合做主推，高價品應控制庫存深度與促銷幅度。',
      shopping_strategy: '先補價格友善品，偏貴品項採少量多次並搭配替代品。',
      items: rows.map((row) => roleItem(row, market, 'merchant')),
    },
  };
  return {
    schema_version: 5,
    prompt_set_version: 'recommendation-role-prompts-v2',
    cache_key: `demo:${market}:${category.key}`,
    category,
    generated_at: '2026-07-30T03:00:00Z',
    generator: 'rules-fallback',
    region: null,
    market,
    source_summary: {
      candidate_count: rows.length,
      latest_trade_date: '2026-07-29',
      historical_data: true,
      data_status: 'demo',
      source_name: '範例行情資料（示意）',
    },
    role_recommendations,
  };
}

export { DEMO_CATEGORIES, DEMO_MARKETS };
