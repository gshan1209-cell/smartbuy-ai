import { useState, useRef, useCallback, useEffect } from 'react';

// 同一時間只顯示一則 Toast：新訊息會取消前一則的計時器並直接取代內容
export function useToast(duration = 2500) {
  const [message, setMessage] = useState(null);
  const timerRef = useRef(null);

  const showToast = useCallback((text) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => setMessage(null), duration);
  }, [duration]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return [message, showToast];
}
