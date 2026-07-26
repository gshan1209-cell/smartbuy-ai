// API 仍保留歷史 type 值，這裡集中管理消費者看到的正向顯示名稱。
export const MUTUAL_AID_TYPE_LABELS = Object.freeze({
  '滯銷急售': '產地特惠',
  求助: '合作互助',
  資訊分享: '資訊分享',
});

export function getMutualAidTypeLabel(type) {
  return MUTUAL_AID_TYPE_LABELS[type] || type || '資訊分享';
}
