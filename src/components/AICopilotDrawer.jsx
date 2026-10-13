import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { askWorkLinkCopilot } from '../services/aiCopilotService';
import { soundFx } from '../services/soundEffects';
import { API_BASE_URL } from '../config/apiBase.js';
import { 
  Bot, 
  Sparkles, 
  Send, 
  Minimize2, 
  ShieldCheck,
  Trash2, 
  Briefcase, 
  CheckCircle2, 
  Database,
  AlertTriangle
} from 'lucide-react';

export default function AICopilotDrawer() {
  const { 
    jobs, 
    setSelectedJobForDetail, 
    setSelectedJobForApply,
    isAICopilotOpen,
    setIsAICopilotOpen,
    currentUser,
    userProfile
  } = useApp();

  const [isOpen, setIsOpen] = useState(false);
  const [serverAiConfig, setServerAiConfig] = useState(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activePrompts, setActivePrompts] = useState([
    'The Coffee Lab đang tuyển gì?',
    'Tìm việc phục vụ Cầu Giấy ca tối',
    'Thực tập IT React/Node.js',
    'Mặt bằng lương sinh viên 2026',
    'Bí quyết viết CV chuẩn ATS'
  ]);

  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('worklink_copilot_msgs');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      {
        id: 'welcome',
        sender: 'ai',
        text: `👋 Xin chào! Tôi là **WorkLink AI Copilot** (RAG Database Engine 🧠).\n\nTôi được kết nối trực tiếp với **Cơ sở dữ liệu việc làm thực tế** của WorkLink. Tôi có thể giúp bạn:\n- 🏢 Tra cứu các vị trí tuyển dụng chính xác tại từng quán, công ty.\n- 🔍 Tìm việc làm thêm theo ca rảnh, địa điểm, mức lương.\n- 💰 Cung cấp số liệu thống kê thu nhập theo từng nhóm ngành.\n- 📝 Hướng dẫn viết CV chuẩn ATS và trả lời phỏng vấn thông minh.\n\nBạn muốn tìm kiếm điều gì hôm nay?`,
        jobs: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const messagesEndRef = useRef(null);

  // Dọn dẹp key cũ khỏi client LocalStorage để bảo vệ an toàn
  useEffect(() => {
    try { localStorage.removeItem('worklink_gemini_api_key'); } catch {}
  }, []);

  // Sync state with AppContext if opened externally
  useEffect(() => {
    if (isAICopilotOpen) {
      setIsOpen(true);
    }
  }, [isAICopilotOpen]);

  // Fetch server AI capability
  useEffect(() => {
    fetch(`${API_BASE_URL}/ai/config`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setServerAiConfig(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem('worklink_copilot_msgs', JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend = null) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isLoading) return;

    soundFx.playPop();
    setInputMessage('');

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Multi-turn conversational memory (recent 6 messages)
      const history = messages.slice(-6).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      const userContext = {
        userId: currentUser?.id,
        userProfile,
        userRole: currentUser?.role
      };

      const response = await askWorkLinkCopilot(query, jobs, null, history, userContext);

      soundFx.playNotify();
      const aiMsg = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: response.text,
        jobs: response.jobs || [],
        source: response.source,
        fallbackNotice: response.fallbackNotice || null,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (response.suggestedPrompts && response.suggestedPrompts.length > 0) {
        setActivePrompts(response.suggestedPrompts);
      }

      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          sender: 'ai',
          text: `Đã có lỗi khi xử lý: ${err.message}. Hệ thống đang kết nối CSDL cục bộ.`,
          jobs: [],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    soundFx.playPop();
    localStorage.removeItem('worklink_copilot_msgs');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'ai',
        text: `🧹 Đã làm mới cuộc trò chuyện. Bạn muốn tìm công việc hoặc tra cứu nhà tuyển dụng nào tiếp theo?`,
        jobs: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  /**
   * Render AI message text with markdown bold support and interactive [JOB:id] chips
   */
  const renderFormattedText = useCallback((text) => {
    // First split [JOB:id] tags
    const parts = text.split(/\[JOB:([^\]]+)\]/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const job = jobs.find(j => j.id === part);
        if (!job) return null;
        return (
          <button
            key={`chip-${i}`}
            onClick={() => { 
              soundFx.playPop(); 
              setSelectedJobForDetail(job); 
            }}
            className="inline-flex items-center gap-1 mx-1 px-2 py-0.5 rounded-lg bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 text-[11px] font-bold hover:bg-indigo-600/60 transition-all cursor-pointer"
          >
            <Briefcase className="w-3 h-3" />
            {job.title}
          </button>
        );
      }

      // Format bold markdown (**text**)
      const boldParts = part.split(/\*\*([^*]+)\*\*/g);
      return boldParts.map((sub, j) => {
        if (j % 2 === 1) {
          return <strong key={`b-${i}-${j}`} className="font-bold text-white">{sub}</strong>;
        }
        return sub;
      });
    });
  }, [jobs, setSelectedJobForDetail]);

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          onClick={() => {
            soundFx.playPop();
            setIsOpen(true);
            if (setIsAICopilotOpen) setIsAICopilotOpen(true);
          }}
          className="fixed bottom-6 right-6 z-40 group flex items-center gap-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-2xl shadow-indigo-500/40 hover:scale-105 active:scale-95 transition-all duration-300 border border-white/20 cursor-pointer"
          title="WorkLink AI Copilot"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-white" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-black uppercase tracking-wider text-indigo-100 flex items-center gap-1">
              AI Copilot
              <span className="px-1 py-0.2 rounded text-[8px] bg-indigo-400/30 font-mono">RAG</span>
              <Sparkles className="w-3 h-3 text-amber-300 fill-amber-300" />
            </p>
            <p className="text-[10px] text-indigo-200/90 font-medium">Hỏi đáp CSDL việc làm 24/7</p>
          </div>
        </button>
      )}

      {/* Floating Chat Drawer */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[430px] h-[620px] max-h-[86vh] flex flex-col bg-slate-900/95 backdrop-blur-2xl border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/90 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-300">
          
          {/* Header */}
          <div className="px-4 py-3.5 bg-slate-800/90 border-b border-slate-700/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                  WorkLink AI Copilot
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                    <Database className="w-2.5 h-2.5 text-emerald-400" />
                    RAG DB
                  </span>
                </h3>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  {serverAiConfig?.hasServerKey 
                    ? `Gemini ${serverAiConfig.model || 'Flash'} (Server Key 🛡️)` 
                    : 'PostgreSQL Real-time Knowledge 🧠'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* AI Architecture & Security Info Toggle */}
              <button
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className={`p-1.5 rounded-xl transition-all cursor-pointer ${showKeyConfig ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                title="Bảo mật & Kiến trúc AI WorkLink"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              </button>

              {/* Clear messages */}
              <button
                onClick={handleClearHistory}
                className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-all cursor-pointer"
                title="Làm mới hội thoại"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              {/* Close Drawer */}
              <button
                onClick={() => {
                  soundFx.playPop();
                  setIsOpen(false);
                  if (setIsAICopilotOpen) setIsAICopilotOpen(false);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
                title="Đóng cửa sổ"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* AI Architecture & Security Info Drawer */}
          {showKeyConfig && (
            <div className="p-3.5 bg-slate-950 border-b border-slate-800 text-xs animate-in slide-in-from-top duration-200">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-indigo-300 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Bảo mật Kiến trúc AI WorkLink
                </span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Zero Client Key Leak
                </span>
              </div>

              <p className="text-[11px] text-slate-300 mb-2 leading-relaxed">
                Toàn bộ dữ liệu hội thoại AI được chuyển giao an toàn và xử lý tập trung trên máy chủ Backend WorkLink. Hệ thống tuyệt đối không lưu trữ hay nhận API key từ phía trình duyệt để loại trừ nguy cơ rò rỉ bảo mật.
              </p>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  {serverAiConfig?.hasServerKey 
                    ? `Máy chủ kết nối Google Gemini (${serverAiConfig.model || 'Flash'}) kết hợp Database Grounding PostgreSQL.`
                    : 'Đang kích hoạt Động cơ Phân tích RAG CSDL PostgreSQL nội bộ WorkLink.'}
                </span>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-md leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-br-none'
                      : 'bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {msg.fallbackNotice && (
                    <div className="mb-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] leading-relaxed flex items-start gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{msg.fallbackNotice}</span>
                    </div>
                  )}

                  {msg.sender === 'ai' ? renderFormattedText(msg.text) : msg.text}

                  {/* Render interactive job cards if AI returned matches */}
                  {msg.jobs && msg.jobs.length > 0 && (
                    <div className="mt-3 space-y-2 border-t border-slate-700/80 pt-2.5">
                      <p className="text-[11px] font-black text-indigo-300 uppercase tracking-wide flex items-center gap-1">
                        <Briefcase className="w-3 h-3 text-indigo-400" />
                        Việc làm đề xuất từ CSDL:
                      </p>
                      {msg.jobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 rounded-2xl bg-slate-950/90 border border-slate-700/80 hover:border-indigo-500/60 transition-all flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xl flex-shrink-0">{job.companyLogo || '🏢'}</span>
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-white truncate">
                                  {job.title}
                                </h4>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {job.company} • {job.district || job.city || 'Hà Nội'}
                                </p>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                              {job.salaryDisplay || job.salary_display || job.salary_text}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 justify-end pt-1 border-t border-slate-800/60">
                            <button
                              onClick={() => {
                                soundFx.playPop();
                                setSelectedJobForDetail(job);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-all cursor-pointer"
                            >
                              Chi tiết
                            </button>
                            <button
                              onClick={() => {
                                soundFx.playPop();
                                setSelectedJobForApply(job);
                              }}
                              className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition-all shadow-md shadow-indigo-600/30 cursor-pointer"
                            >
                              Ứng tuyển ngay
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[9px] text-slate-500">{msg.timestamp}</span>
                  {msg.source && (
                    <span className="text-[9px] text-indigo-400/90 font-medium">
                      • {msg.source}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2">
                <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 text-slate-400">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                  <div className="w-2 h-2 rounded-full bg-purple-500 animate-bounce delay-100" />
                  <div className="w-2 h-2 rounded-full bg-pink-500 animate-bounce delay-200" />
                  <span className="text-xs text-slate-300 ml-1 font-medium">Đang truy vấn CSDL & suy luận...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Carousel */}
          <div className="px-3 py-2 bg-slate-950/80 border-t border-slate-800/80 flex gap-2 overflow-x-auto no-scrollbar">
            {activePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-indigo-600/30 hover:border-indigo-500/50 border border-slate-700/80 text-[11px] text-slate-300 hover:text-indigo-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                <span>⚡</span> {prompt}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Hỏi AI bất kỳ điều gì (việc làm, CV, phỏng vấn, quán tuyển)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim() || isLoading}
              className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-600/30 cursor-pointer"
              title="Gửi tin nhắn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
