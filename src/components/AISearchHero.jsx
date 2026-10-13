import React, { useState } from 'react';
import { Sparkles, Search, ArrowRight, CornerDownLeft, RotateCcw, Check, Bot, Zap, Mic, MicOff, FileText } from 'lucide-react';
import { parseNaturalLanguageQuery } from '../services/aiSearchService';
import { useApp } from '../context/AppContext';
import { soundFx } from '../services/soundEffects';
import { scrollToJobResults } from '../services/scrollService';

export default function AISearchHero({ 
  naturalQuery, 
  setNaturalQuery, 
  onPerformSearch, 
  extractedCriteria, 
  isSearching 
}) {
  const { setIsCVAnalyzerOpen } = useApp();
  const [inputText, setInputText] = useState(naturalQuery || '');
  const [isListening, setIsListening] = useState(false);

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói trực tiếp. Bạn có thể gõ yêu cầu vào ô tìm kiếm!');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        setNaturalQuery(transcript);
        onPerformSearch(transcript);
        setIsListening(false);
        soundFx.playPop();
        scrollToJobResults();
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const samplePrompts = [
    'Tôi là sinh viên, muốn tìm việc IT part-time buổi tối, gần Cầu Giấy, không yêu cầu kinh nghiệm.',
    'Tìm việc phục vụ hoặc pha chế part-time tại Đống Đa, lương trên 32k/giờ.',
    'Cần việc bán hàng shop thời trang ca chiều khu vực Hai Bà Trưng.',
    'Tìm việc viết content marketing remote linh hoạt.'
  ];

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!inputText.trim()) return;
    soundFx.playPop();
    setNaturalQuery(inputText);
    onPerformSearch(inputText);
    scrollToJobResults();
  };

  const handleSelectSample = (sample) => {
    soundFx.playPop();
    setInputText(sample);
    setNaturalQuery(sample);
    onPerformSearch(sample);
    scrollToJobResults();
  };

  const handleReset = () => {
    soundFx.playPop();
    setInputText('');
    setNaturalQuery('');
    onPerformSearch('');
  };


  // Preview extracted tokens live as user types
  const liveExtracted = parseNaturalLanguageQuery(inputText);
  const hasExtractedTokens = liveExtracted.category || liveExtracted.location || liveExtracted.job_type || liveExtracted.time || liveExtracted.experience || liveExtracted.min_salary_hourly;

  return (
    <div className="relative pt-6 pb-10 px-4 sm:px-6 lg:px-8 overflow-hidden rounded-3xl mb-8 border border-indigo-500/20 bg-gradient-to-b from-indigo-950/40 via-slate-900/80 to-slate-950/90 shadow-2xl">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-48 bg-indigo-500/15 blur-[90px] pointer-events-none rounded-full" />
      <div className="absolute -top-10 right-10 w-40 h-40 bg-purple-500/10 blur-[60px] pointer-events-none rounded-full" />

      <div className="relative max-w-4xl mx-auto text-center">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-4 backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
          <span>WorkLink AI Search v1.0 • Hiểu ngôn ngữ tự nhiên</span>
        </div>

        {/* Headline */}
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-3">
          Nói cho AI biết <span className="text-gradient">công việc mong muốn</span> của bạn
        </h1>
        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto mb-6">
          Không cần gõ từ khóa khô khan. Chỉ cần mô tả địa điểm, thời gian rảnh, mức lương hoặc vị trí bạn muốn làm việc!
        </p>

        {/* AI Prompt Input Box */}
        <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto mb-4">
          <div className="relative flex items-center rounded-2xl bg-slate-900/90 border-2 border-indigo-500/40 shadow-xl shadow-indigo-950/50 focus-within:border-indigo-400 focus-within:ring-4 focus-within:ring-indigo-500/20 transition-all p-2">
            
            <div className="pl-3 pr-2 text-indigo-400">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>

            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="VD: Tôi là sinh viên, muốn tìm việc IT part-time buổi tối, gần Cầu Giấy, không yêu cầu kinh nghiệm..."
              className="w-full bg-transparent text-white text-sm sm:text-base placeholder-slate-500 focus:outline-none py-2 px-2"
            />

            {/* Voice Search Button */}
            <button
              type="button"
              onClick={startVoiceInput}
              className={`p-2 rounded-xl transition-all mr-1 flex items-center gap-1 ${
                isListening 
                  ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/50' 
                  : 'text-slate-400 hover:text-indigo-400 hover:bg-slate-800'
              }`}
              title={isListening ? 'Đang lắng nghe giọng nói...' : 'Nói nhu cầu tìm việc (Voice Search)'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {isListening && <span className="text-[10px] font-bold pr-1">Đang nghe...</span>}
            </button>

            {inputText && (
              <button
                type="button"
                onClick={handleReset}
                className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 mr-1 transition-colors"
                title="Xóa tìm kiếm"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}


            <button
              type="submit"
              disabled={isSearching}
              className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
            >
              {isSearching ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Đang phân tích...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Phân tích AI</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Live AI Extracted Criteria Pills */}
        {(hasExtractedTokens || extractedCriteria) && (
          <div className="max-w-3xl mx-auto mt-3 p-3 rounded-xl bg-slate-900/60 border border-indigo-500/20 text-left animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase tracking-wider font-bold text-indigo-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                AI trích xuất cấu trúc tìm kiếm từ yêu cầu của bạn:
              </span>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" /> Đã đồng bộ với Database
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {liveExtracted.category && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 flex items-center gap-1">
                  Ngành nghề: <strong className="text-white">{liveExtracted.category}</strong>
                </span>
              )}
              {liveExtracted.location && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-500/30 flex items-center gap-1">
                  Khu vực: <strong className="text-white">{liveExtracted.location}</strong>
                </span>
              )}
              {liveExtracted.job_type && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/20 text-purple-200 border border-purple-500/30 flex items-center gap-1">
                  Hình thức: <strong className="text-white">{liveExtracted.job_type === 'PART_TIME' ? 'Part-time' : liveExtracted.job_type}</strong>
                </span>
              )}
              {liveExtracted.time && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/30 flex items-center gap-1">
                  Ca làm: <strong className="text-white">{liveExtracted.time.replace('_', ' ')}</strong>
                </span>
              )}
              {liveExtracted.experience && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30 flex items-center gap-1">
                  Kinh nghiệm: <strong className="text-white">Không yêu cầu</strong>
                </span>
              )}
              {liveExtracted.min_salary_hourly && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/20 text-rose-200 border border-rose-500/30 flex items-center gap-1">
                  Lương mong muốn: <strong className="text-white">≥ {liveExtracted.min_salary_hourly.toLocaleString()}đ/h</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Sample Prompts */}
        <div className="mt-4 text-left">
          <p className="text-xs text-slate-400 mb-2 font-medium flex items-center gap-1.5">
            <span>💡 Thử bấm nhanh một câu hỏi mẫu:</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSample(prompt)}
                className="text-left text-xs bg-slate-900/80 hover:bg-indigo-950/70 border border-slate-800 hover:border-indigo-500/40 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
              >
                "{prompt}"
              </button>
            ))}
          </div>
        </div>

        {/* AI CV Quick Scanner Banner */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <div>
              <p className="text-xs font-bold text-white">Bạn đã có sẵn tệp CV / Hồ sơ xin việc?</p>
              <p className="text-[11px] text-slate-400">Để AI quét tự động kỹ năng, tính điểm ATS và ghép nối với các công việc phù hợp nhất.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playPop();
              setIsCVAnalyzerOpen(true);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Quét CV & Đề xuất ngay</span>
          </button>
        </div>

      </div>
    </div>
  );
}
