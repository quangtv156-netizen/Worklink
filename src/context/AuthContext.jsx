import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  apiLogin, 
  apiRegister, 
  apiGoogleLogin,
  apiLogout,
  apiGetMe,
  apiUpdateProfile,
  apiChangePassword,
  apiForgotPassword,
  apiResetPassword
} from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Current User & Auth State (Quản lý qua HttpOnly Cookie, không lưu JWT trong localStorage)
  const [authToken, setAuthToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('worklink_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Active role: strictly derived from currentUser account ('job_seeker' | 'employer' | 'admin')
  const [currentUserRole, setCurrentUserRole] = useState(() => currentUser?.role || 'job_seeker');

  useEffect(() => {
    setCurrentUserRole(currentUser?.role || 'job_seeker');
  }, [currentUser]);

  // RBAC Permission Helpers
  const isJobSeeker = (currentUser?.role || 'job_seeker') === 'job_seeker';
  const isEmployer = currentUser?.role === 'employer';
  const isAdmin = currentUser?.role === 'admin';

  // Helper check if user has permission to manage a specific job
  const canManageJob = (job) => {
    if (!job || !currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'employer' && currentUser.id) {
      return (
        (Boolean(job.employerId) && job.employerId === currentUser.id) ||
        (Boolean(job.employer_id) && job.employer_id === currentUser.id)
      );
    }
    return false;
  };

  // Helper check if user has permission to manage a specific gig
  const canManageGig = (gig) => {
    if (!gig || !currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'employer' && currentUser.id) {
      return (
        (Boolean(gig.employerId) && gig.employerId === currentUser.id) ||
        (Boolean(gig.employer_id) && gig.employer_id === currentUser.id)
      );
    }
    return false;
  };

  // Helper check if user has permission to manage a specific freelance project
  const canManageFreelance = (project) => {
    if (!project || !currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'employer' && currentUser.id) {
      return (
        (Boolean(project.employerId) && project.employerId === currentUser.id) ||
        (Boolean(project.employer_id) && project.employer_id === currentUser.id)
      );
    }
    return false;
  };

  // Auth modal visibility
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Job seeker profile - only active if logged in
  const [userProfile, setUserProfile] = useState(() => {
    const savedUser = localStorage.getItem('worklink_user');
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        const savedProf = localStorage.getItem('worklink_profile');
        if (savedProf) return JSON.parse(savedProf);
        return {
          name: u.name || 'Người dùng',
          title: u.title || 'Ứng viên WorkLink',
          phone: u.phone || '',
          email: u.email || '',
          district: u.district || 'Cầu Giấy',
          city: u.city || 'Hà Nội',
          preferredShift: 'Tối & Cuối tuần',
          expectedSalary: '35.000đ/giờ',
          skills: ['Giao tiếp linh hoạt', 'Nhanh nhẹn'],
          bio: u.bio || 'Ứng viên tìm việc bán thời gian',
          cvName: u.cv_name || 'CV_UngVien.pdf'
        };
      } catch {}
    }
    return null;
  });

  // Modal & Drawer controls
  const [isAICopilotOpen, setIsAICopilotOpen] = useState(false);
  const [isCVAnalyzerOpen, setIsCVAnalyzerOpen] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');

  // Toast notifications
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // 🔒 Tự động xác thực phiên qua HttpOnly Cookie khi reload trang
  useEffect(() => {
    try { localStorage.removeItem('worklink_gemini_api_key'); } catch {}
    
    const verifySessionFromCookie = async () => {
      try {
        const res = await apiGetMe();
        if (res?.user) {
          setCurrentUser(res.user);
          setCurrentUserRole(res.user.role);
          localStorage.setItem('worklink_user', JSON.stringify(res.user));
        }
      } catch {
        // Chưa đăng nhập hoặc cookie hết hạn
      }
    };
    verifySessionFromCookie();
  }, []);

  // Xử lý phiên hết hạn toàn cục: token bị revoke (đổi mật khẩu ở nơi khác, token_version lệch)
  useEffect(() => {
    const handleSessionExpired = () => {
      logout();
      showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại', 'error');
      setIsAuthModalOpen(true);
    };

    window.addEventListener('worklink:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('worklink:session-expired', handleSessionExpired);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync profile to localStorage
  useEffect(() => {
    if (userProfile) {
      localStorage.setItem('worklink_profile', JSON.stringify(userProfile));
    }
  }, [userProfile]);

  // Auth methods
  const login = async (email, password) => {
    const res = await apiLogin(email, password);
    localStorage.setItem('worklink_user', JSON.stringify(res.user));
    setCurrentUser(res.user);
    setCurrentUserRole(res.user.role);
    
    const newProfile = {
      name: res.user.name,
      email: res.user.email,
      phone: res.user.phone || '',
      district: res.user.district || 'Cầu Giấy',
      city: res.user.city || 'Hà Nội',
      title: res.user.title || 'Ứng viên WorkLink',
      bio: res.user.bio || '',
      skills: res.user.skills || '',
      avatar: res.user.avatar || '',
      cvName: res.user.cvName || res.user.cv_name || 'CV_UngVien.pdf',
      ...(res.user.companyName && { companyName: res.user.companyName }),
      ...(res.user.companyLogo && { companyLogo: res.user.companyLogo })
    };
    setUserProfile(newProfile);
    localStorage.setItem('worklink_profile', JSON.stringify(newProfile));

    showToast(`Chào mừng trở lại, ${res.user.name}!`);
    setIsAuthModalOpen(false);
    return res;
  };

  const loginWithGoogle = async (googleData) => {
    const res = await apiGoogleLogin(googleData);
    localStorage.setItem('worklink_user', JSON.stringify(res.user));
    setCurrentUser(res.user);
    setCurrentUserRole(res.user.role);
    
    const newProfile = {
      name: res.user.name,
      email: res.user.email,
      phone: res.user.phone || '',
      district: res.user.district || 'Cầu Giấy',
      city: res.user.city || 'Hà Nội',
      title: res.user.title || 'Ứng viên WorkLink',
      bio: res.user.bio || '',
      skills: res.user.skills || '',
      avatar: res.user.avatar || '',
      cvName: res.user.cvName || res.user.cv_name || 'CV_UngVien.pdf',
      ...(res.user.companyName && { companyName: res.user.companyName }),
      ...(res.user.companyLogo && { companyLogo: res.user.companyLogo })
    };
    setUserProfile(newProfile);
    localStorage.setItem('worklink_profile', JSON.stringify(newProfile));

    showToast(`Đăng nhập Google thành công! Chào mừng ${res.user.name}`);
    setIsAuthModalOpen(false);
    return res;
  };

  const register = async (formData) => {
    const res = await apiRegister(formData);
    localStorage.setItem('worklink_user', JSON.stringify(res.user));
    setCurrentUser(res.user);
    setCurrentUserRole(res.user.role);
    showToast('Đăng ký tài khoản thành công!');
    setIsAuthModalOpen(false);
    return res;
  };

  const logout = () => {
    apiLogout().catch(() => {});

    localStorage.removeItem('worklink_user');
    localStorage.removeItem('worklink_applications');
    localStorage.removeItem('worklink_saved_ids');
    localStorage.removeItem('worklink_profile');
    localStorage.removeItem('worklink_history');
    setAuthToken(null);
    setCurrentUser(null);
    setCurrentUserRole('job_seeker');
    setUserProfile(null);
    setIsCVAnalyzerOpen(false);
    showToast('Đã đăng xuất tài khoản thành công');
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    try {
      const res = await apiChangePassword({ currentPassword, newPassword });
      showToast(res.message || 'Đổi mật khẩu thành công!');
      return res;
    } catch (err) {
      showToast(err.message || 'Đổi mật khẩu thất bại', 'error');
      throw err;
    }
  };

  const forgotPassword = async (email) => {
    try {
      const res = await apiForgotPassword(email);
      showToast(res.message || 'Đã gửi yêu cầu đặt lại mật khẩu!');
      return res;
    } catch (err) {
      showToast(err.message || 'Yêu cầu đặt lại mật khẩu thất bại', 'error');
      throw err;
    }
  };

  const resetPassword = async ({ resetToken, newPassword }) => {
    try {
      const res = await apiResetPassword({ resetToken, newPassword });
      showToast(res.message || 'Đặt lại mật khẩu thành công!');
      return res;
    } catch (err) {
      showToast(err.message || 'Đặt lại mật khẩu thất bại', 'error');
      throw err;
    }
  };

  const updateProfile = async (profileData) => {
    setUserProfile(profileData);
    if (currentUser) {
      setCurrentUser(prev => prev ? { 
        ...prev, 
        name: profileData.name || prev.name, 
        phone: profileData.phone || prev.phone, 
        district: profileData.district || prev.district,
        city: profileData.city || prev.city,
        title: profileData.title || prev.title,
        avatar: profileData.avatar !== undefined ? profileData.avatar : prev.avatar,
        cvName: profileData.cvName || prev.cvName 
      } : prev);
    }
    try {
      await apiUpdateProfile(profileData);
      showToast('Đã lưu thông tin hồ sơ cá nhân lên máy chủ!');
      return true;
    } catch (e) {
      console.warn('[WorkLink Profile Update Local Sync]:', e.message);
      showToast('Đã lưu hồ sơ cục bộ (Máy chủ chưa cập nhật)', 'info');
      return false;
    }
  };

  const handleSetIsCVAnalyzerOpen = (isOpen) => {
    if (isOpen && !currentUser) {
      setIsAuthModalOpen(true);
      showToast('Vui lòng đăng nhập để sử dụng tính năng AI phân tích CV!', 'info');
      return;
    }
    setIsCVAnalyzerOpen(isOpen);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        currentUserRole,
        setCurrentUserRole,
        authToken,
        setAuthToken,
        userProfile,
        setUserProfile,
        isAuthModalOpen,
        setIsAuthModalOpen,
        isAICopilotOpen,
        setIsAICopilotOpen,
        isCVAnalyzerOpen,
        setIsCVAnalyzerOpen: handleSetIsCVAnalyzerOpen,
        geminiApiKey,
        setGeminiApiKey,
        toasts,
        setToasts,
        showToast,
        isJobSeeker,
        isEmployer,
        isAdmin,
        canManageJob,
        canManageGig,
        canManageFreelance,
        login,
        loginWithGoogle,
        register,
        logout,
        changePassword,
        forgotPassword,
        resetPassword,
        updateProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
