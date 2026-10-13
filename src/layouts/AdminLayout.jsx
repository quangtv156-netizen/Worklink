import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import AdminDashboard from '../components/AdminDashboard';
import JobCard from '../components/JobCard';
import { 
  ShieldCheck, 
  Briefcase, 
  Activity, 
  RotateCcw, 
  LogOut, 
  Eye, 
  Building2, 
  User, 
  Volume2, 
  VolumeX, 
  ArrowUp,
  ArrowLeft,
  Lock,
  LogIn
} from 'lucide-react';
import { soundFx } from '../services/soundEffects';
import { scrollToTop } from '../services/scrollService';

export default function AdminLayout({ onSwitchPortal }) {
  const { 
    currentUser, 
    jobs, 
    logout, 
    resetDemoData, 
    setIsAuthModalOpen
  } = useApp();

  const [activeAdminView, setActiveAdminView] = useState('dashboard'); // 'dashboard' | 'live_jobs'
  const [isSoundMuted, setIsSoundMuted] = useState(() => soundFx.getMuted());
  const [showBackToTop, setShowBackToTop] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 350);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleToggleSound = () => {
    const newState = soundFx.toggleMute();
    setIsSoundMuted(newState);
    if (!newState) soundFx.playPop();
  };

  const handleResetData = () => {
    if (window.confirm('CẢNH BÁO QUẢN TRỊ VIÊN: Bạn có chắc muốn khôi phục toàn bộ database về trạng thái mẫu ban đầu không?')) {
      resetDemoData();
    }
  };

  // NẾU KHÔNG PHẢI ADMIN: HIỂN THỊ AUTH GATE BẢO MẬT
  if (currentUser?.role !== 'admin') {
    return (
      <div className="min-h-screen flex flex-col bg-[#0d0d16] text-slate-100 selection:bg-rose-600 selection:text-white">
        <header className="sticky top-0 z-40 w-full glass-panel border-b border-rose-900/40 bg-slate-950/85 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-red-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-black text-white tracking-tight font-heading">
                  WorkLink <span className="text-rose-400">Master Admin</span>
                </span>
              </div>
            </div>
            <button
              onClick={() => onSwitchPortal('seeker')}
              className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer border border-slate-700/60"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Cổng Ứng viên</span>
            </button>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-16 animate-fadeIn">
          <div className="w-full max-w-lg p-8 sm:p-10 rounded-3xl bg-slate-900/90 border border-rose-900/40 shadow-2xl shadow-rose-950/30 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-600/20 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-rose-600/20">
              <Lock className="w-8 h-8" />
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20 inline-flex items-center gap-1.5 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-rose-400" /> Khu vực Quản trị viên Tối cao
            </span>

            <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
              Yêu cầu quyền Quản trị viên
            </h2>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
              {currentUser 
                ? `Tài khoản hiện tại (${currentUser.email} - vai trò ${currentUser.role === 'employer' ? 'Nhà tuyển dụng' : 'Ứng viên'}) không có thẩm quyền truy cập Admin Console.`
                : 'Bạn cần đăng nhập bằng tài khoản Quản trị viên (admin@worklink.vn) để truy cập giao diện giám sát và điều hành toàn bộ hệ thống.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-6">
              <button
                onClick={() => {
                  soundFx.playPop();
                  setIsAuthModalOpen(true);
                }}
                className="py-3 px-6 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Đăng nhập Admin</span>
              </button>

              <button
                onClick={() => onSwitchPortal('seeker')}
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

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d16] text-slate-100 selection:bg-rose-600 selection:text-white">
      
      {/* Top Admin Super-Bar (Quick Switcher to Candidate or Employer Portal) */}
      <div className="bg-gradient-to-r from-rose-950 via-slate-950 to-rose-950 border-b border-rose-500/30 px-4 sm:px-6 py-2.5 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-200">
        <div className="flex items-center gap-2 font-bold">
          <ShieldCheck className="w-4 h-4 text-rose-400" />
          <span>WorkLink Master Console • Thẩm quyền Quản trị Tối cao (Superuser)</span>
        </div>

        {/* Dedicated Portal Switcher for Admin ("đảm bảo đủ chức năng") */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">Chuyển sang kiểm tra:</span>
          
          <button
            onClick={() => onSwitchPortal('seeker')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer"
            title="Xem & Thử nghiệm với tư cách Ứng viên"
          >
            <User className="w-3.5 h-3.5" />
            <span>Cổng Ứng viên</span>
          </button>

          <button
            onClick={() => onSwitchPortal('employer')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 border border-purple-500/40 text-purple-300 hover:text-white font-bold text-[11px] transition-all cursor-pointer"
            title="Xem & Thử nghiệm với tư cách Nhà tuyển dụng"
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Cổng Tuyển Dụng</span>
          </button>
        </div>
      </div>

      {/* Main Admin Header */}
      <header className="sticky top-0 z-40 w-full glass-panel border-b border-rose-900/40 bg-slate-950/85 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-pink-600 to-amber-500 flex items-center justify-center shadow-lg shadow-rose-600/30">
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-white tracking-tight font-heading">
                  WorkLink <span className="text-rose-400">Master Admin</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 font-bold text-[10px] uppercase tracking-wider">
                  Admin Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Quản trị viên: <strong className="text-white">{currentUser?.name || 'Admin Quản Trị'}</strong> ({currentUser?.email})
              </p>
            </div>
          </div>

          {/* Center Tabs */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-rose-900/30">
            <button
              onClick={() => setActiveAdminView('dashboard')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeAdminView === 'dashboard'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              Trung tâm Quản trị & RBAC
            </button>

            <button
              onClick={() => setActiveAdminView('live_jobs')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeAdminView === 'live_jobs'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Toàn cảnh Sàn Việc làm ({jobs.length})
            </button>
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            
            {/* Sound Toggle */}
            <button
              onClick={handleToggleSound}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
              title={isSoundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
            >
              {isSoundMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
            </button>

            {/* Switch to Employer Portal (Inspection mode for Admin) */}
            <button
              onClick={() => onSwitchPortal('employer')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/30 text-purple-300 text-xs font-bold transition-all cursor-pointer"
              title="Xem Cổng Nhà Tuyển Dụng"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cổng NTD</span>
            </button>

            {/* Switch to Candidate Portal (Inspection mode for Admin) */}
            <button
              onClick={() => onSwitchPortal('seeker')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition-all cursor-pointer"
              title="Xem Cổng Ứng Viên"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Cổng Ứng viên</span>
            </button>

            {/* Reset Data Shortcut */}
            <button
              onClick={handleResetData}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all cursor-pointer"
              title="Khôi phục toàn bộ dữ liệu mẫu"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Reset Dữ liệu</span>
            </button>

            {/* Logout */}
            <button
              onClick={logout}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
              title="Đăng xuất Quản trị viên"
            >
              <LogOut className="w-4 h-4" />
            </button>

          </div>

        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden flex items-center justify-around border-t border-rose-900/40 px-2 py-2 bg-slate-950/90 text-xs font-semibold text-slate-400">
          <button 
            onClick={() => setActiveAdminView('dashboard')} 
            className={activeAdminView === 'dashboard' ? 'text-rose-400 font-bold' : ''}
          >
            Quản trị & RBAC
          </button>
          <button 
            onClick={() => setActiveAdminView('live_jobs')} 
            className={activeAdminView === 'live_jobs' ? 'text-rose-400 font-bold' : ''}
          >
            Sàn Việc làm
          </button>
          <button 
            onClick={() => onSwitchPortal('seeker')}
            className="text-indigo-400"
          >
            Cổng Ứng viên
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-4">
        {activeAdminView === 'dashboard' && (
          <AdminDashboard />
        )}

        {activeAdminView === 'live_jobs' && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 text-xs font-bold mb-2 border border-rose-500/30">
                  <Briefcase className="w-4 h-4" />
                  Giao Diện Trực Quan Toàn Cảnh Sàn Việc Làm
                </div>
                <h2 className="text-xl sm:text-2xl font-black text-white">Danh Sách Việc Làm Thực Tế</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Xem lại cách các tin tuyển dụng hiển thị đối với ứng viên trên trang chủ
                </p>
              </div>

              <div className="text-xs text-slate-400 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800">
                Tổng cộng: <strong className="text-rose-400 font-bold">{jobs.length} tin đăng</strong>
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
      <footer className="border-t border-rose-900/30 bg-slate-950/90 py-6 mt-12 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-rose-400" />
            <span className="font-bold text-white">WorkLink Master Console 2026</span>
            <span>— Hệ thống điều hành & giám sát an toàn nền tảng</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <button onClick={() => onSwitchPortal('seeker')} className="hover:text-indigo-400 transition-colors cursor-pointer">
              Cổng Ứng viên ➔
            </button>
            <button onClick={() => onSwitchPortal('employer')} className="hover:text-purple-400 transition-colors cursor-pointer">
              Cổng Tuyển dụng ➔
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
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900/95 hover:bg-rose-600 border border-rose-500/40 hover:border-rose-400 text-slate-200 hover:text-white shadow-2xl backdrop-blur-md text-xs font-bold transition-all duration-300 transform hover:-translate-y-1 active:scale-95 cursor-pointer animate-fadeIn group"
          title="Cuộn lên đầu trang"
        >
          <ArrowUp className="w-4 h-4 text-rose-400 group-hover:text-white group-hover:-translate-y-0.5 transition-transform" />
          <span className="font-semibold">Lên đầu trang</span>
        </button>
      )}

    </div>
  );
}
