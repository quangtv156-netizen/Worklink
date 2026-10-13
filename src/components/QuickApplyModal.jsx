import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { X, Send, FileText, Upload, CheckCircle2, Paperclip, RefreshCw } from 'lucide-react';
import { soundFx } from '../services/soundEffects';

import { API_BASE } from '../config/apiBase.js';

export default function QuickApplyModal() {
  const {
    selectedJobForApply,
    setSelectedJobForApply,
    userProfile,
    currentUser,
    applyForJob,
    showToast,
    setIsAuthModalOpen
  } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    note: ''
  });
  const [cvFile, setCvFile] = useState(null);        // File object
  const [cvName, setCvName] = useState('');          // tên hiển thị
  const [cvFileId, setCvFileId] = useState(null);    // ID file đã lưu trên server
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Reset form khi job thay đổi
  useEffect(() => {
    if (selectedJobForApply) {
      setFormData({
        name: userProfile?.name || currentUser?.name || '',
        phone: userProfile?.phone || currentUser?.phone || '',
        email: userProfile?.email || currentUser?.email || '',
        note: ''
      });
      // Nếu user đã có CV trước đó
      const savedCv = userProfile?.cvName || currentUser?.cv_name || '';
      setCvName(savedCv);
      setCvFile(null);
      setCvFileId(null);
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  }, [selectedJobForApply, userProfile, currentUser]);

  if (!selectedJobForApply) return null;

  const job = selectedJobForApply;

  // ── Upload file CV lên server ─────────────────────────────
  const handleFileChange = async (file) => {
    if (!file) return;
    if (!currentUser) {
      soundFx.playPop();
      showToast?.('Vui lòng đăng nhập để đính kèm CV xin việc!', 'error');
      setIsAuthModalOpen?.(true);
      return;
    }

    const allowedExts = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExts.includes(ext)) {
      soundFx.playPop();
      showToast?.('Chỉ chấp nhận file định dạng .pdf, .doc, .docx hoặc .txt', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      soundFx.playPop();
      showToast?.('Dung lượng file CV không được vượt quá 5MB!', 'error');
      return;
    }

    setCvFile(file);
    setCvName(file.name);
    soundFx.playPop();

    // Upload ngay lên server để lấy xác nhận
    setIsUploading(true);
    setUploadProgress(30);

    try {
      const formDataUpload = new FormData();
      formDataUpload.append('cv', file);

      setUploadProgress(60);
      const res = await fetch(`${API_BASE}/api/cv/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload
      });
      const data = await res.json();
      setUploadProgress(100);

      if (data.success) {
        setCvName(data.fileName);
        if (data.fileId) {
          setCvFileId(data.fileId);
        }
      }
    } catch {
      // Vẫn giữ tên file local nếu upload thất bại
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1500);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  // ── Nộp đơn ứng tuyển ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    soundFx.playPop();

    if (!currentUser) {
      showToast?.('Vui lòng đăng nhập tài khoản Ứng viên để nộp đơn ứng tuyển!', 'error');
      setIsAuthModalOpen?.(true);
      return;
    }

    setIsSubmitting(true);

    try {
      await applyForJob(job, {
        ...formData,
        cvName: cvName || 'CV_DinhKem.pdf',
        cvFileId: cvFileId || null
      });
      soundFx.playSuccess();
      setSelectedJobForApply(null);
    } catch {
      // AppContext đã hiện toast lỗi
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={() => setSelectedJobForApply(null)}
    >
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-indigo-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Send className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-white">Nộp Hồ Sơ Ứng Tuyển</h3>
              <p className="text-[11px] text-slate-400">Kết nối trực tiếp với Nhà tuyển dụng</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedJobForApply(null)}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Job Banner */}
        <div className="bg-slate-950/90 px-6 py-3 border-b border-slate-800 flex items-center justify-between text-xs">
          <div>
            <p className="font-bold text-white truncate max-w-[280px]">{job.title}</p>
            <p className="text-slate-400">{job.company} • {job.district}</p>
          </div>
          <span className="font-bold text-indigo-400">{job.salaryDisplay || job.salary_display}</span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)]">

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Họ và tên *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="Nguyễn Văn A"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Số điện thoại *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                placeholder="0988..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="email@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Lời nhắn / Lịch rảnh</label>
            <textarea
              rows="2"
              value={formData.note}
              onChange={(e) => setFormData(p => ({ ...p, note: e.target.value }))}
              placeholder="Em có thể làm ca tối trong tuần, mong muốn gắn bó lâu dài..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* CV Upload */}
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1.5">
              CV / Hồ sơ đính kèm <span className="text-slate-500">(PDF, DOCX, TXT — tối đa 5MB)</span>
            </label>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className="rounded-xl border border-dashed border-slate-700 hover:border-indigo-500/60 transition-all overflow-hidden"
            >
              {cvFile || cvName ? (
                // File đã chọn
                <div className="p-3 bg-slate-950 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isUploading ? 'bg-indigo-500/20' : 'bg-emerald-500/20'}`}>
                      {isUploading ? (
                        <RefreshCw className="w-4 h-4 text-indigo-400 animate-spin" />
                      ) : (
                        <FileText className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white truncate max-w-[200px]">{cvName}</p>
                      <p className="text-[10px] text-slate-400">
                        {isUploading
                          ? `Đang tải lên... ${uploadProgress}%`
                          : cvFile
                            ? `${formatFileSize(cvFile.size)} • ✅ Sẵn sàng nộp`
                            : '✅ CV từ hồ sơ cá nhân'
                        }
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                  >
                    Đổi file
                  </button>
                </div>
              ) : (
                // Chưa có file
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-4 flex flex-col items-center gap-2 text-slate-500 hover:text-slate-300 transition-all"
                >
                  <Upload className="w-6 h-6" />
                  <span className="text-xs">Click hoặc kéo thả file CV vào đây</span>
                </button>
              )}

              {/* Upload progress bar */}
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="h-1 bg-slate-800">
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileChange(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          {/* Submit */}
          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang gửi hồ sơ...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Xác nhận Nộp Đơn</span>
                </>
              )}
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-2">
              Bằng cách nhấn nộp đơn, thông tin của bạn sẽ được gửi trực tiếp đến nhà tuyển dụng.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
