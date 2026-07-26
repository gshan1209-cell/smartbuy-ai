import { useCallback, useEffect, useState } from 'react';

const BASE = import.meta.env.VITE_API_URL ?? '';
export const DISPLAY_PREFS_KEY = 'smartbuy_display_prefs';
export const DEFAULT_FONT_SIZE = 'md';

export const FONT_SIZE_OPTIONS = [
  { value: 'sm', label: '小', description: '緊湊版面' },
  { value: 'md', label: '中', description: '標準版面' },
  { value: 'lg', label: '大', description: '寬鬆版面' },
];

function readFontSize() {
  try {
    const value = JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) || '{}').fontSize;
    return FONT_SIZE_OPTIONS.some(option => option.value === value) ? value : DEFAULT_FONT_SIZE;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
}

export function applyDisplayFontSize(fontSize) {
  const next = FONT_SIZE_OPTIONS.some(option => option.value === fontSize)
    ? fontSize
    : DEFAULT_FONT_SIZE;
  document.documentElement.setAttribute('data-font-size', next);
  return next;
}

export default function useDisplayFontSize({ isAuthenticated = false } = {}) {
  const [fontSize, setFontSize] = useState(readFontSize);

  useEffect(() => {
    applyDisplayFontSize(fontSize);
    const onChange = event => {
      const next = event.detail?.fontSize || readFontSize();
      setFontSize(applyDisplayFontSize(next));
    };
    window.addEventListener('smartbuy:display-font-size', onChange);
    return () => window.removeEventListener('smartbuy:display-font-size', onChange);
  }, [fontSize]);

  const updateFontSize = useCallback(async nextValue => {
    const next = applyDisplayFontSize(nextValue);
    setFontSize(next);
    const current = (() => {
      try { return JSON.parse(localStorage.getItem(DISPLAY_PREFS_KEY) || '{}'); }
      catch { return {}; }
    })();
    localStorage.setItem(DISPLAY_PREFS_KEY, JSON.stringify({ ...current, fontSize: next }));
    window.dispatchEvent(new CustomEvent('smartbuy:display-font-size', { detail: { fontSize: next } }));

    if (isAuthenticated) {
      try {
        await fetch(`${BASE}/api/auth/preferences`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ fontSize: next }),
        });
      } catch {
        // 本機偏好已套用；伺服器不可用時保留本機設定。
      }
    }
  }, [isAuthenticated]);

  return { fontSize, updateFontSize };
}
