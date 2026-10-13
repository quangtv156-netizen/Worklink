import React from 'react';
import { useApp } from '../context/AppContext';
import { getRecommendedJobs } from '../services/recommendationEngine';
import { scrollToJobResults } from '../services/scrollService';
import { Sparkles, ArrowRight, Bookmark, Send, Building2, MapPin } from 'lucide-react';

export default function RecommendationList() {
  const { 
    jobs, 
    userHistory, 
    savedJobIds, 
    toggleSaveJob, 
    setSelectedJobForDetail, 
    setSelectedJobForApply 
  } = useApp();

  const recommendedJobs = getRecommendedJobs(jobs, userHistory);

  if (recommendedJobs.length === 0) return null;

  return (
    <div className="mb-10 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-purple-950/30 border border-indigo-500/20 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-white">
              Đề xuất thông minh dành riêng cho bạn
            </h3>
            <p className="text-xs text-slate-400">
              Phân tích tự động từ lịch sử xem, lưu và ứng tuyển của bạn
            </p>
          </div>
        </div>

        <button
          onClick={scrollToJobResults}
          className="hidden sm:flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer group px-3 py-1.5 rounded-xl hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20"
        >
          <span>Xem danh sách đầy đủ</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>


      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {recommendedJobs.map((job) => {
          const isSaved = savedJobIds.includes(job.id);
          return (
            <div
              key={job.id}
              onClick={() => {
                setSelectedJobForDetail(job);
              }}
              className="p-4 rounded-2xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 transition-all cursor-pointer flex flex-col justify-between group"
            >
              <div>
                {/* Recommendation Reason Pill */}
                <div className="mb-2 text-[10px] font-bold text-indigo-300 bg-indigo-950/80 border border-indigo-500/30 px-2 py-0.5 rounded-md truncate">
                  💡 {job.recReason || 'Phù hợp với bạn'}
                </div>

                <div className="flex items-start gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-xl flex-shrink-0">
                    {job.companyLogo || '💼'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                      {job.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate">
                      {job.company}
                    </p>
                  </div>
                </div>

                <p className="text-xs font-bold text-indigo-400 mb-2">
                  {job.salaryDisplay}
                </p>

                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-3">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{job.district} • {job.timeShift}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSaveJob(job.id);
                  }}
                  className={`p-1.5 rounded-lg border text-xs transition-colors ${
                    isSaved ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  <Bookmark className="w-3 h-3" />
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedJobForApply(job);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold flex items-center gap-1"
                >
                  <Send className="w-3 h-3" />
                  <span>Ứng tuyển</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
