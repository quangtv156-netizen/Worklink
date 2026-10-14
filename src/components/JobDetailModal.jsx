import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  X,
  MapPin,
  Award,
  CheckCircle2,
  Send,
  Bookmark,
  Share2,
  ShieldCheck,
  Building2,
  Sparkles,
  MessageSquare,
  Star,
  ExternalLink,
  Edit3,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { getRecommendedJobs } from "../services/recommendationEngine";
import { soundFx } from "../services/soundEffects";
import { apiSubmitRating } from "../services/api";

// Chuẩn hóa: chấp nhận mảng, chuỗi JSON, chuỗi phân tách bằng dấu phẩy/xuống dòng, hoặc rỗng
const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string" || !value.trim()) return [];
  const text = value.trim();
  if (text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
};
export default function JobDetailModal() {
  const {
    selectedJobForDetail,
    setSelectedJobForDetail,
    setSelectedJobForApply,
    setActiveChatRecipient,
    savedJobIds,
    toggleSaveJob,
    applications,
    jobs,
    userHistory,
    currentUser,
    userProfile,
    deleteJob,
    setEditingJob,
    withdrawApplication,
    showToast,
  } = useApp();

  const [ratingStars, setRatingStars] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingTags, setRatingTags] = useState([]);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const RATING_TAGS = [
    "Đúng giờ",
    "Thân thiện",
    "Minh bạch",
    "Lương đúng hẹn",
    "Môi trường tốt",
    "Phỏng vấn nhanh",
  ];

  if (!selectedJobForDetail) return null;

  const job = selectedJobForDetail;
  const isSaved = savedJobIds.includes(job.id);
  const isApplied = applications.some((app) => app.jobId === job.id);
  const isMyJob =
    currentUser?.role === "employer" &&
    Boolean(currentUser?.id) &&
    ((Boolean(job.employerId) && job.employerId === currentUser.id) ||
      (Boolean(job.employer_id) && job.employer_id === currentUser.id) ||
      (Boolean(job.company) &&
        Boolean(currentUser?.name) &&
        job.company.trim().toLowerCase() ===
          currentUser.name.trim().toLowerCase()));
  const isAdmin = currentUser?.role === "admin";

  const similarJobs = getRecommendedJobs(jobs, userHistory, job.id).slice(0, 2);

  const handleShare = () => {
    navigator.clipboard?.writeText(window.location.href);
    showToast("Đã sao chép liên kết công việc vào khay nhớ tạm!");
  };

  const handleApply = () => {
    setSelectedJobForApply(job);
    setSelectedJobForDetail(null);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={() => setSelectedJobForDetail(null)}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {job.category}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
              {job.jobType === "PART_TIME" ? "Part-time" : job.jobType}
            </span>
          </div>

          <button
            onClick={() => setSelectedJobForDetail(null)}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Main Title & Recruiter */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl flex-shrink-0 shadow-lg">
              {job.companyLogo || "💼"}
            </div>
            <div className="flex-1">
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mb-1">
                {job.title}
              </h2>
              <div className="flex items-center gap-2 text-sm text-slate-300 flex-wrap">
                <span className="font-semibold text-indigo-400 flex items-center gap-1">
                  <Building2 className="w-4 h-4" />
                  {job.company}
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-medium flex items-center gap-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Đã xác minh
                </span>
              </div>
            </div>
          </div>

          {/* Key Specs Card Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
                Mức lương
              </span>
              <p className="text-sm font-bold text-indigo-300">
                {job.salaryDisplay}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
                Địa điểm
              </span>
              <p className="text-sm font-bold text-white truncate">
                {job.district}, {job.city}
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
                Ca làm việc
              </span>
              <p className="text-sm font-bold text-white">
                {job.timeShift} ({job.timeHours})
              </p>
            </div>
            <div>
              <span className="text-[11px] font-medium text-slate-400 block mb-0.5">
                Số lượng tuyển
              </span>
              <p className="text-sm font-bold text-white">
                {job.slots || 2} người
              </p>
            </div>
          </div>

          {/* Full Address */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-300 bg-slate-800/40 p-3.5 rounded-xl border border-slate-800">
            <div className="flex items-start gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Địa chỉ làm việc:</strong>{" "}
                {job.address || `${job.district}, Hà Nội`}
              </span>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address ? `${job.address}, Hà Nội` : `${job.company}, ${job.district}, Hà Nội`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-blue-200 border border-blue-500/30 font-semibold text-[11px] whitespace-nowrap transition-colors flex-shrink-0 self-start sm:self-auto cursor-pointer"
              title="Mở vị trí công ty trên Google Maps để xem khoảng cách và hướng đi"
            >
              <ExternalLink className="w-3 h-3 text-blue-400" />
              <span>Mở trên Google Maps ↗</span>
            </a>
          </div>

          {/* Description */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-400" />
              Mô tả công việc
            </h4>
            <p className="text-sm text-slate-300 leading-relaxed bg-slate-950/40 p-4 rounded-xl border border-slate-800/60">
              {job.description}
            </p>
          </div>

          {/* Requirements */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Yêu cầu ứng viên
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {toList(job.requirements).map((req, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Benefits */}
          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Quyền lợi & Đãi ngộ
            </h4>
            <ul className="space-y-2 text-sm text-slate-300">
              {toList(job.benefits).map((ben, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  <span>{ben}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* AI Candidate Matching & Interview Tips */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 via-purple-950/40 to-slate-950 border border-indigo-500/30">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                WorkLink AI • Phân tích độ phù hợp của bạn
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-extrabold">
                {job.matchScore ? `${job.matchScore}% Phù hợp` : "88% Phù hợp"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 text-slate-300">
                <span className="text-emerald-400 font-bold flex-shrink-0">
                  ✓ Điểm cộng:
                </span>
                <span>
                  Hồ sơ của bạn (Khu vực {userProfile?.district || "Hà Nội"},
                  rảnh {userProfile?.preferredShift || "linh hoạt"}) khớp hoàn
                  toàn với vị trí này.
                </span>
              </div>

              <div className="flex items-start gap-2 text-slate-300">
                <span className="text-amber-400 font-bold flex-shrink-0">
                  💡 Gợi ý phỏng vấn:
                </span>
                <span>
                  Nên nhấn mạnh tinh thần đúng giờ, kỹ năng giao tiếp niềm nở và
                  sẵn sàng đổi ca linh hoạt vào mùa thi.
                </span>
              </div>
            </div>
          </div>

          {/* Similar Jobs Recommendation */}
          {similarJobs.length > 0 && (
            <div className="pt-4 border-t border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Việc làm tương tự có thể bạn quan tâm:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {similarJobs.map((sim) => (
                  <div
                    key={sim.id}
                    onClick={() => setSelectedJobForDetail(sim)}
                    className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 cursor-pointer transition-colors"
                  >
                    <p className="text-xs font-bold text-white truncate">
                      {sim.title}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {sim.company} • {sim.district}
                    </p>
                    <p className="text-[11px] font-semibold text-indigo-300 mt-1">
                      {sim.salaryDisplay}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rating Widget – chỉ hiện nếu đã ứng tuyển */}
          {isApplied && (
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-amber-500/20">
              <h4 className="text-sm font-black text-white mb-3 flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-400" />
                {ratingSubmitted
                  ? "Cảm ơn bạn đã đánh giá! 🎉"
                  : "Đánh giá nhà tuyển dụng này"}
              </h4>

              {!ratingSubmitted ? (
                <>
                  {/* Stars */}
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRatingStars(s)}
                        onMouseEnter={() => setRatingHover(s)}
                        onMouseLeave={() => setRatingHover(0)}
                        className="cursor-pointer transition-transform hover:scale-125"
                      >
                        <Star
                          className={`w-7 h-7 transition-colors ${
                            s <= (ratingHover || ratingStars)
                              ? "text-amber-400 fill-amber-400"
                              : "text-slate-600"
                          }`}
                        />
                      </button>
                    ))}
                    {ratingStars > 0 && (
                      <span className="ml-2 text-xs text-amber-400 font-bold">
                        {
                          ["", "Rất tệ", "Tệ", "Ổn", "Tốt", "Xuất sắc"][
                            ratingStars
                          ]
                        }
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {RATING_TAGS.map((tag) => (
                      <button
                        key={tag}
                        onClick={() =>
                          setRatingTags((prev) =>
                            prev.includes(tag)
                              ? prev.filter((t) => t !== tag)
                              : [...prev, tag],
                          )
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                          ratingTags.includes(tag)
                            ? "bg-amber-500/30 border border-amber-500/50 text-amber-300"
                            : "bg-slate-800 border border-slate-700 text-slate-400 hover:border-amber-500/30"
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>

                  {/* Comment */}
                  <textarea
                    value={ratingComment}
                    onChange={(e) => setRatingComment(e.target.value)}
                    placeholder="Chia sẻ trải nghiệm của bạn (không bắt buộc)..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 resize-none mb-3"
                  />

                  <button
                    disabled={ratingStars === 0}
                    onClick={async () => {
                      if (!ratingStars) return;
                      try {
                        await apiSubmitRating({
                          jobId: job.id,
                          targetType: "company",
                          stars: ratingStars,
                          comment: ratingComment,
                          tags: ratingTags,
                        });
                        setRatingSubmitted(true);
                        showToast("Đã gửi đánh giá! Cảm ơn bạn 🌟", "success");
                      } catch (err) {
                        showToast(
                          err.message || "Không thể gửi đánh giá!",
                          "error",
                        );
                      }
                    }}
                    className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
                  >
                    Gửi đánh giá
                  </button>
                </>
              ) : (
                <p className="text-sm text-emerald-400 font-semibold">
                  Bạn đã chấm {ratingStars} ⭐ cho {job.company}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSaveJob(job.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                isSaved
                  ? "bg-indigo-600 text-white border-indigo-500 shadow-md"
                  : "bg-slate-800 text-slate-300 border-slate-700 hover:text-white"
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? "fill-white" : ""}`} />
              <span>{isSaved ? "Đã lưu" : "Lưu tin"}</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2.5 rounded-xl bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 hover:text-white transition-colors"
              title="Chia sẻ link việc làm"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                soundFx.playPop();
                const myApp = applications?.find(
                  (a) =>
                    a.jobId === job.id &&
                    (a.email === (currentUser?.email || userProfile?.email) ||
                      a.userId === currentUser?.id),
                );
                const threadId = myApp
                  ? `thread_app_${myApp.id}`
                  : `thread_job_${job.id}_${(currentUser?.id || userProfile?.email || "seeker").replace(/[^a-zA-Z0-9_-]/g, "_")}`;

                setActiveChatRecipient({
                  company: job.company,
                  jobTitle: job.title,
                  jobId: job.id,
                  employerId: job.employerId || job.employer_id,
                  appId: myApp?.id || null,
                  applicantName:
                    currentUser?.name || userProfile?.name || "Ứng viên",
                  threadId,
                });
                setSelectedJobForDetail(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-indigo-500/50 text-indigo-300 hover:text-white text-xs font-bold transition-all"
              title="Nhắn tin trực tiếp với nhà tuyển dụng"
            >
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="hidden sm:inline">Nhắn tin NTD</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Delete Action */}
            {isAdmin && (
              <button
                onClick={() => {
                  if (
                    window.confirm(
                      `Quản trị viên xác nhận gỡ bỏ bài đăng "${job.title}"?`,
                    )
                  ) {
                    deleteJob(job.id);
                    setSelectedJobForDetail(null);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                title="Gỡ tin vi phạm chính sách"
              >
                <span>Gỡ tin (Admin)</span>
              </button>
            )}

            {/* Application / Ownership state */}
            {isMyJob ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300 text-xs font-bold">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Tin của bạn</span>
                </span>
                <button
                  onClick={() => {
                    soundFx.playPop();
                    setEditingJob(job);
                    setSelectedJobForDetail(null);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                  title="Chỉnh sửa thông tin bài đăng này"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Sửa tin</span>
                </button>
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Bạn có chắc chắn muốn xóa tin tuyển dụng "${job.title}"?`,
                      )
                    ) {
                      deleteJob(job.id);
                      setSelectedJobForDetail(null);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
                  title="Xóa tin này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa</span>
                </button>
              </div>
            ) : isApplied ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Đã nộp hồ sơ</span>
                </span>
                <button
                  onClick={() => {
                    soundFx.playPop();
                    const myApp = applications.find(
                      (a) =>
                        a.jobId === job.id &&
                        (a.userId === currentUser?.id ||
                          a.email ===
                            (currentUser?.email || userProfile?.email)),
                    );
                    if (myApp) {
                      if (
                        window.confirm(
                          `Bạn có chắc chắn muốn hủy / rút hồ sơ ứng tuyển vào vị trí "${job.title}"?`,
                        )
                      ) {
                        withdrawApplication(myApp.id);
                      }
                    } else {
                      showToast("Không tìm thấy hồ sơ để hủy", "error");
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 hover:text-rose-200 text-xs font-bold transition-all cursor-pointer"
                  title="Hủy / Rút hồ sơ đã nộp"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Hủy hồ sơ</span>
                </button>
              </div>
            ) : (
              <button
                onClick={handleApply}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>Nộp đơn ứng tuyển</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
