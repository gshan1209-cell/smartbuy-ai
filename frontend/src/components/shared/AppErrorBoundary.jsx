import { Component } from 'react';

import { getErrorRecoveryContent } from '../../lib/errorRecovery';

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

    const recoveryContent = getErrorRecoveryContent(error);

    return (
      <main className="app-error-boundary" role="alert">
        <section className="app-error-card">
          <span className="app-error-icon" aria-hidden="true">⚠️</span>
          <p className="app-error-eyebrow">SmartBuy AI</p>
          <h1>{recoveryContent.title}</h1>
          <p>{recoveryContent.description}</p>
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
