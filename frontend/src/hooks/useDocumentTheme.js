import { useEffect } from 'react';

const DISPLAY_PREFERENCES_KEY = 'smartbuy_display_prefs';
const DEFAULT_THEME = 'light';
const DEFAULT_FONT_SIZE = 'md';

export default function useDocumentTheme() {
  useEffect(() => {
    try {
      const preferences = JSON.parse(
        localStorage.getItem(DISPLAY_PREFERENCES_KEY) || '{}',
      );
      document.documentElement.setAttribute(
        'data-theme',
        preferences.theme || DEFAULT_THEME,
      );
      document.documentElement.setAttribute(
        'data-font-size',
        preferences.fontSize || DEFAULT_FONT_SIZE,
      );
    } catch {
      // 忽略格式錯誤的舊版偏好設定，沿用目前頁面主題。
    }
  }, []);
}
