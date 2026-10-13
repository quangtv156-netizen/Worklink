import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, LogIn, UserPlus, Sparkles, Building2, User, KeyRound, ArrowLeft, CheckCircle2 } from 'lucide-react';
import LegalModal from './LegalModal';

export default function AuthModal({ isOpen, onClose }) {
  const { login, loginWithGoogle, register, forgotPassword, resetPassword, showToast, isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'forgot' | 'reset'
  const [loading, setLoading] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const isHandlingGoogleAuthRef = React.useRef(false);

  // Không pre-fill thông tin tài khoản demo
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });

  const [regForm, setRegForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'job_seeker',
    phone: '',
    district: 'Cầu Giấy'
  });

  const [forgotEmail, setForgotEmail] = useState('');
  const [resetData, setResetData] = useState({
    resetToken: '',
    newPassword: '',
    confirmPassword: ''
  });

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isProduction = import.meta.env.PROD;
  // 🔒 Trên Production: Tuyệt đối cấm mock login, nếu thiếu Client ID thì ẩn hoàn toàn UI
  const allowMockGoogle = !isProduction && import.meta.env.VITE_ALLOW_MOCK_GOOGLE === 'true';
  const showGoogleAuth = Boolean(googleClientId) || allowMockGoogle;
  const googleBtnRef = useRef(null);

  const processGoogleAuth = useCallback(async (accountData) => {
    if (isHandlingGoogleAuthRef.current) return;
    isHandlingGoogleAuthRef.current = true;
    setLoading(true);
    try {
      await loginWithGoogle(accountData);
      setIsAuthModalOpen(false);
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Đăng nhập Google thất bại', 'error');
    } finally {
      setLoading(false);
      setTimeout(() => {
        isHandlingGoogleAuthRef.current = false;
      }, 1200);
    }
  }, [loginWithGoogle, onClose, setIsAuthModalOpen, showToast]);

  // Khởi tạo Google Identity Services (GIS) thật nếu có VITE_GOOGLE_CLIENT_ID
  useEffect(() => {
    if (!googleClientId) return;
    const initGIS = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: (response) => {
            if (response.credential) {
              processGoogleAuth({ credential: response.credential });
            }
          }
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 380,
          text: 'continue_with',
          shape: 'pill'
        });
      }
    };

    if (window.google?.accounts?.id) {
      initGIS();
    } else {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGIS;
      document.body.appendChild(script);
    }
  }, [googleClientId, processGoogleAuth]);

  // Mở cửa sổ popup Đăng nhập Google chuẩn như iLovePDF/Canva
  const handleOpenGooglePopup = () => {
    const width = 500;
    const height = 660;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);

    const popup = window.open(
      '/google-auth.html',
      'GoogleSignIn',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no,resizable=yes`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Trường hợp trình duyệt chặn popup, mở trong tab mới
      window.open('/google-auth.html', '_blank');
    }
  };

  // Lắng nghe kết quả chọn tài khoản từ cửa sổ Google OAuth popup
  useEffect(() => {
    const handleAuthMessage = async (event) => {
      // 🔒 Bảo mật C3: Chỉ chấp nhận message từ chính origin hiện tại
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_SUCCESS' && event.data?.data) {
        processGoogleAuth(event.data.data);
      }
    };

    const handleStorageEvent = async (e) => {
      if (e.key === 'worklink_google_auth_event' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          localStorage.removeItem('worklink_google_auth_event');
          if (parsed.type === 'GOOGLE_AUTH_SUCCESS' && parsed.data) {
            processGoogleAuth(parsed.data);
          }
        } catch (err) {
          console.error(err);
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener('message', handleAuthMessage);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, [processGoogleAuth]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      setIsAuthModalOpen(false);
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Đăng nhập thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(regForm);
      setIsAuthModalOpen(false);
      onClose?.();
    } catch (err) {
      showToast(err.message || 'Đăng ký thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(forgotEmail);
      // Chuyển sang bước nhập mã xác thực (reset token) mà người dùng nhận được qua email / console
      // Tuyệt đối không tự động điền token từ response để ngăn chặn Account Takeover
      setResetData(prev => ({ ...prev, resetToken: '' }));
      setTab('reset');
    } catch (err) {
      showToast(err.message || 'Gửi yêu cầu thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (resetData.newPassword !== resetData.confirmPassword) {
      showToast('Mật khẩu xác nhận không khớp!', 'error');
      return;
    }
    setLoading(true);
    try {
      await resetPassword({
        resetToken: resetData.resetToken,
        newPassword: resetData.newPassword
      });
      setTab('login');
      setLoginForm(prev => ({ ...prev, password: '' }));
    } catch (err) {
      showToast(err.message || 'Đặt lại mật khẩu thất bại', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (tab) {
      case 'login': return 'Đăng nhập WorkLink';
      case 'register': return 'Tạo tài khoản WorkLink';
      case 'forgot': return 'Quên mật khẩu';
      case 'reset': return 'Đặt lại mật khẩu mới';
      default: return 'Xác thực tài khoản';
    }
  };

  const isModalActive = isOpen !== undefined ? isOpen : isAuthModalOpen;
  if (!isModalActive) return null;

  const handleModalClose = () => {
    setIsAuthModalOpen(false);
    onClose?.();
  };

  return (
    <div 
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={handleModalClose}
    >
      <div 
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="text-base font-extrabold text-white">
              {getTitle()}
            </h3>
          </div>

          <button
            onClick={handleModalClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher (chỉ hiện khi đang ở tab login hoặc register) */}
        {(tab === 'login' || tab === 'register') && (
          <div className="flex border-b border-slate-800 bg-slate-950/40 p-1">
            <button
              onClick={() => setTab('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                tab === 'login' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Đăng nhập
            </button>
            <button
              onClick={() => setTab('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                tab === 'register' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>
        )}

        {/* Form Content */}
        <div className="p-6">
          {/* Nút Đăng nhập bằng Google (Hiển thị ở cả tab Login và Register khi được bật) */}
          {(tab === 'login' || tab === 'register') && showGoogleAuth && (
            <div className="mb-4">
              {googleClientId ? (
                <div ref={googleBtnRef} className="flex justify-center mb-4 min-h-[44px]" />
              ) : allowMockGoogle ? (
                <button
                  type="button"
                  onClick={handleOpenGooglePopup}
                  className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs shadow-md transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2.5 border border-slate-200"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>Tiếp tục với Google</span>
                </button>
              ) : null}

              {(googleClientId || allowMockGoogle) && (
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800" /></div>
                  <div className="relative flex justify-center text-[11px]"><span className="bg-slate-900 px-3 text-slate-400 font-medium">hoặc dùng Email</span></div>
                </div>
              )}
            </div>
          )}

          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">Mật khẩu</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginForm.email || '');
                      setTab('forgot');
                    }}
                    className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <input
                  type="password"
                  required
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn className="w-4 h-4" />}
                <span>Đăng nhập ngay</span>
              </button>
            </form>
          )}

          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={regForm.name}
                  onChange={(e) => setRegForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nguyễn Văn A"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Email đăng nhập *</label>
                <input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mật khẩu * (Tối thiểu 8 ký tự)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regForm.password}
                  onChange={(e) => setRegForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Bạn là ai? *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRegForm(prev => ({ ...prev, role: 'job_seeker' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      regForm.role === 'job_seeker'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-sm shadow-indigo-500/20 ring-1 ring-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <User className={`w-4 h-4 ${regForm.role === 'job_seeker' ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <span>Ứng viên</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">Tìm việc, nộp CV, nhận việc vặt bản đồ</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRegForm(prev => ({ ...prev, role: 'employer' }))}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      regForm.role === 'employer'
                        ? 'bg-purple-600/20 border-purple-500 text-white shadow-sm shadow-purple-500/20 ring-1 ring-purple-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1">
                      <Building2 className={`w-4 h-4 ${regForm.role === 'employer' ? 'text-purple-400' : 'text-slate-500'}`} />
                      <span>Nhà tuyển dụng</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-tight">Đăng tin tuyển dụng, xem CV ứng viên</p>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Số điện thoại liên hệ</label>
                <input
                  type="tel"
                  value={regForm.phone}
                  onChange={(e) => setRegForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="0988 123 456"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserPlus className="w-4 h-4" />}
                <span>Đăng ký ngay</span>
              </button>

              <p className="text-[11px] text-slate-400 text-center mt-3">
                Bằng việc đăng ký, bạn đồng ý với{' '}
                <button
                  type="button"
                  onClick={() => setIsLegalOpen(true)}
                  className="text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  Điều khoản & Chính sách bảo mật
                </button>
              </p>
            </form>
          )}

          {tab === 'forgot' && (
            <form onSubmit={handleForgotSubmit} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Nhập địa chỉ email của bạn. Nếu email đã đăng ký trên hệ thống, hướng dẫn và mã xác thực đặt lại mật khẩu sẽ được gửi đến hộp thư (hoặc console máy chủ trong môi trường demo).
              </p>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Email của bạn</label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Quay lại</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>Gửi yêu cầu đặt lại</span>
                </button>
              </div>
            </form>
          )}

          {tab === 'reset' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                <div className="text-xs text-slate-300">
                  <p className="font-bold text-indigo-300">Yêu cầu đã được tiếp nhận</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    Nếu email tồn tại, mã xác thực đã được gửi đi. Vui lòng kiểm tra hộp thư (hoặc console server đối với bản demo) và dán mã xác thực vào ô dưới đây để đổi mật khẩu mới.
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mã xác thực (Reset Token)</label>
                <input
                  type="text"
                  required
                  value={resetData.resetToken}
                  onChange={(e) => setResetData(prev => ({ ...prev, resetToken: e.target.value.trim() }))}
                  placeholder="Dán mã token xác thực vào đây"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Mật khẩu mới (Tối thiểu 8 ký tự)</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetData.newPassword}
                  onChange={(e) => setResetData(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">Xác nhận mật khẩu mới</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={resetData.confirmPassword}
                  onChange={(e) => setResetData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                  <span>Xác nhận mật khẩu mới</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <LegalModal isOpen={isLegalOpen} onClose={() => setIsLegalOpen(false)} />
    </div>
  );
}
