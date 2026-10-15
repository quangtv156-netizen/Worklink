/**
 * WorkLink API Client Service
 * Kết nối Frontend React với Backend Express API (Port 5000)
 */

import { getCsrfToken } from "./axiosClient.js";
import { BACKEND_URL, API_BASE_URL } from "../config/apiBase.js";

export { BACKEND_URL, API_BASE_URL };

async function request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  // 🛡️ Tự động đính kèm X-CSRF-Token cho các phương thức thay đổi dữ liệu
  const method = (options.method || "GET").toUpperCase();
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
    try {
      const csrfToken = await getCsrfToken();
      if (
        csrfToken &&
        csrfToken !== "csrf-disabled" &&
        csrfToken !== "bearer-auth-exempt"
      ) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    } catch {
      // Bỏ qua nếu không lấy được CSRF token
    }
  }

  // 🔒 Bảo mật Production (H1): Session hoàn toàn lưu trữ trong HttpOnly Cookie
  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });
  const data = await response
    .json()
    .catch(() => ({ message: `HTTP ${response.status}` }));

  if (!response.ok) {
    const isAuthEndpoint =
      endpoint === "/auth/login" || endpoint === "/auth/register";
    if (response.status === 401 && !isAuthEndpoint) {
      window.dispatchEvent(new CustomEvent("worklink:session-expired"));
    }

    const err = new Error(
      data.message || `Lỗi yêu cầu HTTP ${response.status}`,
    );
    err.response = { status: response.status, data };
    console.warn(`[WorkLink API Error] ${endpoint}:`, err.message);
    throw err;
  }
  return data;
}

// 1. AUTH API
export async function apiLogin(email, password) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function apiRegister(userData) {
  return request("/auth/register", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function apiGoogleLogin(googleData) {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify(googleData),
  });
}

export async function apiLogout() {
  try {
    await request("/auth/logout", { method: "POST" });
  } catch {
    // Fail-safe: Vẫn cho phép hoàn tất logout client khi offline
  }
}

export async function apiGetMe() {
  return request("/auth/me");
}

export async function apiUpdateProfile(profileData) {
  return request("/auth/me", {
    method: "PUT",
    body: JSON.stringify(profileData),
  });
}

export async function apiChangePassword({ currentPassword, newPassword }) {
  return request("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export async function apiForgotPassword(email) {
  return request("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function apiResetPassword({ resetToken, newPassword }) {
  return request("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ resetToken, newPassword }),
  });
}

// 2. JOBS API
export async function apiGetJobs(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/jobs${query ? `?${query}` : ""}`);
}

export async function apiGetJob(jobId) {
  return request(`/jobs/${jobId}`);
}

export async function apiAISearch(queryText, filters = {}) {
  return request("/jobs/ai-search", {
    method: "POST",
    body: JSON.stringify({ query: queryText, filters }),
  });
}

export async function apiCreateJob(jobData) {
  return request("/jobs", {
    method: "POST",
    body: JSON.stringify(jobData),
  });
}

export async function apiBoostJob(jobId, type) {
  return request(`/jobs/${jobId}/boost`, {
    method: "POST",
    body: JSON.stringify({ type }),
  });
}

export async function apiGetMyJobs() {
  return request("/jobs/my");
}

export async function apiUpdateJob(jobId, jobData) {
  return request(`/jobs/${jobId}`, {
    method: "PUT",
    body: JSON.stringify(jobData),
  });
}

export async function apiDeleteJob(jobId) {
  return request(`/jobs/${jobId}`, {
    method: "DELETE",
  });
}

// 3. APPLICATIONS API
export async function apiSubmitApplication(appData) {
  return request("/applications", {
    method: "POST",
    body: JSON.stringify(appData),
  });
}

export async function apiWithdrawApplication(appId) {
  return request(`/applications/${appId}`, {
    method: "DELETE",
  });
}

export async function apiGetMyApplications() {
  return request("/applications/my");
}

export async function apiGetEmployerApplications() {
  return request("/applications/employer");
}

export async function apiUpdateApplicationStatus(appId, status) {
  return request(`/applications/${appId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// 4. FREELANCE API
export async function apiGetFreelance() {
  return request("/freelance");
}

export async function apiCreateFreelanceProject(projectData) {
  return request("/freelance", {
    method: "POST",
    body: JSON.stringify(projectData),
  });
}

export async function apiUpdateFreelanceProject(projectId, data) {
  return request(`/freelance/${projectId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function apiDeleteFreelanceProject(projectId) {
  return request(`/freelance/${projectId}`, {
    method: "DELETE",
  });
}

export async function apiSubmitProposal(projectId, proposalData) {
  return request(`/freelance/${projectId}/proposals`, {
    method: "POST",
    body: JSON.stringify(proposalData),
  });
}

export async function apiGetProjectProposals(projectId) {
  return request(`/freelance/${projectId}/proposals`);
}

export async function apiGetMyProposals() {
  return request("/freelance/proposals/mine");
}

// 5. GIGS API
export async function apiGetGigs() {
  return request("/gigs");
}

export async function apiGetMyGigs() {
  return request("/gigs/mine");
}

export async function apiCreateGig(gigData) {
  return request("/gigs", {
    method: "POST",
    body: JSON.stringify(gigData),
  });
}

export async function apiUpdateGig(gigId, gigData) {
  return request(`/gigs/${gigId}`, {
    method: "PUT",
    body: JSON.stringify(gigData),
  });
}

export async function apiDeleteGig(gigId) {
  return request(`/gigs/${gigId}`, {
    method: "DELETE",
  });
}

export async function apiAcceptGig(gigId, acceptedBy) {
  return request(`/gigs/${gigId}/accept`, {
    method: "POST",
    body: JSON.stringify({ acceptedBy }),
  });
}

// 6. RATINGS API
export async function apiSubmitRating(ratingData) {
  return request("/ratings", {
    method: "POST",
    body: JSON.stringify(ratingData),
  });
}

export async function apiGetCompanyRatings(company) {
  return request(`/ratings/company/${encodeURIComponent(company)}`);
}

export async function apiGetCompanyRatingStats(company) {
  return request(`/ratings/stats/${encodeURIComponent(company)}`);
}

// 7. NOTIFICATIONS API
export async function apiGetNotifications() {
  return request("/notifications");
}

export async function apiMarkAllNotificationsRead() {
  return request("/notifications/read-all", {
    method: "PATCH",
  });
}

export async function apiMarkNotificationRead(id) {
  return request(`/notifications/${id}/read`, {
    method: "PATCH",
  });
}

// 8. ADMIN API (Superuser only)
export async function apiGetAdminStats() {
  return request("/admin/stats");
}

export async function apiGetAdminUsers(params = {}) {
  const query = new URLSearchParams(params).toString();
  return request(`/admin/users${query ? `?${query}` : ""}`);
}

export async function apiUpdateUserRole(userId, role) {
  return request(`/admin/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
  });
}
