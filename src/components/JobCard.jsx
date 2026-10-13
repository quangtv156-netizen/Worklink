import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  MapPin, 
  Clock, 
  DollarSign, 
  Bookmark, 
  Flame, 
  Pin, 
  Send, 
  CheckCircle, 
  Sparkles,
  Users,
  ChevronRight,
  Share2,
  AlertTriangle,
  Timer
} from 'lucide-react';
import { soundFx } from '../services/soundEffects';

export default function JobCard({ job }) {
  const { 
    savedJobIds, 
    toggleSaveJob, 
    setSelectedJobForDetail, 
    setSelectedJobForApply, 
    recordHashtagClick,
    applications,
    currentUser,
    showToast 
  } = useApp();

  const isSaved = savedJobIds.includes(job.id);
  const isApplied = applications.some(app => app.jobId === job.id);
  const isMyJob = currentUser?.role === 'employer' && Boolean(currentUser?.id) && (
    (Boolean(job.employerId) && job.employerId === currentUser.id) || 
    (Boolean(job.employer_id) && job.employer_id === currentUser.id) ||
    (Boolean(job.company) && Boolean(currentUser?.name) && job.company.trim().toLowerCase() === currentUser.name.trim().toLowerCase())
  );

  // Deadline urgency calculation
  const deadlineDays = job.deadline ? (() => {
    const diff = Math.ceil((new Date(job.deadline) - new Date()) / (1000 * 60 * 60 * 24));
    return diff;
  })() : null;
  const isUrgent = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;
  const isNearDeadline = deadlineDays !== null && deadlineDays <= 7 && deadlineDays > 3;

  const handleOpenDetail = () => {
    soundFx.playPop();
    setSelectedJobForDetail(job);
  };

  const handleQuickApply = (e) => {
    e.stopPropagation();
    soundFx.playPop();
    setSelectedJobForApply(job);
  };

  const handleToggleSave = (e) => {
    e.stopPropagation();
    soundFx.playPop();
    toggleSaveJob(job.id);
  };

  const handleShare = (e) => {
    e.stopPropagation();
    soundFx.playPop();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}?job=${job.id}`);
    }
    showToast(`Đã sao chép liên kết việc "${job.title}"!`);
  };

  return (
    <div 
      onClick={handleOpenDetail}
      className={`group relative rounded-2xl p-5 border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
        job.isPinned 
          ? 'bg-gradient-to-br from-indigo-950/40 via-slate-900/90 to-slate-900 border-indigo-500/40 shadow-lg shadow-indigo-950/50' 
          : 'glass-card border-slate-800/80 hover:border-indigo-500/40'
      }`}
    >
      {/* Top Badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {job.isPinned && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500 text-white shadow-sm">
              <Pin className="w-3 h-3" />
              Ghim ưu tiên
            </span>
          )}
          {job.isHot && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-sm shadow-orange-500/30">
              <Flame className="w-3 h-3 fill-white" />
              Tin Hot
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
            {job.category}
          </span>
        </div>

        {/* Match Percentage / Score */}
        {job.matchScore && (
          <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Sparkles className="w-3 h-3" />
            <span>{job.matchScore}% phù hợp</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div>
        <div className="flex items-start gap-3 mb-2.5">
          <div className="w-11 h-11 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-105 transition-transform shadow-md">
            {job.companyLogo || '💼'}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
              {job.title}
            </h3>
            <p className="text-xs font-medium text-slate-400 truncate">
              {job.company}
            </p>
          </div>
        </div>

        {/* Highlighted Salary + Deadline Warning */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <div className="inline-block px-3 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
            💰 {job.salaryDisplay}
          </div>
          {isUrgent && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[11px] font-bold animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              Hết hạn trong {deadlineDays === 0 ? 'hôm nay' : `${deadlineDays} ngày`}!
            </span>
          )}
          {isNearDeadline && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[11px] font-bold">
              <Timer className="w-3 h-3" />
              Còn {deadlineDays} ngày
            </span>
          )}
        </div>

        {/* Meta Specs */}
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 mb-3">
          <div className="flex items-center gap-1.5 truncate">
            <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{job.district}, {job.city}</span>
          </div>
          <div className="flex items-center gap-1.5 truncate">
            <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="truncate">{job.timeShift} ({job.timeHours})</span>
          </div>
        </div>

        {/* AI Match Reasons (if search active) */}
        {job.matchReasons && job.matchReasons.length > 0 && (
          <div className="mb-3 p-2 rounded-lg bg-slate-900/60 border border-slate-800/60 text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
            <span className="text-indigo-400 font-semibold flex-shrink-0">Khớp:</span>
            <span className="truncate text-slate-300">{job.matchReasons.slice(0, 2).join(' • ')}</span>
          </div>
        )}

        {/* Hashtags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.hashtags?.map((tag) => (
            <span
              key={tag}
              onClick={(e) => {
                e.stopPropagation();
                recordHashtagClick(tag);
              }}
              className="text-[11px] text-slate-400 hover:text-indigo-300 bg-slate-800/60 hover:bg-slate-800 px-2 py-0.5 rounded-md transition-colors"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Footer Actions */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            {job.applicationsCount || 0} ứng tuyển
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Share Button */}
          <button
            type="button"
            onClick={handleShare}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600 transition-all"
            title="Sao chép liên kết việc làm"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>

          {/* Save Button */}
          <button
            type="button"
            onClick={handleToggleSave}
            className={`p-2 rounded-xl border transition-all ${
              isSaved
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
            }`}
            title={isSaved ? 'Đã lưu việc làm' : 'Lưu việc làm'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-white' : ''}`} />
          </button>

          {/* Action Button: My Job / Applied / Apply */}
          {isMyJob ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-bold">
              Tin của bạn
            </span>
          ) : isApplied ? (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <CheckCircle className="w-3.5 h-3.5" />
              Đã nộp đơn
            </span>
          ) : (
            <button
              type="button"
              onClick={handleQuickApply}
              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/25 transition-all active:scale-95 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>Ứng tuyển</span>
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
