import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useJob } from '../context/JobContext';
import { soundFx } from '../services/soundEffects';
import { io } from 'socket.io-client';
import { 
  Send, X, Building2, User, Wifi, WifiOff, Loader2, Sparkles, Phone
} from 'lucide-react';

import { BACKEND_URL, API_BASE_URL } from '../config/apiBase.js';

const API_URL = API_BASE_URL;

export default function DirectMessengerModal() {
  const { activeChatRecipient, setActiveChatRecipient } = useChat();
  const { currentUserRole, currentUser, userProfile } = useAuth();
  const { jobs } = useJob();

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [typingName, setTypingName] = useState('');
  const [isSending, setIsSending] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ─────────────────────────────────────────────
  // 1. Tính threadId chuẩn đồng bộ giữa 2 bên
  // ─────────────────────────────────────────────
  const threadId = activeChatRecipient ? (
    activeChatRecipient.threadId || (
      activeChatRecipient.appId
        ? `thread_app_${activeChatRecipient.appId}`
        : `thread_job_${activeChatRecipient.jobId || 'general'}_${(currentUser?.id || userProfile?.email || 'seeker').replace(/[^a-zA-Z0-9_-]/g, '_')}`
    )
  ) : null;
  const hasRecipient = Boolean(activeChatRecipient);

  // ─────────────────────────────────────────────
  // 2. Định danh người gửi (Tôi)
  // ─────────────────────────────────────────────
  const myRole = currentUserRole === 'employer' ? 'employer' : 'job_seeker';
  const myId = currentUser?.id || (currentUserRole === 'employer' ? 'user-employer-1' : (userProfile?.email || 'user-seeker-1'));

  const getMyName = () => {
    if (currentUserRole === 'employer') {
      const myJob = jobs?.find(j => j.employerId === currentUser?.id || j.employer_id === currentUser?.id);
      return myJob?.company || currentUser?.companyName || currentUser?.name || 'Nhà tuyển dụng';
    }
    return currentUser?.name || userProfile?.name || 'Nguyễn Minh Anh';
  };
  const myName = getMyName();

  // ─────────────────────────────────────────────
  // 3. Định danh người nhận (Đối tác chat)
  // ─────────────────────────────────────────────
  const recipientDisplayName = activeChatRecipient ? (
    currentUserRole === 'employer'
      ? (activeChatRecipient.applicantName || activeChatRecipient.name || 'Ứng viên')
      : (activeChatRecipient.company || activeChatRecipient.name || 'Nhà tuyển dụng')
  ) : '';

  const defaultWelcomeMessage = useMemo(() => {
    if (!activeChatRecipient) return null;
    return currentUserRole === 'employer'
      ? {
          id: 'welcome-init',
          senderId: 'system',
          senderName: 'WorkLink Trợ Lý',
          senderRole: 'system',
          text: `Hộp thoại trao đổi trực tiếp với ứng viên "${recipientDisplayName}" (Vị trí: ${activeChatRecipient.jobTitle || 'Công việc'}). Hãy gửi lời chào hoặc đề xuất lịch phỏng vấn!`,
          createdAt: new Date().toISOString()
        }
      : {
          id: 'welcome-init',
          senderId: 'system',
          senderName: recipientDisplayName,
          senderRole: 'employer',
          text: `Chào bạn! Cảm ơn bạn đã quan tâm đến vị trí "${activeChatRecipient.jobTitle || 'Công việc'}". Bên mình đã tiếp nhận thông tin và rất sẵn lòng giải đáp. Hãy gửi tin nhắn cho shop/công ty nhé!`,
          createdAt: new Date().toISOString()
        };
  }, [activeChatRecipient, currentUserRole, recipientDisplayName]);

  // ─────────────────────────────────────────────
  // 4. Load lịch sử tin nhắn từ API
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!threadId || !activeChatRecipient) return;

    let isMounted = true;
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(`${API_URL}/chat/${encodeURIComponent(threadId)}`, {
          credentials: 'include'
        });
        const data = await res.json();
        if (isMounted) {
          if (data.success && data.messages.length > 0) {
            setMessages(data.messages.map(m => ({
              id: m.id,
              senderId: m.sender_id,
              senderName: m.sender_name,
              senderRole: m.sender_role,
              text: m.text,
              createdAt: m.created_at
            })));
          } else if (defaultWelcomeMessage) {
            setMessages([defaultWelcomeMessage]);
          }
        }
      } catch (e) {
        console.warn('[Chat] Could not load history from API:', e);
        if (isMounted && defaultWelcomeMessage) {
          setMessages([defaultWelcomeMessage]);
        }
      } finally {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    loadHistory();
    return () => { isMounted = false; };
  }, [threadId, activeChatRecipient, defaultWelcomeMessage]);

  // ─────────────────────────────────────────────
  // 5. Kết nối Socket.io Real-time
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!threadId || !activeChatRecipient) return;

    const socket = io(BACKEND_URL || undefined, { 
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      socket.emit('join_thread', { threadId });
      console.log(`[Chat Realtime] Connected socket ${socket.id}, joined thread: ${threadId}`);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('new_message', (msg) => {
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      if (msg.senderRole !== myRole) {
        soundFx.playNotify();
      }
    });

    socket.on('typing', ({ senderName }) => {
      if (senderName !== myName) {
        setTypingName(senderName);
      }
    });

    socket.on('stop_typing', () => {
      setTypingName('');
    });

    return () => {
      socket.disconnect();
    };
  }, [threadId, hasRecipient, myRole, myName, activeChatRecipient]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    if (activeChatRecipient) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingName, activeChatRecipient]);

  // ─────────────────────────────────────────────
  // 6. Gửi tin nhắn (Socket.io + HTTP Fallback)
  // ─────────────────────────────────────────────
  const handleSend = useCallback(async (customText = null) => {
    if (!threadId) return;
    const text = (customText || inputMessage).trim();
    if (!text) return;

    setIsSending(true);
    soundFx.playPop();

    const payload = {
      threadId,
      // Không cần gửi senderId/senderName — server sẽ lấy từ JWT
      text
    };

    // 1. Thử gửi qua Socket.io nếu đã kết nối
    if (socketRef.current?.connected) {
      socketRef.current.emit('send_message', payload);
    } else {
      // 2. HTTP Fallback nếu socket tạm mất kết nối
      try {
        const res = await fetch(`${API_URL}/chat`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      } catch (err) {
        console.error('[Chat] Send HTTP fallback error:', err);
      }
    }

    setInputMessage('');
    setIsSending(false);

    if (socketRef.current?.connected) {
      socketRef.current.emit('stop_typing', { threadId });
    }
    clearTimeout(typingTimeoutRef.current);
  }, [inputMessage, threadId]);

  // Báo hiệu đang gõ phím
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (!socketRef.current?.connected || !threadId) return;
    socketRef.current.emit('typing', { threadId, senderName: myName });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('stop_typing', { threadId });
    }, 1500);
  };

  // Quick templates
  const templates = currentUserRole === 'employer'
    ? [
        '📅 Mời bạn tham gia phỏng vấn lúc 14h00 chiều mai tại văn phòng.',
        'Bên mình đã xem hồ sơ và rất ấn tượng, muốn trao đổi thêm.',
        'Bạn có thể đi làm sớm nhất vào ngày nào?',
        'Chào bạn, bạn có thể gửi thêm chi tiết ca rảnh trong tuần không?'
      ]
    : [
        'Dạ em chào anh/chị! Em rất mong có cơ hội được làm việc tại quý công ty ạ.',
        'Dạ em có thể đi làm ca tối các ngày 2, 4, 6 và chủ nhật ạ!',
        'Em đã nhận được lịch hẹn và sẽ đến đúng giờ ạ.',
        'Dạ em cảm ơn anh/chị rất nhiều ạ!'
      ];

  const formatTime = (iso) => {
    try {
      return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  // NGUYÊN TẮC HOOK REACT: Chỉ return null sau khi tất cả hook đã được gọi xong!
  if (!activeChatRecipient) return null;

  return (
    <div 
      className="fixed inset-0 z-[85] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={() => setActiveChatRecipient(null)}
    >
      <div 
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/90 overflow-hidden flex flex-col h-[650px] max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30 shrink-0">
              {currentUserRole === 'employer' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white truncate">
                  {recipientDisplayName}
                </h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" />
              </div>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-2">
                <span>
                  <strong className="text-indigo-400">Vị trí:</strong> {activeChatRecipient.jobTitle || 'Trao đổi công việc'}
                </span>
                {activeChatRecipient.phone && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-800">
                    <Phone className="w-2.5 h-2.5 text-indigo-400" /> {activeChatRecipient.phone}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Realtime Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
              isConnected 
                ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-600/50 shadow-sm shadow-emerald-500/20' 
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}>
              {isConnected 
                ? <><Wifi className="w-3 h-3 text-emerald-400" /> Realtime</>
                : <><WifiOff className="w-3 h-3 text-slate-500" /> Offline</>
              }
            </div>

            <button
              onClick={() => {
                soundFx.playPop();
                setActiveChatRecipient(null);
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-700/80 transition-all cursor-pointer"
              title="Đóng cửa sổ chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 bg-slate-950/60">
          
          {/* Security Notice */}
          <div className="text-center my-1">
            <span className="text-[10px] text-slate-400 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 flex items-center justify-center gap-1.5 w-fit mx-auto">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Đoạn hội thoại được mã hóa và kết nối trực tiếp qua WorkLink Messenger
            </span>
          </div>

          {isLoadingHistory && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
            </div>
          )}

          {messages.map((msg) => {
            const isMe = msg.senderId === myId || (msg.senderRole && msg.senderRole === myRole);
            const isSystem = msg.senderRole === 'system' || msg.senderId === 'system';
            
            if (isSystem) {
              return (
                <div key={msg.id} className="flex flex-col items-start max-w-[85%]">
                  <span className="text-[10px] text-indigo-400 font-bold mb-1 px-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> {msg.senderName}
                  </span>
                  <div className="rounded-2xl rounded-bl-none px-4 py-3 bg-slate-800/90 border border-slate-700 text-slate-200 text-xs leading-relaxed shadow-sm">
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-500 mt-1 px-1">{formatTime(msg.createdAt)}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <span className="text-[10px] text-slate-400 font-semibold mb-1 px-1">
                  {isMe ? `${msg.senderName} (Bạn)` : msg.senderName}
                </span>
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap shadow-sm transition-all ${
                    isMe
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none shadow-indigo-600/20'
                      : 'bg-slate-800 border border-slate-700/90 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[9px] text-slate-500 mt-1 px-1">{formatTime(msg.createdAt)}</span>
              </div>
            );
          })}

          {/* Typing indicator */}
          {typingName && (
            <div className="flex items-center gap-2 text-[11px] text-indigo-300 px-1 animate-pulse">
              <div className="flex gap-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>{typingName} đang nhập tin nhắn...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Templates */}
        <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 flex gap-2 overflow-x-auto no-scrollbar">
          {templates.map((tpl, i) => (
            <button
              key={i}
              onClick={() => handleSend(tpl)}
              disabled={isSending}
              className="whitespace-nowrap px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-indigo-600/20 hover:border-indigo-500/40 border border-slate-700/80 text-[11px] text-slate-300 hover:text-indigo-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
            >
              💬 {tpl}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
            }}
            placeholder={isConnected ? "Nhập tin nhắn trao đổi về phỏng vấn, ca làm, yêu cầu..." : "Đang kết nối Realtime Messenger..."}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isSending}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>Gửi</span>
          </button>
        </form>
      </div>
    </div>
  );
}