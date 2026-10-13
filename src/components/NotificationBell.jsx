import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { soundFx } from '../services/soundEffects';
import { 
  apiGetNotifications, 
  apiMarkAllNotificationsRead, 
  apiMarkNotificationRead 
} from '../services/api';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationBell({ onNavigateTab }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [serverNotifications, setServerNotifications] = useState([]);
  const [serverUnread, setServerUnread] = useState(0);

  const { 
    currentUserRole, 
    applications, 
    currentUser,
    jobs,
    setActiveTab,
    setActiveChatRecipient,
    setSelectedJobForDetail
  } = useApp();

  const navigateTab = (tab) => {
    if (onNavigateTab) {
      onNavigateTab(tab);
    } else if (setActiveTab) {
      setActiveTab(tab);
    }
  };

  const fetchNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await apiGetNotifications();
      if (res?.success) {
        setServerNotifications(res.notifications || []);
        setServerUnread(res.unreadCount || 0);
      }
    } catch {
      // Backend offline or guest
    }
  }, [currentUser]);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fallback for guest or empty
  const pendingApps = applications.filter(a => a.status === 'pending');
  const fallbackNotifications = pendingApps.slice(0, 5).map(a => ({
    id: a.id,
    title: 'Hồ sơ mới',
    body: `${a.applicantName} ứng tuyển vị trí "${a.jobTitle}"`,
    created_at: a.appliedAt || 'Vừa xong',
    is_read: 0,
    link_type: 'application'
  }));

  const activeNotifications = currentUser && serverNotifications.length > 0
    ? serverNotifications
    : fallbackNotifications;

  const totalUnreadCount = currentUser 
    ? serverUnread 
    : (currentUserRole === 'employer' ? pendingApps.length : 0);

  const handleMarkAllRead = async () => {
    if (currentUser) {
      try {
        await apiMarkAllNotificationsRead();
        setServerUnread(0);
        setServerNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      } catch {}
    } else {
      setServerUnread(0);
    }
    soundFx.playPop();
  };

  const handleNotificationClick = async (notif) => {
    if (currentUser && !notif.is_read) {
      try {
        await apiMarkNotificationRead(notif.id);
        setServerNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: 1 } : n));
        setServerUnread(prev => Math.max(0, prev - 1));
      } catch {}
    }

    if (notif.link_type === 'chat') {
      const senderName = notif.title ? notif.title.replace(/^Tin nhắn mới từ\s*/i, '').trim() : 'Người liên hệ';
      let relatedJob = null;
      if (notif.link_id) {
        if (notif.link_id.startsWith('thread_app_')) {
          const appId = notif.link_id.replace('thread_app_', '');
          const app = applications?.find(a => a.id === appId);
          if (app) {
            relatedJob = jobs?.find(j => j.id === app.jobId);
          }
        } else if (notif.link_id.startsWith('thread_job_')) {
          const match = notif.link_id.match(/^thread_job_([^_]+)/);
          if (match && match[1]) {
            relatedJob = jobs?.find(j => j.id === match[1]);
          }
        }
      }

      setActiveChatRecipient({
        threadId: notif.link_id,
        name: senderName,
        company: senderName,
        applicantName: senderName,
        jobTitle: relatedJob?.title || 'Trao đổi công việc',
        jobId: relatedJob?.id
      });
    } else if (notif.link_type === 'freelance') {
      navigateTab('freelance');
    } else if (notif.link_type === 'application') {
      if (currentUserRole === 'employer') {
        navigateTab('employer');
      } else {
        navigateTab('profile');
      }
    } else if (notif.link_type === 'job') {
      if (currentUserRole === 'employer') {
        navigateTab('employer');
      } else {
        navigateTab('jobs');
        if (notif.link_id) {
          const targetJob = jobs?.find(j => j.id === notif.link_id);
          if (targetJob && setSelectedJobForDetail) {
            setSelectedJobForDetail(targetJob);
          }
        }
      }
    } else if (currentUserRole === 'employer') {
      navigateTab('employer');
    }
    setShowNotifications(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setShowNotifications(!showNotifications);
          if (!showNotifications) soundFx.playPop();
        }}
        className="relative p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
        title="Thông báo"
      >
        <Bell className="w-4 h-4" />
        {totalUnreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-bounce shadow-md shadow-rose-500/50">
            {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-4 z-50 animate-fadeIn backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">Thông báo</span>
              {totalUnreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-bold border border-rose-500/30">
                  {totalUnreadCount} mới
                </span>
              )}
            </div>
            {totalUnreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đã đọc tất cả
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {activeNotifications.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                Không có thông báo nào
              </div>
            ) : (
              activeNotifications.map((n) => {
                const isUnread = !n.is_read;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                      isUnread
                        ? 'bg-indigo-950/40 border-indigo-500/40 hover:bg-indigo-950/60'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 text-slate-400'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0 animate-pulse" />
                        )}
                        <p className={`font-semibold ${isUnread ? 'text-white' : 'text-slate-300'}`}>
                          {n.title || 'Thông báo mới'}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">
                        {n.created_at ? (typeof n.created_at === 'string' && n.created_at.includes('T') ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : n.created_at) : 'Vừa xong'}
                      </span>
                    </div>
                    {n.body && (
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed line-clamp-2">
                        {n.body}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
