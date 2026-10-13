import axios from 'axios';

/**
 * WorkLink Axios Client (Chuẩn Production)
 * - Sử dụng HttpOnly Cookie (withCredentials: true)
 * - Tuyệt đối không lưu trữ hay gửi token qua localStorage (Chống XSS)
 */
import { BACKEND_URL, API_BASE_URL } from '../config/apiBase.js';
export { BACKEND_URL, API_BASE_URL };

const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Tương đương credentials: 'include' (gửi kèm HttpOnly Cookie tự động)
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// 🛡️ Quản lý CSRF Token tập trung
let csrfToken = null;
let csrfPromise = null;

/**
 * Lấy CSRF token từ Backend (GET /api/csrf-token)
 * Đảm bảo chỉ gọi 1 request đồng thời kể cả khi nhiều request mutation cùng kích hoạt
 * @returns {Promise<string|null>}
 */
export async function getCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfPromise) {
    csrfPromise = axios.get(`${API_BASE_URL}/csrf-token`, { withCredentials: true })
      .then((res) => {
        csrfToken = res.data?.csrfToken || null;
        return csrfToken;
      })
      .catch((err) => {
        // Không chặn luồng ứng dụng nếu server chưa bật CSRF hoặc môi trường dev
        console.warn('[CSRF] Lấy CSRF token:', err.message);
        return null;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

// 🚀 Tự động lấy CSRF token ngay khi load ứng dụng phía client
if (typeof window !== 'undefined') {
  getCsrfToken();
}

// Request Interceptor: Tự động đính kèm X-CSRF-Token cho các request POST, PUT, DELETE, PATCH
axiosClient.interceptors.request.use(
  async (config) => {
    const method = config.method?.toUpperCase();
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
      if (!csrfToken) {
        await getCsrfToken();
      }
      if (csrfToken && csrfToken !== 'csrf-disabled' && csrfToken !== 'bearer-auth-exempt') {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Xử lý hết hạn phiên và auto refresh token
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

axiosClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  async (error) => {
    const originalRequest = error.config;

    // Bỏ qua nếu lỗi không có response hoặc là lỗi mạng
    if (!error.response) {
      return Promise.reject(error);
    }

    const { status } = error.response;
    const isAuthRoute = originalRequest.url?.includes('/auth/login') ||
                        originalRequest.url?.includes('/auth/register') ||
                        originalRequest.url?.includes('/auth/refresh');

    // Nếu gặp 401 trên các route cần xác thực (không phải login/register/refresh)
    if (status === 401 && !originalRequest._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => axiosClient(originalRequest))
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Thử gia hạn phiên làm việc bằng Refresh Token trong HttpOnly Cookie
        await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        processQueue(null);
        return axiosClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        // Bắn event toàn cục thông báo phiên đã hết hạn
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('worklink:session-expired'));
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    // 🛡️ Tự động tái cấp phát và gửi lại request nếu CSRF token bị mismatch hoặc hết hạn (403 EBADCSRFTOKEN)
    if (status === 403 && (error.response?.data?.code === 'EBADCSRFTOKEN' || error.response?.data?.message?.includes('CSRF'))) {
      if (!originalRequest._csrfRetry) {
        originalRequest._csrfRetry = true;
        csrfToken = null;
        const refreshedToken = await getCsrfToken();
        if (refreshedToken && refreshedToken !== 'csrf-disabled' && refreshedToken !== 'bearer-auth-exempt') {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers['X-CSRF-Token'] = refreshedToken;
          return axiosClient(originalRequest);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;

// Các API Auth tiện ích
export const authAPI = {
  login: (email, password) => axiosClient.post('/auth/login', { email, password }),
  register: (userData) => axiosClient.post('/auth/register', userData),
  googleLogin: (googleData) => axiosClient.post('/auth/google', googleData),
  logout: () => axiosClient.post('/auth/logout'),
  getMe: () => axiosClient.get('/auth/me'),
  updateProfile: (profileData) => axiosClient.put('/auth/me', profileData),
  changePassword: (passwords) => axiosClient.post('/auth/change-password', passwords),
  forgotPassword: (email) => axiosClient.post('/auth/forgot-password', { email }),
  resetPassword: (resetData) => axiosClient.post('/auth/reset-password', resetData)
};
