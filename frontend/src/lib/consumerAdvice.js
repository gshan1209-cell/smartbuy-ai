const adviceByStatus = {
  便宜: { label: '適合買', text: '比近期平均親民，今天有需要可以放心買。' },
  正常: { label: '可依需求買', text: '價格平穩，照平常需要購買即可。' },
  偏貴: { label: '可以等等', text: '目前價格偏高，可以比較其他市場或稍後再看。' },
  資料不足: { label: '再觀察', text: '資料不足，暫時無法判斷採買時機。' },
};

export function getConsumerAdvice(status = '資料不足', direction) {
  const base = adviceByStatus[status] || adviceByStatus.資料不足;
  if (direction === '漲' && status !== '偏貴') return { label: '可考慮提前買', text: '近期可能上漲，有需要可以考慮先買。' };
  if (direction === '跌' && status === '偏貴') return { label: '可再觀察', text: '近期可能回落，可以先觀察價格變化。' };
  return base;
}

export function getPriceStatus(item) {
  return item.status || (item.today_price == null ? '資料不足' : '正常');
}
