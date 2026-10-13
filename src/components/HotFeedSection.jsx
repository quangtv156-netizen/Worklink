import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Flame, 
  MapPin, 
  Clock, 
  Bookmark, 
  Heart, 
  Send, 
  ChevronLeft, 
  ChevronRight, 
  MessageSquare, 
  Smartphone, 
  Info
} from 'lucide-react';
import { soundFx } from '../services/soundEffects';

export default function HotFeedSection() {
  const { 
    jobs, 
    savedJobIds, 
    toggleSaveJob, 
    setSelectedJobForApply, 
    setSelectedJobForDetail,
    setActiveChatRecipient,
    recordJobView, 
    recordHashtagClick,
    applications,
    currentUser,
    userProfile,
    showToast 
  } = useApp();

  // Get hot / pinned / popular jobs, fallback to first 10 jobs
  const hotJobsList = jobs.filter(j => j.isHot || j.isPinned || (j.views && j.views > 100));
  const hotJobs = hotJobsList.length >= 3 ? hotJobsList : jobs.slice(0, 10);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedJobs, setLikedJobs] = useState({});
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  // Track window resize for responsive 3D card layout
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Safe boundary check
  const activeJob = hotJobs[currentIndex] || hotJobs[0];

  const goToIndex = useCallback((targetIndex) => {
    if (targetIndex >= 0 && targetIndex < hotJobs.length) {
      soundFx.playPop();
      setCurrentIndex(targetIndex);
      recordJobView(hotJobs[targetIndex].id);
    }
  }, [hotJobs, recordJobView]);

  const handleNext = useCallback(() => {
    if (currentIndex < hotJobs.length - 1) {
      goToIndex(currentIndex + 1);
    }
  }, [currentIndex, hotJobs.length, goToIndex]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1);
    }
  }, [currentIndex, goToIndex]);

  // Keyboard navigation: Left & Right arrow keys
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  // Touch Swipe Support (Mobile gesture)
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = (e) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 45;
    if (distance > minSwipeDistance) {
      handleNext();
    } else if (distance < -minSwipeDistance) {
      handlePrev();
    }
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  // Like Toggle
  const handleToggleLike = (jobId, title, e) => {
    e.stopPropagation();
    soundFx.playPop();
    setLikedJobs(prev => {
      const updated = !prev[jobId];
      if (updated) {
        showToast(`Đã thích công việc "${title}"! AI sẽ ưu tiên gợi ý việc tương tự.`);
      }
      return { ...prev, [jobId]: updated };
    });
  };

  if (!activeJob) return null;

  const isMobile = windowWidth < 640;
  const isTablet = windowWidth >= 640 && windowWidth < 1024;

  /**
   * Calculate 3D transformation for smartphone multitasking deck
   * Cards are stacked horizontally behind the center active card with perspective tilt.
   */
  const getCardStyle = (index) => {
    const diff = index - currentIndex;
    
    // Only render cards within a reasonable window for performance
    if (Math.abs(diff) > 3) {
      return {
        display: 'none'
      };
    }

    const step1 = isMobile ? 120 : isTablet ? 200 : 280;
    const step2 = isMobile ? 210 : isTablet ? 350 : 480;

    // Active Card (Front & Center)
    if (diff === 0) {
      return {
        transform: 'translate3d(-50%, 0, 0) scale(1) rotateY(0deg)',
        zIndex: 40,
        opacity: 1,
        filter: 'none',
        pointerEvents: 'auto',
        cursor: 'default',
        transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease, filter 0.4s ease'
      };
    }

    // 1 Card to Left (Previous)
    if (diff === -1) {
      return {
        transform: `translate3d(calc(-50% - ${step1}px), 0, -80px) scale(0.88) rotateY(12deg)`,
        zIndex: 30,
        opacity: 0.72,
        filter: 'brightness(0.65) blur(0.5px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease, filter 0.4s ease'
      };
    }

    // 2 Cards to Left
    if (diff === -2) {
      return {
        transform: `translate3d(calc(-50% - ${step2}px), 0, -160px) scale(0.76) rotateY(20deg)`,
        zIndex: 20,
        opacity: 0.4,
        filter: 'brightness(0.4) blur(1px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease, filter 0.4s ease'
      };
    }

    // 1 Card to Right (Next)
    if (diff === 1) {
      return {
        transform: `translate3d(calc(-50% + ${step1}px), 0, -80px) scale(0.88) rotateY(-12deg)`,
        zIndex: 30,
        opacity: 0.72,
        filter: 'brightness(0.65) blur(0.5px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease, filter 0.4s ease'
      };
    }

    // 2 Cards to Right
    if (diff === 2) {
      return {
        transform: `translate3d(calc(-50% + ${step2}px), 0, -160px) scale(0.76) rotateY(-20deg)`,
        zIndex: 20,
        opacity: 0.4,
        filter: 'brightness(0.4) blur(1px)',
        pointerEvents: 'auto',
        cursor: 'pointer',
        transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease, filter 0.4s ease'
      };
    }

    // Outer Cards (diff === -3 or diff === 3)
    const sign = diff < 0 ? '-' : '+';
    const outerOffset = step2 + 160;
    return {
      transform: `translate3d(calc(-50% ${sign} ${outerOffset}px), 0, -240px) scale(0.65) rotateY(${diff < 0 ? '28deg' : '-28deg'})`,
      zIndex: 10,
      opacity: 0,
      filter: 'brightness(0.2)',
      pointerEvents: 'none',
      transition: 'transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease'
    };
  };

  return (
    <div className="w-full max-w-7xl mx-auto my-6 px-3 sm:px-6 select-none overflow-x-clip">
      
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shadow-lg shadow-orange-500/20">
              <Flame className="w-5 h-5 fill-orange-500 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                <span>Hot Job Reels</span>
                <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/40">
                  Đa nhiệm 3D
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Lướt thẻ việc làm dạng ngăn xếp đa nhiệm điện thoại • Dùng nút <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-indigo-300 font-mono text-[10px]">‹</kbd> <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-indigo-300 font-mono text-[10px]">›</kbd> hoặc phím mũi tên
              </p>
            </div>
          </div>
        </div>

        {/* Counter & Indicator Badge */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-1.5 text-xs text-slate-300 font-extrabold bg-slate-900/90 px-3.5 py-1.5 rounded-full border border-slate-700 shadow-md">
            <span className="text-orange-400 text-sm">{currentIndex + 1}</span>
            <span className="text-slate-500">/</span>
            <span>{hotJobs.length}</span>
            <span className="text-slate-500 text-[11px] ml-1">việc làm HOT</span>
          </div>
        </div>
      </div>

      {/* 3D Stack Multitasking Deck Stage */}
      <div 
        className="relative w-full min-h-[580px] sm:min-h-[610px] flex items-center justify-center py-4"
        style={{ perspective: '1200px', transformStyle: 'preserve-3d' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        
        {/* Floating Left Arrow Button (ChevronLeft) */}
        <button
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className={`absolute left-2 sm:left-4 lg:left-8 top-1/2 -translate-y-1/2 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-xl group ${
            currentIndex === 0
              ? 'opacity-25 bg-slate-900/50 border border-slate-800 text-slate-500 cursor-not-allowed'
              : 'opacity-95 hover:opacity-100 bg-slate-900/90 hover:bg-orange-600 border-2 border-orange-500/50 hover:border-orange-400 text-white shadow-orange-950/60 hover:scale-110 active:scale-95 cursor-pointer ring-4 ring-orange-500/10'
          }`}
          title="Xem công việc trước (Phím ←)"
          aria-label="Previous job"
        >
          <ChevronLeft className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5] group-hover:-translate-x-0.5 transition-transform" />
        </button>

        {/* Floating Right Arrow Button (ChevronRight) */}
        <button
          onClick={handleNext}
          disabled={currentIndex === hotJobs.length - 1}
          className={`absolute right-2 sm:right-4 lg:right-8 top-1/2 -translate-y-1/2 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl backdrop-blur-xl group ${
            currentIndex === hotJobs.length - 1
              ? 'opacity-25 bg-slate-900/50 border border-slate-800 text-slate-500 cursor-not-allowed'
              : 'opacity-95 hover:opacity-100 bg-slate-900/90 hover:bg-orange-600 border-2 border-orange-500/50 hover:border-orange-400 text-white shadow-orange-950/60 hover:scale-110 active:scale-95 cursor-pointer ring-4 ring-orange-500/10'
          }`}
          title="Xem công việc tiếp theo (Phím →)"
          aria-label="Next job"
        >
          <ChevronRight className="w-6 h-6 sm:w-7 sm:h-7 stroke-[2.5] group-hover:translate-x-0.5 transition-transform" />
        </button>

        {/* Cards Stack Rendering */}
        <div className="relative w-full h-[530px] sm:h-[560px] max-w-5xl mx-auto flex items-center justify-center">
          {hotJobs.map((job, idx) => {
            const isCurrent = idx === currentIndex;
            const isLiked = Boolean(likedJobs[job.id]);
            const isSaved = savedJobIds.includes(job.id);
            const cardStyle = getCardStyle(idx);

            if (cardStyle.display === 'none') return null;

            return (
              <div
                key={job.id}
                onClick={() => {
                  if (!isCurrent) {
                    goToIndex(idx);
                  }
                }}
                style={cardStyle}
                className={`absolute left-1/2 top-0 w-[92%] max-w-[420px] sm:max-w-[460px] h-full rounded-[2.25rem] p-6 sm:p-7 flex flex-col justify-between overflow-hidden select-none transition-shadow duration-300 ${
                  isCurrent 
                    ? 'bg-gradient-to-b from-[#131b2e] via-[#0d1424] to-[#080d1a] border-2 border-orange-500/50 shadow-2xl shadow-orange-950/40 ring-1 ring-orange-400/30' 
                    : 'bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950 border border-slate-700/60 shadow-xl'
                }`}
              >
                {/* Background Atmosphere Glows */}
                <div className="absolute -top-16 -right-16 w-56 h-56 bg-orange-500/15 blur-[70px] pointer-events-none rounded-full" />
                <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-indigo-600/15 blur-[70px] pointer-events-none rounded-full" />

                {/* Smartphone App-Switcher Top Header */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3.5">
                    {/* App badge style */}
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center text-xl shadow-md">
                        {job.companyLogo || '💼'}
                      </div>
                      <div className="max-w-[170px] sm:max-w-[210px]">
                        <p className="text-[11px] font-black uppercase tracking-wider text-indigo-300 truncate">
                          {job.company}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {job.jobType === 'PART_TIME' ? 'Bán thời gian' : job.jobType === 'FULL_TIME' ? 'Toàn thời gian' : 'Thực tập sinh'}
                        </p>
                      </div>
                    </div>

                    {/* Trending & Category Badges */}
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/30">
                        <Flame className="w-3 h-3 fill-white" />
                        HOT
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-800/90 text-indigo-200 border border-indigo-500/30">
                        {job.category}
                      </span>
                    </div>
                  </div>

                  {/* Job Title */}
                  <h3 className="text-lg sm:text-xl font-black text-white leading-snug line-clamp-2 mt-2">
                    {job.title}
                  </h3>
                </div>

                {/* Middle Content Section */}
                <div className="relative z-10 space-y-3 my-2">
                  
                  {/* Big Salary Banner */}
                  <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-purple-950/60 to-slate-900 border border-indigo-500/40 shadow-inner">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-indigo-300 block mb-0.5">
                      Mức thù lao hấp dẫn
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                      {job.salaryDisplay}
                    </span>
                  </div>

                  {/* Location & Shift Details */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-[11px] text-slate-200 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                      <span className="truncate">{job.district}, {job.city || 'Hà Nội'}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-[11px] text-slate-200 font-semibold">
                      <Clock className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="truncate">{job.timeShift} ({job.timeHours || 'Linh hoạt'})</span>
                    </div>
                  </div>

                  {/* Description Snippet */}
                  <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed bg-slate-950/50 p-3 rounded-xl border border-slate-800/60">
                    {job.description}
                  </p>

                  {/* Hashtags */}
                  <div className="flex flex-wrap gap-1.5 max-h-[32px] overflow-hidden">
                    {job.hashtags?.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        onClick={(e) => {
                          e.stopPropagation();
                          recordHashtagClick(tag);
                        }}
                        className="text-[11px] font-bold text-indigo-300 bg-indigo-950/60 border border-indigo-500/30 px-2.5 py-0.5 rounded-lg hover:border-indigo-400 transition-colors"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="relative z-10 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  
                  {/* Quick Icon Reactions */}
                  <div className="flex items-center gap-1.5">
                    {/* Like Button */}
                    <button
                      onClick={(e) => handleToggleLike(job.id, job.title, e)}
                      disabled={!isCurrent}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isLiked
                          ? 'bg-rose-600 text-white border-rose-500 scale-105 shadow-md shadow-rose-600/40'
                          : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-rose-400'
                      }`}
                      title="Thích công việc này"
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-white' : ''}`} />
                    </button>

                    {/* Bookmark / Save Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playPop();
                        toggleSaveJob(job.id);
                      }}
                      disabled={!isCurrent}
                      className={`p-2.5 rounded-xl border transition-all ${
                        isSaved
                          ? 'bg-indigo-600 text-white border-indigo-500'
                          : 'bg-slate-800/90 text-slate-400 border-slate-700 hover:text-white'
                      }`}
                      title="Lưu tin tuyển dụng"
                    >
                      <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-white' : ''}`} />
                    </button>

                    {/* Message Recruiter Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        soundFx.playPop();
                        const myApp = applications?.find(a => 
                          a.jobId === job.id && 
                          (a.email === (currentUser?.email || userProfile?.email) || a.userId === currentUser?.id)
                        );
                        const threadId = myApp 
                          ? `thread_app_${myApp.id}`
                          : `thread_job_${job.id}_${(currentUser?.id || userProfile?.email || 'seeker').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

                        setActiveChatRecipient({
                          company: job.company,
                          jobTitle: job.title,
                          jobId: job.id,
                          employerId: job.employerId || job.employer_id,
                          appId: myApp?.id || null,
                          applicantName: currentUser?.name || userProfile?.name || 'Ứng viên',
                          threadId
                        });
                      }}
                      disabled={!isCurrent}
                      className="p-2.5 rounded-xl border bg-slate-800/90 text-indigo-400 border-slate-700 hover:text-white hover:bg-slate-700 transition-all"
                      title="Nhắn tin trực tiếp với Nhà tuyển dụng"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>

                  {/* View Details Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playPop();
                      if (setSelectedJobForDetail) {
                        setSelectedJobForDetail(job);
                      }
                    }}
                    disabled={!isCurrent}
                    className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                    title="Xem chi tiết quyền lợi"
                  >
                    <Info className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="hidden sm:inline">Chi tiết</span>
                  </button>

                  {/* Apply Now Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      soundFx.playPop();
                      setSelectedJobForApply(job);
                    }}
                    disabled={!isCurrent}
                    className="flex-1 py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-orange-500 via-rose-500 to-indigo-600 hover:opacity-95 text-white font-black text-xs shadow-lg shadow-orange-500/30 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Ứng tuyển ngay</span>
                  </button>

                </div>

                {/* Dimming overlay when card is not active */}
                {!isCurrent && (
                  <div className="absolute inset-0 bg-black/40 hover:bg-black/20 rounded-[2.25rem] transition-colors flex items-center justify-center">
                    <span className="opacity-0 hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full bg-slate-900/90 text-white text-xs font-bold border border-slate-700 shadow-xl">
                      Chạm để xem thẻ này
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>

      {/* Bottom Multitasking Dock: Quick Indicators & Dots */}
      <div className="flex flex-col items-center gap-3 mt-4">
        {/* Clickable Card Indicator Pills */}
        <div className="flex items-center justify-center gap-1.5 max-w-full overflow-x-auto py-2 px-3 bg-slate-900/80 border border-slate-800 rounded-full shadow-inner">
          {hotJobs.map((j, i) => (
            <button
              key={j.id}
              onClick={() => goToIndex(i)}
              className={`transition-all duration-300 rounded-full cursor-pointer ${
                i === currentIndex
                  ? 'w-8 h-2.5 bg-gradient-to-r from-orange-500 to-rose-500 shadow-md shadow-orange-500/50'
                  : 'w-2.5 h-2.5 bg-slate-700 hover:bg-slate-500'
              }`}
              title={`${i + 1}. ${j.title} (${j.company})`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Quick Keyboard Hint */}
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
          <span>Vuốt ngang trên điện thoại hoặc bấm nút mũi tên để đổi thẻ</span>
        </div>
      </div>

    </div>
  );
}
