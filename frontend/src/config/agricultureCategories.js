export const AGRICULTURE_CATEGORY_SOURCE = {
  name: '農業部臺灣農產地圖',
  url: 'https://fae.moa.gov.tw/map/county_agri.php',
};

export const AGRICULTURE_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'vegetables', label: '蔬菜' },
  { key: 'fruits', label: '果品' },
  { key: 'flowers', label: '花卉' },
  { key: 'grains', label: '雜糧' },
  { key: 'other', label: '其他' },
];

const CATEGORY_RULES = [
  {
    key: 'flowers',
    keywords: ['花卉', '菊花', '蘭花', '文心蘭', '蝴蝶蘭', '玫瑰', '百合', '康乃馨', '劍蘭', '向日葵'],
  },
  {
    key: 'grains',
    keywords: ['雜糧', '稻米', '糙米', '玉米', '花生', '黃豆', '大豆', '紅豆', '綠豆', '黑豆', '芝麻', '薏苡', '小米', '小麥', '麥類', '地瓜', '甘藷'],
  },
  {
    key: 'fruits',
    keywords: ['水果', '果品', '香蕉', '芒果', '鳳梨', '西瓜', '木瓜', '火龍果', '芭樂', '番石榴', '荔枝', '龍眼', '柿子', '葡萄', '柑橘', '柳丁', '檸檬', '金桔', '草莓', '梨', '桃', '梅', '棗', '百香果', '釋迦', '蓮霧', '酪梨', '栗子'],
  },
  {
    key: 'vegetables',
    keywords: ['蔬菜', '高麗菜', '甘藍', '白菜', '小白菜', '青江菜', '菠菜', '芥藍', '空心菜', '萵苣', '芹菜', '青蔥', '洋蔥', '韭菜', '蒜頭', '大蒜', '蘿蔔', '紅蘿蔔', '白蘿蔔', '馬鈴薯', '番茄', '茄子', '青椒', '甜椒', '辣椒', '小黃瓜', '大黃瓜', '苦瓜', '絲瓜', '南瓜', '冬瓜', '竹筍', '筍', '四季豆', '豌豆', '毛豆', '秋葵', '菇', '香菇', '金針菇', '木耳', '芋頭', '蓮藕'],
  },
];

export function classifyAgricultureItem(name = '') {
  const normalizedName = String(name).replace(/\s+/g, '').trim();
  const matchedRule = CATEGORY_RULES.find(({ keywords }) => (
    normalizedName && keywords.some((keyword) => normalizedName.includes(keyword))
  ));
  const key = matchedRule?.key || 'other';

  return {
    key,
    label: AGRICULTURE_CATEGORIES.find((category) => category.key === key)?.label || '其他',
  };
}
