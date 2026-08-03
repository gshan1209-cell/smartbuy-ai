import { useCallback, useEffect, useState } from 'react';

export const DISPLAY_PREFS_KEY = 'smartbuy_display_prefs';
export const DEFAULT_LAYOUT_MODE = 'desktop';

export const LAYOUT_MODE_OPTIONS = [
  { value: 'desktop', label: '電腦', description: '電腦寬版：完整導覽與多欄內容' },
  { value: 'mobile', label: '手機', description: '手機版：抽屜導覽與單欄內容' },
];

function detectLayoutMode() {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT_MODE;
  if (window.innerWidth <= 767) return 'mobile';
  return DEFAULT_LAYOUT_MODE;
}

export function normalizeLayoutMode(layoutMode) {
  // 舊版曾保存 tablet；移除選項後依目前螢幕轉換，避免留下無法選取的狀態。
  if (layoutMode === 'tablet') return detectLayoutMode();
  return LAYOUT_MODE_OPTIONS.some(option => option.value === layoutMode)
    ? layoutMode
    : detectLayoutMode();
}

function readLayoutMode() {
  try {
    const value = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) || '{}').layoutMode;
    return normalizeLayoutMode(value);
  } catch {
    return detectLayoutMode();
  }
}

export function applyLayoutMode(layoutMode) {
  const next = normalizeLayoutMode(layoutMode);
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-layout-mode', next);
  }
  return next;
}

export default function useLayoutMode() {
  const [layoutMode, setLayoutMode] = useState(readLayoutMode);

  useEffect(() => {
    applyLayoutMode(layoutMode);
  }, [layoutMode]);

  useEffect(() => {
    const onChange = event => {
      const next = event.detail?.layoutMode || readLayoutMode();
      setLayoutMode(next);
    };
    window.addEventListener('smartbuy:layout-mode', onChange);
    return () => window.removeEventListener('smartbuy:layout-mode', onChange);
  }, []);

  const updateLayoutMode = useCallback(nextValue => {
    const next = applyLayoutMode(nextValue);
    setLayoutMode(next);
    let current = {};
    try { current = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) || '{}'); } catch { /* ignore invalid local preference */ }
    try {
      localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify({ ...current, layoutMode: next }));
    } catch { /* storage may be disabled; the current page still switches modes */ }
    window.dispatchEvent(new CustomEvent('smartbuy:layout-mode', { detail: { layoutMode: next } }));
  }, []);

  return { layoutMode, updateLayoutMode };
}
