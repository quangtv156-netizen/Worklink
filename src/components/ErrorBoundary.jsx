import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[WorkLink ErrorBoundary Caught]:', error, errorInfo);
    // 📡 Client-side Error Observability (Telemetry & Sentry Ingest)
    try {
      const dsn = import.meta.env.VITE_SENTRY_DSN;
      if (dsn) {
        const match = dsn.match(/^https:\/\/([^@]+)@([^/]+)\/(.+)$/);
        if (match) {
          const [, publicKey, host, projectId] = match;
          fetch(`https://${host}/api/${projectId}/store/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=worklink-web/1.0, sentry_key=${publicKey}`
            },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              level: 'error',
              platform: 'javascript',
              message: error?.message || 'React Render Crash',
              extra: {
                componentStack: errorInfo?.componentStack,
                url: window.location.href,
                userAgent: navigator.userAgent
              }
            })
          }).catch(() => {});
        }
      }
    } catch {}
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#090d16] text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-rose-500/30 shadow-2xl text-center backdrop-blur-xl">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white mb-2 font-heading">
              Đã có sự cố bất ngờ xảy ra
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Hệ thống đã tự động ghi lại lỗi này để khắc phục. Bạn có thể tải lại trang hoặc bấm thử lại để tiếp tục làm việc.
            </p>
            {this.state.error?.message && (
              <div className="p-3 mb-6 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-rose-300/80 font-mono text-left truncate">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tải lại trang
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/';
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-slate-700 transition-all"
              >
                <Home className="w-3.5 h-3.5" />
                Trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
