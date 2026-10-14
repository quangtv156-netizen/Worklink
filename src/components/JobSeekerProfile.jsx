import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import {
  Bookmark,
  Send,
  FileText,
  MapPin,
  Clock,
  DollarSign,
  ShieldCheck,
  Trash2,
  Building2,
  Sparkles,
  Edit3,
  Save,
  MessageSquare,
  Lock,
  LogIn,
  AlertTriangle,
  KeyRound,
  X,
  Download,
  Camera,
} from "lucide-react";
import { soundFx } from "../services/soundEffects";

import { API_BASE } from "../config/apiBase.js";

export default function JobSeekerProfile() {
  const {
    currentUser,
    userProfile,
    setUserProfile,
    updateProfile,
    savedJobIds,
    jobs,
    toggleSaveJob,
    applications,
    setSelectedJobForDetail,
    setActiveChatRecipient,
    setIsCVAnalyzerOpen,
    setIsAuthModalOpen,
    withdrawApplication,
    changePassword,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState("applied"); // 'applied' | 'saved' | 'info'
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState(() => userProfile || {});
  const [appStatusFilter, setAppStatusFilter] = useState("ALL");
  const [appToWithdraw, setAppToWithdraw] = useState(null);

  // Đổi mật khẩu modal states
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdForm, setPwdForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Tải ảnh avatar states & ref
  const fileInputRef = React.useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Vui lòng chọn file hình ảnh (PNG, JPG, JPEG, WEBP)", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast("Kích thước ảnh không vượt quá 5MB", "error");
      return;
    }

    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Data = event.target.result;
      try {
        const updated = {
          ...(userProfile || {}),
          ...editForm,
          avatar: base64Data,
        };
        setEditForm((prev) => ({ ...prev, avatar: base64Data }));
        if (updateProfile) {
          await updateProfile(updated);
        } else {
          setUserProfile(updated);
        }
        soundFx.playSuccess();
        showToast("🎉 Đã cập nhật ảnh đại diện mới thành công!", "success");
      } catch (err) {
        showToast("Không thể cập nhật ảnh đại diện: " + err.message, "error");
      } finally {
        setAvatarUploading(false);
      }
    };
    reader.onerror = () => {
      showToast("Lỗi đọc file ảnh", "error");
      setAvatarUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    try {
      const updated = {
        ...(userProfile || {}),
        ...editForm,
        avatar: "",
      };
      setEditForm((prev) => ({ ...prev, avatar: "" }));
      if (updateProfile) {
        await updateProfile(updated);
      } else {
        setUserProfile(updated);
      }
      showToast("Đã gỡ ảnh đại diện", "info");
    } catch (err) {
      showToast("Lỗi gỡ ảnh đại diện: " + err.message, "error");
    }
  };

  const handleChangePasswordSubmit = async (e) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      showToast("Mật khẩu xác nhận không khớp!", "error");
      return;
    }
    setPwdLoading(true);
    try {
      await changePassword({
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      setIsChangePasswordOpen(false);
      setPwdForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      // Error handled by context
    } finally {
      setPwdLoading(false);
    }
  };

  React.useEffect(() => {
    if (!isEditing) {
      if (userProfile) {
        setEditForm({
          ...userProfile,
          dateOfBirth:
            userProfile.dateOfBirth || currentUser?.dateOfBirth || "",
          fullAddress:
            userProfile.fullAddress || currentUser?.fullAddress || "",
          city: userProfile.city || currentUser?.city || "",
          district: userProfile.district || currentUser?.district || "",
        });
      } else if (currentUser) {
        setEditForm({
          name: currentUser.name || "",
          title: currentUser.title || "Ứng viên WorkLink",
          phone: currentUser.phone || "",
          email: currentUser.email || "",
          district: currentUser.district || "",
          city: currentUser.city || "Hà Nội",
          dateOfBirth: currentUser.dateOfBirth || "",
          fullAddress: currentUser.fullAddress || "",
          preferredShift: currentUser.preferredShift || "",
          expectedSalary: currentUser.expectedSalary || "",
          skills: currentUser.skills || [],
          bio: currentUser.bio || "",
        });
      }
    }
  }, [userProfile, currentUser, isEditing]);

  // NẾU CHƯA ĐĂNG NHẬP: BẢO VỆ DỮ LIỆU BẰNG AUTH GATE
  if (!currentUser) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center animate-fadeIn">
        <div className="p-8 sm:p-10 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl shadow-indigo-950/20">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-600/20">
            <Lock className="w-8 h-8" />
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 inline-flex items-center gap-1.5 mb-3">
            <Sparkles className="w-3 h-3 text-indigo-400" /> Khu vực bảo mật cá
            nhân
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
            Đăng nhập để xem hồ sơ cá nhân
          </h2>

          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
            Hồ sơ cá nhân, thông tin liên lạc và danh sách các đơn ứng tuyển của
            bạn được bảo mật tuyệt đối. Vui lòng đăng nhập để quản lý và theo
            dõi phản hồi từ nhà tuyển dụng.
          </p>

          <button
            onClick={() => {
              soundFx.playPop();
              setIsAuthModalOpen(true);
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm shadow-xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <LogIn className="w-4 h-4" />
            <span>Đăng nhập WorkLink ngay</span>
          </button>
        </div>
      </div>
    );
  }

  const safeProfile = {
    name: userProfile?.name || currentUser?.name || "Ứng viên WorkLink",
    title: userProfile?.title || currentUser?.title || "Ứng viên tìm việc",
    phone: userProfile?.phone || currentUser?.phone || "",
    email: userProfile?.email || currentUser?.email || "",
    district: userProfile?.district || currentUser?.district || "",
    city: userProfile?.city || currentUser?.city || "",
    dateOfBirth: userProfile?.dateOfBirth || currentUser?.dateOfBirth || "",
    fullAddress: userProfile?.fullAddress || currentUser?.fullAddress || "",
    preferredShift:
      userProfile?.preferredShift || currentUser?.preferredShift || "",
    expectedSalary:
      userProfile?.expectedSalary || currentUser?.expectedSalary || "",
    skills: userProfile?.skills || currentUser?.skills || [],
    bio: userProfile?.bio || currentUser?.bio || "",
    avatar: userProfile?.avatar || currentUser?.avatar || "",
    cvName:
      userProfile?.cvName || currentUser?.cvName || currentUser?.cv_name || "",
  };

  const savedJobs = jobs.filter((j) => savedJobIds.includes(j.id));

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    const payload = {
      ...editForm,
      date_of_birth: editForm.dateOfBirth || "",
      full_address: editForm.fullAddress || "",
    };
    if (updateProfile) {
      await updateProfile(payload);
    } else {
      setUserProfile(editForm);
      showToast("Đã lưu thông tin hồ sơ cá nhân thành công!");
    }
    setIsEditing(false);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* User Header Profile Card */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-950 border border-slate-800 shadow-xl mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Avatar với tính năng Tải ảnh từ máy tính */}
            <div
              className="relative group/avatar cursor-pointer shrink-0"
              onClick={() => fileInputRef.current?.click()}
              title="Nhấp để tải ảnh đại diện từ máy tính"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-600/30 overflow-hidden border-2 border-indigo-400/40 group-hover/avatar:border-white transition-all">
                {safeProfile.avatar ? (
                  <img
                    src={safeProfile.avatar}
                    alt={safeProfile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  safeProfile.name?.charAt(0) || "U"
                )}
              </div>
              <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-0.5 pointer-events-none">
                <Camera className="w-4 h-4 text-white" />
                <span>Đổi ảnh</span>
              </div>
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/70 rounded-2xl flex items-center justify-center text-white">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleAvatarFileChange}
              className="hidden"
            />

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-white">
                  {safeProfile.name}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Đã xác minh
                </span>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Camera className="w-3 h-3" />
                  <span>Tải ảnh đại diện</span>
                </button>
                {safeProfile.avatar && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 cursor-pointer transition-colors"
                    title="Gỡ ảnh đại diện"
                  >
                    Gỡ ảnh
                  </button>
                )}
              </div>
              <p className="text-xs text-indigo-400 font-medium">
                {safeProfile.title}
              </p>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                {(safeProfile.district || safeProfile.city) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500" />{" "}
                    {[safeProfile.district, safeProfile.city]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                )}
                {safeProfile.fullAddress && (
                  <span
                    className="flex items-center gap-1 text-slate-500"
                    title={safeProfile.fullAddress}
                  >
                    📍 {safeProfile.fullAddress}
                  </span>
                )}
                {safeProfile.dateOfBirth && (
                  <span className="flex items-center gap-1">
                    🎂 {safeProfile.dateOfBirth}
                  </span>
                )}
                {safeProfile.preferredShift && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" /> Rảnh:{" "}
                    {safeProfile.preferredShift}
                  </span>
                )}
                {safeProfile.expectedSalary && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-slate-500" /> Mong muốn:{" "}
                    {safeProfile.expectedSalary}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                soundFx.playPop();
                setIsCVAnalyzerOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Quét CV & Chấm điểm</span>
            </button>

            <button
              onClick={() => {
                soundFx.playPop();
                setIsChangePasswordOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
              title="Đổi mật khẩu tài khoản"
            >
              <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Đổi mật khẩu</span>
            </button>

            <button
              onClick={() => setIsEditing(!isEditing)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? "Đóng" : "Chỉnh sửa"}</span>
            </button>
          </div>
        </div>

        {/* Profile Edit Form */}
        {isEditing && (
          <form
            onSubmit={handleSaveProfile}
            className="mt-6 pt-6 border-t border-slate-800 space-y-4 animate-fadeIn"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Họ và tên
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Chức danh / Nghề nghiệp hiện tại
                </label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Ngày sinh
                </label>
                <input
                  type="date"
                  value={editForm.dateOfBirth || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      dateOfBirth: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Tỉnh / Thành phố
                </label>
                <input
                  type="text"
                  value={editForm.city || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, city: e.target.value }))
                  }
                  placeholder="VD: Hà Nội"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Quận / Huyện
                </label>
                <input
                  type="text"
                  value={editForm.district || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      district: e.target.value,
                    }))
                  }
                  placeholder="VD: Cầu Giấy"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-300 block mb-1">
                  Địa chỉ chi tiết
                </label>
                <input
                  type="text"
                  value={editForm.fullAddress || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      fullAddress: e.target.value,
                    }))
                  }
                  placeholder="Số nhà, đường, phường/xã..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                Mô tả bản thân & Kỹ năng
              </label>
              <textarea
                rows="2"
                value={editForm.bio}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, bio: e.target.value }))
                }
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white resize-none"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
        <button
          onClick={() => setActiveTab("applied")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "applied"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Send className="w-4 h-4" />
          <span>Việc đã ứng tuyển ({applications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("saved")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            activeTab === "saved"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Việc đã lưu ({savedJobs.length})</span>
        </button>
      </div>

      {/* TAB 1: APPLIED JOBS */}
      {activeTab === "applied" && (
        <div className="space-y-4">
          {/* Status Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-900/60 p-2.5 rounded-2xl border border-slate-800">
            <span className="text-xs text-slate-400 font-semibold px-2">
              Trạng thái:
            </span>
            {[
              { id: "ALL", label: "Tất cả" },
              { id: "pending", label: "⏳ Chờ duyệt" },
              { id: "reviewed", label: "👀 Đã xem" },
              { id: "interview", label: "🎉 Mời phỏng vấn" },
              { id: "rejected", label: "❌ Chưa phù hợp" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setAppStatusFilter(st.id)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  appStatusFilter === st.id
                    ? "bg-indigo-600 text-white shadow-md"
                    : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {(() => {
            const filteredApplications = applications.filter((app) => {
              if (appStatusFilter === "ALL") return true;
              return app.status === appStatusFilter;
            });

            if (filteredApplications.length === 0) {
              return (
                <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
                  <Send className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-400">
                    {applications.length === 0
                      ? "Bạn chưa nộp hồ sơ ứng tuyển công việc nào"
                      : "Không có hồ sơ nào ở trạng thái này"}
                  </p>
                </div>
              );
            }

            return filteredApplications.map((app) => (
              <div
                key={app.id}
                className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h4 className="text-base font-bold text-white">
                      {app.jobTitle}
                    </h4>
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        app.status === "interview"
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : app.status === "reviewed"
                            ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                            : app.status === "rejected"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {app.status === "interview" && "🎉 Mời phỏng vấn"}
                      {app.status === "reviewed" && "👀 Đã xem hồ sơ"}
                      {app.status === "rejected" && "❌ Chưa phù hợp"}
                      {app.status === "pending" && "⏳ Chờ duyệt"}
                    </span>
                  </div>

                  <p className="text-xs text-indigo-400 font-semibold flex items-center gap-1.5 mt-0.5">
                    <Building2 className="w-3.5 h-3.5" />
                    {app.company}
                  </p>

                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                    {app.hasCv || app.cvFilePath ? (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(
                              `${API_BASE}/api/applications/${app.id}/cv`,
                              {
                                credentials: "include",
                              },
                            );
                            if (!res.ok)
                              throw new Error("Không thể tải file CV");
                            const blob = await res.blob();
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = app.cvName || "CV_UngVien.pdf";
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                            showToast("Đang tải file CV...", "success");
                          } catch (err) {
                            showToast(err.message || "Lỗi tải CV", "error");
                          }
                        }}
                        className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline cursor-pointer font-medium"
                        title="Bấm để tải lại file CV bạn đã nộp"
                      >
                        <FileText className="w-3.5 h-3.5 text-indigo-400" />
                        {app.cvName || "CV_UngVien.pdf"}
                        <Download className="w-3 h-3 ml-0.5" />
                      </button>
                    ) : (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3 text-slate-500" />
                        {app.cvName || "CV_UngVien.pdf"}
                      </span>
                    )}
                    <span>• Nộp lúc: {app.appliedAt}</span>
                  </div>

                  {app.note && (
                    <p className="text-xs text-slate-300 bg-slate-950/60 p-2 rounded-lg border border-slate-800 mt-2 max-w-lg">
                      💬 "{app.note}"
                    </p>
                  )}
                </div>

                {/* Real-time Status Badge, Chat Button & Withdraw Button */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                  <button
                    onClick={() => {
                      soundFx.playPop();
                      setActiveChatRecipient({
                        company: app.company,
                        jobTitle: app.jobTitle,
                        jobId: app.jobId,
                        appId: app.id,
                        applicantName: app.applicantName,
                        threadId: `thread_app_${app.id}`,
                      });
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white border border-slate-700 hover:border-indigo-500/50 text-xs font-bold transition-all cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Nhắn tin</span>
                  </button>

                  <button
                    onClick={() => setAppToWithdraw(app)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-500/40 text-slate-400 hover:text-rose-400 text-xs font-semibold transition-all cursor-pointer"
                    title="Hủy / Rút hồ sơ đã nộp"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hủy hồ sơ</span>
                  </button>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {/* TAB 2: SAVED JOBS */}
      {activeTab === "saved" && (
        <div className="space-y-3">
          {savedJobs.length === 0 ? (
            <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800">
              <Bookmark className="w-10 h-10 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-400">
                Bạn chưa lưu công việc nào
              </p>
            </div>
          ) : (
            savedJobs.map((job) => (
              <div
                key={job.id}
                className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div
                  onClick={() => setSelectedJobForDetail(job)}
                  className="cursor-pointer flex-1"
                >
                  <h4 className="text-sm sm:text-base font-bold text-white hover:text-indigo-400 transition-colors">
                    {job.title}
                  </h4>
                  <p className="text-xs text-slate-400">
                    {job.company} • {job.district} • Lương:{" "}
                    <strong className="text-indigo-300">
                      {job.salaryDisplay}
                    </strong>
                  </p>
                </div>

                <button
                  onClick={() => toggleSaveJob(job.id)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
                  title="Bỏ lưu"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Withdrawal Confirmation Modal */}
      {appToWithdraw && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/30 rounded-3xl p-6 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  Xác nhận rút hồ sơ ứng tuyển?
                </h4>
                <p className="text-xs text-slate-400">
                  Bạn có thể nộp lại hồ sơ sau này nếu thay đổi ý định.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-950/80 rounded-xl border border-slate-800 text-xs text-slate-300">
              <p className="font-bold text-white mb-0.5">
                {appToWithdraw.jobTitle}
              </p>
              <p className="text-indigo-400 font-semibold">
                {appToWithdraw.company}
              </p>
              <p className="text-slate-500 text-[11px] mt-1">
                Đã nộp lúc: {appToWithdraw.appliedAt}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setAppToWithdraw(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
              >
                Giữ hồ sơ
              </button>
              <button
                onClick={async () => {
                  soundFx.playPop();
                  await withdrawApplication(appToWithdraw.id);
                  setAppToWithdraw(null);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer"
              >
                Rút hồ sơ ngay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change Password Modal */}
      {isChangePasswordOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsChangePasswordOpen(false)}
        >
          <div
            className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl p-6 overflow-hidden relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">
                  Đổi mật khẩu tài khoản
                </h3>
              </div>
              <button
                onClick={() => setIsChangePasswordOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mật khẩu hiện tại
                </label>
                <input
                  type="password"
                  required
                  value={pwdForm.currentPassword}
                  onChange={(e) =>
                    setPwdForm((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Mật khẩu mới (Tối thiểu 8 ký tự)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pwdForm.newPassword}
                  onChange={(e) =>
                    setPwdForm((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={pwdForm.confirmPassword}
                  onChange={(e) =>
                    setPwdForm((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  {pwdLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  <span>Lưu mật khẩu mới</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
