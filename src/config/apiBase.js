/**
 * WorkLink API Base Configuration
 * Đảm bảo ứng dụng chạy tương thích trên mọi domain (Localhost, Docker, Cloud, Ngrok, Cloudflare Tunnel).
 *
 * Toán tử ?? đảm bảo nếu VITE_API_URL là chuỗi rỗng ('') thì BACKEND_URL sẽ là chuỗi rỗng (Same-Origin).
 */

export const BACKEND_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:5000' : '');

export const API_BASE = BACKEND_URL ? BACKEND_URL.replace(/\/$/, '') : '';

export const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL.replace(/\/$/, '')}/api` : '/api';

export default {
  BACKEND_URL,
  API_BASE,
  API_BASE_URL
};
