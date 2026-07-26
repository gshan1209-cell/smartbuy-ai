import { Link, useLocation } from 'react-router-dom';

export default function NotFoundPage() {
  const location = useLocation();

  function handleBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.assign('/');
    }
  }

  return (
    <main className="app-not-found" aria-labelledby="not-found-title">
      <section className="app-not-found-card">
        <p className="app-not-found-code">404</p>
        <h1 id="not-found-title">找不到這個頁面</h1>
        <p>網址可能已變更、輸入錯誤，或你目前沒有可用的頁面內容。</p>
        <code>{location.pathname}</code>
        <div className="app-error-actions">
          <Link className="app-primary-action" to="/">回到首頁</Link>
          <button type="button" className="app-secondary-action" onClick={handleBack}>返回上一頁</button>
        </div>
      </section>
    </main>
  );
}
