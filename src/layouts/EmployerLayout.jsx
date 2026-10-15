import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import EmployerDashboard from "../components/EmployerDashboard";
import JobCard from "../components/JobCard";
import NotificationBell from "../components/NotificationBell";
import {
  Building2,
  Briefcase,
  Globe,
  LogOut,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Volume2,
  VolumeX,
  Eye,
  ArrowUp,
  ExternalLink,
  Lock,
  LogIn,
} from "lucide-react";
import { soundFx } from "../services/soundEffects";
import { scrollToTop } from "../services/scrollService";

export default function EmployerLayout({ onSwitchPortal }) {
  const { currentUser, jobs, logout, setIsAuthModalOpen } = useApp();

  const [activeEmployerTab, setActiveEmployerTab] = useState("dashboard"); // 'dashboard' | 'market'
  const [isSoundMuted, setIsSoundMuted] = useState(() => soundFx.getMuted());
  const [showBackToTop, setShowBackToTop] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 350);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleToggleSound = () => {
    const newState = soundFx.toggleMute();
    setIsSoundMuted(newState);
    if (!newState) soundFx.playPop();
  };

  // Scope jobs to current employer - CHỈ dùng employerId (không dùng company name fallback)
  const isMasterAdmin = currentUser?.role === "admin";
  const isEmployerUser = currentUser?.role === "employer";

  // NẾU CHƯA ĐĂNG NHẬP HOẶC KHÔNG PHẢI EMPLOYER/ADMIN: HIỂN THỊ AUTH GATE
  if (!currentUser || (!isEmployerUser && !isMasterAdmin)) {
    return (
      <div className="min-h-screen flex flex-col bg-[#0b0c16] text-slate-100 selection:bg-purple-600 selection:text-white">
        {/* Navigation bar with return link */}
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-purple-900/40 bg-slate-950/85 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight font-heading text-white whitespace-nowrap">
                  Work<span className="text-purple-400">Link</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                  Nhà tuyển dụng
                </span>
              </div>
            </div>
            <button
              onClick={() => onSwitchPortal("seeker")}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-700/60 whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Cổng Ứng viên</span>
            </button>
          </div>
        </header>

        {/* Lock Screen Body */}
        <main className="flex-1 flex items-center justify-center px-4 py-16 animate-fadeIn">
          <div className="w-full max-w-lg p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-purple-900/40 shadow-2xl shadow-purple-950/30 text-center">
            <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-purple-600/20">
              <Lock className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 inline-flex items-center gap-1.5 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Cổng Doanh
              nghiệp Bảo mật
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              Yêu cầu quyền Nhà tuyển dụng
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              {currentUser
                ? `Tài khoản hiện tại (${currentUser.email} - vai trò Ứng viên) không có quyền quản lý bài đăng tuyển dụng. Vui lòng đăng nhập tài khoản Doanh nghiệp.`
                : "Bạn cần đăng nhập bằng tài khoản Doanh nghiệp hoặc Quản trị viên để quản lý tin tuyển dụng, duyệt hồ sơ ứng viên và sử dụng các tính năng B2B."}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={() => {
                  soundFx.playPop();
                  setIsAuthModalOpen(true);
                }}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-sm shadow-xl shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập Doanh nghiệp</span>
              </button>

              <button
                onClick={() => onSwitchPortal("seeker")}
                className="py-3 px-5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Về Cổng Ứng viên</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const myEmployerJobs = jobs.filter(
    (j) =>
      isMasterAdmin ||
      (currentUser?.role === "employer" &&
        Boolean(currentUser?.id) &&
        ((Boolean(j.employerId) && j.employerId === currentUser.id) ||
          (Boolean(j.employer_id) && j.employer_id === currentUser.id))),
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0c16] text-slate-100 selection:bg-purple-600 selection:text-white">
      {/* Admin Top Inspection Banner if viewed by Admin */}
      {isMasterAdmin && (
        <div className="bg-gradient-to-r from-rose-950 via-slate-900 to-rose-950 border-b border-rose-500/30 px-4 py-2 text-xs flex items-center justify-between text-rose-300">
          <div className="flex items-center gap-2 font-bold">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span>
              Chế độ Quản trị viên: Đang xem Cổng Nhà Tuyển Dụng (Employer
              Portal)
            </span>
          </div>
          <button
            onClick={() => onSwitchPortal("admin")}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>Quay lại Admin Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Recruiter Studio Header Navbar */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-purple-900/40 bg-slate-950/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-600/30 flex-shrink-0">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight font-heading text-white whitespace-nowrap">
                  Work<span className="text-purple-400">Link</span>
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                  Nhà tuyển dụng
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block truncate max-w-[220px]">
                {currentUser?.name || "Doanh nghiệp tuyển dụng"}
              </p>
            </div>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-purple-900/30">
            <button
              onClick={() => setActiveEmployerTab("dashboard")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeEmployerTab === "dashboard"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Quản trị tuyển dụng ({myEmployerJobs.length})
            </button>

            <button
              onClick={() => setActiveEmployerTab("market")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeEmployerTab === "market"
                  ? "bg-purple-600 text-white shadow-md shadow-purple-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
              }`}
              title="Xem tất cả tin trên sàn để khảo sát mức lương và đối thủ"
            >
              <Globe className="w-3.5 h-3.5" />
              Khảo sát thị trường ({jobs.length})
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              className="hidden sm:flex p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              title={isSoundMuted ? "Bật âm thanh" : "Tắt âm thanh"}
            >
              {isSoundMuted ? (
                <VolumeX className="w-4 h-4 text-slate-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              )}
            </button>

            {/* Notification Bell */}
            <NotificationBell />

            {/* Switch to Candidate Portal (Preview mode for employer) */}
            <button
              onClick={() => onSwitchPortal("seeker")}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 text-xs font-bold whitespace-nowrap transition-all cursor-pointer"
              title="Xem trước giao diện tìm việc của ứng viên"
            >
              <Eye className="w-3.5 h-3.5 text-indigo-400" />
              <span>Cổng Ứng viên</span>
            </button>

            {/* Account & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <div className="hidden xl:block text-right">
                <p className="text-xs font-bold text-white max-w-[110px] truncate">
                  {currentUser?.name}
                </p>
                <p className="text-[10px] text-purple-300 font-mono whitespace-nowrap">
                  Nhà tuyển dụng
                </p>
              </div>

              <button
                onClick={logout}
                className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                title="Đăng xuất tài khoản tuyển dụng"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center justify-around border-t border-purple-900/40 px-2 py-2 bg-slate-950/90 text-xs font-semibold text-slate-400">
          <button
            onClick={() => setActiveEmployerTab("dashboard")}
            className={
              activeEmployerTab === "dashboard"
                ? "text-purple-400 font-bold"
                : ""
            }
          >
            Quản trị Tuyển dụng
          </button>
          <button
            onClick={() => setActiveEmployerTab("market")}
            className={
              activeEmployerTab === "market" ? "text-purple-400 font-bold" : ""
            }
          >
            Khảo sát sàn
          </button>
          <button
            onClick={() => onSwitchPortal("seeker")}
            className="text-indigo-400"
          >
            Xem Cổng Ứng viên
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-4">
        {activeEmployerTab === "dashboard" && <EmployerDashboard />}

        {activeEmployerTab === "market" && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold mb-2 border border-purple-500/30">
                  <Globe className="w-4 h-4" />
                  Khảo Sát Toàn Bộ Việc Làm Trên Sàn WorkLink
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">
                  Thị Trường Tuyển Dụng & Đối Thủ Cạnh Tranh
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Xem các tin tuyển dụng đang hoạt động trên hệ thống để so sánh
                  chế độ lương, ca làm và yêu cầu kỹ năng
                </p>
              </div>

              <div className="text-xs text-slate-400 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
                Tổng số việc làm:{" "}
                <strong className="text-purple-400 font-bold">
                  {jobs.length} tin
                </strong>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-purple-900/30 bg-slate-950/90 py-6 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-400" />
            <span className="font-bold text-white">WorkLink Recruiter Hub</span>
            <span>
              — Giải pháp tuyển dụng thông minh cho Doanh nghiệp & Chuỗi F&B
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => onSwitchPortal("seeker")}
              className="hover:text-indigo-400 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>Xem Cổng Ứng viên (Giao diện khách)</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </footer>

      {/* Floating Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={() => {
            soundFx.playPop();
            scrollToTop();
          }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 hover:bg-purple-600 border border-purple-500/40 hover:border-purple-400 text-slate-200 hover:text-white shadow-2xl backdrop-blur-md text-xs font-bold transition-all duration-300 transform hover:-translate-y-1 active:scale-95 cursor-pointer animate-fadeIn group"
          title="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-4 h-4 text-purple-400 group-hover:text-white group-hover:-translate-y-0.5 transition-transform" />
          <span className="font-semibold">Lên đầu trang</span>
        </button>
      )}
    </div>
  );
}
