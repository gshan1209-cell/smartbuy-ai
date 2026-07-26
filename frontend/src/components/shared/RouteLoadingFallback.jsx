export default function RouteLoadingFallback() {
  return (
    <div className="app-route-loading" role="status" aria-live="polite" aria-label="頁面載入中">
      <span className="app-route-spinner" aria-hidden="true" />
      <p>正在載入頁面…</p>
    </div>
  );
}
