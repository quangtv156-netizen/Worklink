import React, { useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import useOnlineStatus from '../hooks/useOnlineStatus';

/**
 * OfflineBanner component
 * Sử dụng hook useOnlineStatus để giám sát trạng thái mạng navigator.onLine
 * Hiển thị Banner thông báo khi phát hiện thiết bị mất kết nối mạng (offline)
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const [isRetrying, setIsRetrying] = useState(false);
  const [manualDismissed, setManualDismissed] = useState(false);

  // Khi mạng kết nối lại, reset trạng thái bỏ qua thủ công
  React.useEffect(() => {
    if (isOnline) {
      setManualDismissed(false);
    }
  }, [isOnline]);

  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => {
      setIsRetrying(false);
      if (typeof navigator !== 'undefined' && navigator.onLine) {
        setManualDismissed(false);
      }
    }, 1000);
  };

  // Nếu đang online hoặc user đã tạm đóng thì không render
  if (isOnline || manualDismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white px-4 py-2.5 shadow-2xl flex items-center justify-between transition-all duration-300 backdrop-blur-md border-b border-red-500/30"
    >
      <div className="flex items-center gap-3 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-black/25 rounded-lg shadow-inner">
            <WifiOff className="w-5 h-5 animate-pulse text-amber-200" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide flex items-center gap-2">
              <span>Mất kết nối Internet!</span>
              <span className="hidden sm:inline text-xs font-normal text-white/90">
                (Một số tính năng và dữ liệu thời gian thực có thể bị gián đoạn)
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 active:scale-95 text-xs font-medium rounded-lg transition-all cursor-pointer disabled:opacity-50"
            title="Kiểm tra lại kết nối"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>{isRetrying ? 'Đang thử lại...' : 'Thử lại'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
