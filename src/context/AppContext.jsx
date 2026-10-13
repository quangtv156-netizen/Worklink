import React, { createContext, useContext } from 'react';
import { AuthProvider, useAuth, AuthContext } from './AuthContext';
import { JobProvider, useJob, JobContext } from './JobContext';
import { ChatProvider, useChat, ChatContext } from './ChatContext';

/**
 * AppContext - Composite Architecture (Cụm 4 Refactor)
 * Tách AppContext khổng lồ thành 3 context chuyên biệt:
 * 1. AuthContext: Quản lý đăng nhập, phiên người dùng, quyền hạn (RBAC), hồ sơ cá nhân.
 * 2. JobContext: Quản lý danh sách việc làm, ứng tuyển, dự án freelance, cuốc việc vặt.
 * 3. ChatContext: Quản lý trạng thái nhắn tin thời gian thực và người nhận trò chuyện.
 * 
 * AppProvider bọc 3 provider theo tầng để đảm bảo tính phân ly trạng thái và tránh re-render không cần thiết.
 * useApp() cung cấp tính tương thích ngược 100% cho các component đang sử dụng hook tổng hợp.
 */
export const AppContext = createContext(null);

export function AppProvider({ children }) {
  return (
    <AuthProvider>
      <JobProvider>
        <ChatProvider>
          {children}
        </ChatProvider>
      </JobProvider>
    </AuthProvider>
  );
}

/**
 * useApp Hook
 * Gom hợp dữ liệu từ 3 context riêng biệt (AuthContext, JobContext, ChatContext)
 * Giữ nguyên 100% API contract để tương thích ngược với các component hiện tại
 */
export function useApp() {
  const auth = useAuth();
  const job = useJob();
  const chat = useChat();

  return {
    ...auth,
    ...job,
    ...chat
  };
}

// Re-export tất cả sub-contexts và hooks để các module có thể import trực tiếp và tối ưu hóa re-render
export {
  AuthContext,
  AuthProvider,
  useAuth,
  JobContext,
  JobProvider,
  useJob,
  ChatContext,
  ChatProvider,
  useChat
};

export default AppContext;
