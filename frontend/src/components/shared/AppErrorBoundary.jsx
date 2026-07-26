import { Component } from 'react';

const CHUNK_ERROR_PATTERN = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i;

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('SmartBuy UI render failure', {
      message: error?.message,
      componentStack: info?.componentStack,
    });
  }

  handleRetry = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.assign('/');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError = CHUNK_ERROR_PATTERN.test(String(error?.message || error));

    return (
      <main className="app-error-boundary" role="alert">
        <section className="app-error-card">
          <span className="app-error-icon" aria-hidden="true">⚠️</span>
          <p className="app-error-eyebrow">SmartBuy AI</p>
          <h1>{isChunkError ? '網站已更新，請重新載入' : '這個畫面暫時無法顯示'}</h1>
          <p>
            {isChunkError
              ? '目前分頁仍使用舊版資源，重新載入即可取得最新版本。'
              : '你的資料與操作不會因此被自動刪除。請重新載入；若問題持續，可先回到首頁使用其他功能。'}
          </p>
          <div className="app-error-actions">
            <button type="button" className="app-primary-action" onClick={this.handleRetry}>
              重新載入
            </button>
            <button type="button" className="app-secondary-action" onClick={this.handleHome}>
              回到首頁
            </button>
          </div>
        </section>
      </main>
    );
  }
}
