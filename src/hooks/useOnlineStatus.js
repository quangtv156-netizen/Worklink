import { useState, useEffect } from 'react';

/**
 * Custom hook useOnlineStatus
 * Theo dõi trạng thái kết nối mạng của trình duyệt qua navigator.onLine
 * Lắng nghe các sự kiện 'online' và 'offline' của window để cập nhật thời gian thực
 * 
 * @returns {boolean} isOnline - true nếu đang kết nối internet, false nếu mất mạng
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return true;
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export default useOnlineStatus;
