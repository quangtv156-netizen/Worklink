import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { soundFx } from '../services/soundEffects';
import {
  FileText,
  Sparkles,
  X,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  Award,
  UserCheck,
  CloudUpload,
  FileCheck,
  Brain,
  Loader2
} from 'lucide-react';

import { API_BASE } from '../config/apiBase.js';

export default function AICVAnalyzerModal() {
  const {
    isCVAnalyzerOpen,
    setIsCVAnalyzerOpen,
    setSelectedJobForDetail,
    setSelectedJobForApply,
    currentUser,
    userProfile,
    setUserProfile,
    updateProfile,
    showToast
  } = useApp();

  const [uploadedFile, setUploadedFile] = useState(null);   // { name, size, text, base64, mime }
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [analyzeSource, setAnalyzeSource] = useState('');
  const [manualText, setManualText] = useState('');
  const [inputMode, setInputMode] = useState('upload'); // 'upload' | 'text'
  const fileInputRef = useRef(null);

  if (!isCVAnalyzerOpen) return null;

  const handleClose = () => {
    soundFx.playPop();
    setIsCVAnalyzerOpen(false);
  };

  // ── Upload file lên server ────────────────────────────────
  const handleFileChange = async (file) => {
    if (!file) return;
    const allowedExts = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExts.includes(ext)) {
      showToast('Chỉ chấp nhận file PDF, DOC, DOCX hoặc TXT', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('File tối đa 5 MB', 'error');
      return;
    }

    setIsUploading(true);
    soundFx.playPop();

    try {
      if (!currentUser) {
        showToast('Vui lòng đăng nhập tài khoản để tải lên file CV', 'warning');
        setIsUploading(false);
        return;
      }

      const formData = new FormData();
      formData.append('cv', file);

      const res = await fetch(`${API_BASE}/api/cv/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.message || 'Upload thất bại');

      setUploadedFile({
        name: data.fileName,
        size: data.fileSize,
        text: data.extractedText || '',
        base64: data.fileBase64 || null,
        mime: data.mimeType || 'text/plain',
        needsVision: data.needsVision || false,
        fileId: data.fileId || null
      });
      setAnalysisResult(null);
      showToast(`✅ Đã tải lên: ${data.fileName}`, 'success');
    } catch (err) {
      showToast(`Lỗi upload: ${err.message}`, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileChange(file);
  };

  // ── Phân tích CV với Gemini AI ───────────────────────────
  const handleAnalyze = async () => {
    const cvText = inputMode === 'upload' ? uploadedFile?.text : manualText;
    const fileBase64 = inputMode === 'upload' ? uploadedFile?.base64 : null;
    const mimeType = inputMode === 'upload' ? uploadedFile?.mime : null;

    if (!cvText && !fileBase64) {
      showToast('Vui lòng tải lên file CV hoặc nhập nội dung', 'warning');
      return;
    }

    setIsAnalyzing(true);
    soundFx.playPop();

    try {
      if (!currentUser) {
        showToast('Vui lòng đăng nhập tài khoản để phân tích CV', 'warning');
        setIsAnalyzing(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/cv/analyze`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cvText: cvText || '',
          fileBase64: fileBase64 || null,
          mimeType: mimeType || null
        })
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Phân tích thất bại');

      setAnalysisResult(data);
      setAnalyzeSource(data.source || '');
      soundFx.playSuccess();
      showToast(`🎉 Phân tích hoàn tất! (${data.source || 'AI ATS'})`, 'success');
      if (data.fallbackNotice) {
        setTimeout(() => showToast(`💡 ${data.fallbackNotice}`, 'info'), 1500);
      }
    } catch (err) {
      showToast(`Lỗi phân tích: ${err.message}`, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Đồng bộ kỹ năng vào hồ sơ ───────────────────────────
  const handleApplyToProfile = () => {
    if (!analysisResult) return;
    const currentSkills = Array.isArray(userProfile?.skills)
      ? userProfile.skills
      : (userProfile?.skills ? String(userProfile.skills).split(',').map(s => s.trim()) : []);
    const merged = Array.from(new Set([...currentSkills, ...(analysisResult.detectedSkills || [])]));
    const updated = {
      ...(userProfile || {}),
      skills: merged,
      title: analysisResult.experienceLevel || userProfile?.title || 'Ứng viên',
      ...(analysisResult.candidateName && !userProfile?.name ? { name: analysisResult.candidateName } : {}),
      ...(analysisResult.phone && !userProfile?.phone ? { phone: analysisResult.phone } : {}),
      ...(analysisResult.email && !userProfile?.email ? { email: analysisResult.email } : {})
    };
    if (updateProfile) updateProfile(updated);
    else setUserProfile(updated);
    soundFx.playSuccess();
    showToast('✅ Đã đồng bộ kỹ năng và thông tin vào Hồ sơ!', 'success');
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const scoreColor = (score) => {
    if (score >= 80) return 'from-emerald-400 to-green-500';
    if (score >= 65) return 'from-amber-400 to-orange-400';
    return 'from-rose-400 to-red-500';
  };

  const scoreLabel = (score) => {
    if (score >= 80) return { text: '⭐ CV Xuất Sắc', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    if (score >= 65) return { text: '👍 CV Tốt', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    return { text: '⚠️ Cần Cải Thiện', cls: 'bg-rose-500/20 text-rose-300 border-rose-500/30' };
  };

  const canAnalyze = inputMode === 'upload'
    ? (uploadedFile && !isUploading)
    : manualText.trim().length > 30;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl shadow-black/90 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <span>AI Quét CV & Chấm Điểm ATS</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Gemini AI ⚡
                </span>
              </h2>
              <p className="text-xs text-slate-400">Upload file PDF/DOCX thật — AI quét và phân tích kỹ năng, chấm ATS, gợi ý việc làm phù hợp</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* Mode Tabs */}
          <div className="flex gap-2 p-1 rounded-2xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setInputMode('upload')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${inputMode === 'upload' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <CloudUpload className="w-3.5 h-3.5" />
              Upload File CV (PDF/DOCX)
            </button>
            <button
              onClick={() => setInputMode('text')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${inputMode === 'text' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <FileText className="w-3.5 h-3.5" />
              Dán Nội Dung CV
            </button>
          </div>

          {/* Upload Mode */}
          {inputMode === 'upload' && (
            <div className="space-y-3">
              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 flex flex-col items-center justify-center gap-3 transition-all
                  ${isDragging ? 'border-indigo-400 bg-indigo-950/40' : 'border-slate-700 hover:border-indigo-500/60 bg-slate-950/60 hover:bg-slate-950/80'}`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-indigo-400 animate-spin" />
                    <p className="text-sm font-semibold text-indigo-300">Đang tải lên...</p>
                  </>
                ) : uploadedFile ? (
                  <>
                    <FileCheck className="w-10 h-10 text-emerald-400" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-white">{uploadedFile.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatFileSize(uploadedFile.size)}</p>
                      {uploadedFile.text && (
                        <p className="text-[11px] text-emerald-400 mt-1">✅ Đã trích xuất {uploadedFile.text.length} ký tự</p>
                      )}
                      {uploadedFile.needsVision && (
                        <p className="text-[11px] text-indigo-400 mt-1">🔍 Sẽ dùng Gemini Vision để đọc PDF</p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500">Click để đổi file</span>
                  </>
                ) : (
                  <>
                    <CloudUpload className="w-10 h-10 text-slate-500" />
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-300">Kéo thả hoặc click để chọn file CV</p>
                      <p className="text-xs text-slate-500 mt-0.5">Chấp nhận: PDF, DOCX, DOC, TXT — Tối đa 5 MB</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                  className="hidden"
                />
              </div>

              {/* Quick text preview */}
              {uploadedFile?.text && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 max-h-28 overflow-y-auto">
                  <p className="text-[11px] text-slate-400 font-mono leading-relaxed whitespace-pre-wrap">
                    {uploadedFile.text.slice(0, 500)}{uploadedFile.text.length > 500 ? '...' : ''}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Text Mode */}
          {inputMode === 'text' && (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300">Dán toàn bộ nội dung CV vào đây:</label>
              <textarea
                rows={8}
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                placeholder="Dán nội dung CV của bạn: Họ tên, số điện thoại, email, học vấn, kinh nghiệm, kỹ năng..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700/80 text-slate-200 text-xs font-mono leading-relaxed placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-all"
              />
              {/* Sample buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">Thử mẫu:</span>
                <button
                  type="button"
                  onClick={() => setManualText(`HỌ VÀ TÊN: NGUYỄN VĂN AN\nVỊ TRÍ: Nhân viên Pha chế / Phục vụ Part-time\nSĐT: 0912 345 678 - Email: an.nguyen99@gmail.com\nHọc vấn: Sinh viên năm 2 Đại học Quốc gia\n\nKỸ NĂNG:\n- Pha chế cà phê, trà sữa, quản lý quầy bar\n- Sử dụng KiotViet, máy POS\n- Giao tiếp thân thiện, phục vụ 150+ khách/ca\n\nKINH NGHIỆM:\n- Barista Highlands Coffee (6 tháng)\n- Phục vụ bàn nhà hàng (3 tháng)\nRảnh: tối T2/T4/T6 và Chủ Nhật`)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-all"
                >
                  ☕ CV Barista
                </button>
                <button
                  type="button"
                  onClick={() => setManualText(`HỌ VÀ TÊN: TRẦN ĐỨC MINH\nVỊ TRÍ: Thực tập sinh Frontend Developer\nSĐT: 0988 777 666 - Email: minh.dev@gmail.com\nHọc vấn: SV năm 3 CNTT - ĐH Bách Khoa\n\nKỸ NĂNG:\n- Thành thạo React, JavaScript ES6+, HTML5, CSS3\n- Node.js, Express, PostgreSQL, RESTful API\n- Git, Figma, Responsive Design\n- Tiếng Anh: TOEIC 750\n\nDỰ ÁN:\n- E-commerce React App (300+ sản phẩm)\n- Task Manager với Express + PostgreSQL\nTìm thực tập 3-6 tháng, full/part-time linh hoạt`)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium border border-slate-700 transition-all"
                >
                  💻 CV Dev
                </button>
              </div>
            </div>
          )}

          {/* Analyze Button */}
          <div className="flex justify-center">
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || !canAnalyze}
              className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-sm font-bold shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang phân tích với AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Phân Tích CV & Chấm Điểm ATS</span>
                </>
              )}
            </button>
          </div>

          {/* ── Analysis Results ── */}
          {analysisResult && (
            <div className="space-y-5 pt-4 border-t border-slate-800 animate-in fade-in duration-300">

              {/* Source badge */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white">Kết quả phân tích CV</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${analyzeSource.includes('Gemini') ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>
                  {analyzeSource.includes('Gemini') ? '🤖 Gemini AI' : '⚙️ Local Engine'}
                </span>
              </div>

              {/* ── BỐ CỤC 2 CỘT CHI TIẾT: BÊN TRÁI TỔNG QUAN ATS, BÊN PHẢI BẢNG KỸ NĂNG CHI TIẾT ── */}
              {(() => {
                const allDetected = analysisResult.detectedSkills || [];
                const categorized = analysisResult.categorizedSkills || {};

                // Tách nhóm kỹ năng thông minh
                const techSkills = (categorized.technical && categorized.technical.length > 0)
                  ? categorized.technical
                  : allDetected.filter(s => /react|javascript|typescript|html|css|tailwind|node|express|sql|postgres|mongo|api|python|java|spring|vue|next|flutter|redux/i.test(s));

                const toolSkills = (categorized.tools && categorized.tools.length > 0)
                  ? categorized.tools
                  : allDetected.filter(s => /git|docker|linux|figma|postman|vs code|ci[/-]?cd|cloud|aws|render|vercel/i.test(s));

                const softSkills = (categorized.soft && categorized.soft.length > 0)
                  ? categorized.soft
                  : allDetected.filter(s => /tiếng anh|english|toeic|ielts|nhóm|teamwork|giải quyết|quản lý|giao tiếp|học hỏi|tư duy/i.test(s));

                const businessSkills = (categorized.business && categorized.business.length > 0)
                  ? categorized.business
                  : allDetected.filter(s => !techSkills.includes(s) && !toolSkills.includes(s) && !softSkills.includes(s));

                const totalSkillsCount = allDetected.length;

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Cột trái (5 cols): Điểm ATS, Profile & Đánh giá */}
                    <div className="lg:col-span-5 space-y-4">
                      {/* ATS Score */}
                      <div className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex flex-col items-center justify-center text-center shadow-lg relative overflow-hidden">
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Điểm Tương Thích ATS</span>
                        <div className="flex items-end gap-1.5 my-2">
                          <span className={`text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r ${scoreColor(analysisResult.atsScore)}`}>
                            {analysisResult.atsScore}
                          </span>
                          <span className="text-base text-slate-500 mb-2 font-bold">/100</span>
                        </div>
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${scoreLabel(analysisResult.atsScore).cls}`}>
                          {scoreLabel(analysisResult.atsScore).text}
                        </span>
                        <p className="text-[11px] text-slate-400 mt-3 italic text-center">
                          Hệ thống đã tự động đối chiếu các tiêu chí kỹ năng và kinh nghiệm thực tế.
                        </p>
                      </div>

                      {/* Profile info */}
                      <div className="p-4 rounded-2xl bg-slate-800/80 border border-slate-700 space-y-2">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-700/60">
                          <span className="text-xs text-slate-400 font-semibold flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-400" /> Cấp độ định vị
                          </span>
                          <span className="text-xs font-bold text-white bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-lg border border-indigo-500/30">
                            {analysisResult.experienceLevel}
                          </span>
                        </div>
                        {analysisResult.candidateName && (
                          <p className="text-xs text-slate-300"><strong className="text-white">Ứng viên:</strong> {analysisResult.candidateName}</p>
                        )}
                        {analysisResult.education && (
                          <p className="text-xs text-slate-300"><strong className="text-white">Học vấn:</strong> {analysisResult.education}</p>
                        )}
                        {analysisResult.summary && (
                          <p className="text-[11px] text-slate-300 leading-relaxed italic bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                            "{analysisResult.summary}"
                          </p>
                        )}
                      </div>

                      {/* Điểm mạnh & Điểm cần cải thiện */}
                      <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
                        <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4" /> Điểm mạnh nổi bật:
                        </h4>
                        <ul className="text-xs text-emerald-200/90 space-y-1 list-disc list-inside">
                          {(analysisResult.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>

                      <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 space-y-2">
                        <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4" /> Gợi ý cải thiện CV:
                        </h4>
                        <ul className="text-xs text-amber-200/90 space-y-1 list-disc list-inside">
                          {(analysisResult.improvements || []).map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    </div>

                    {/* Cột phải (7 cols): BẢNG LIỆT KÊ KỸ NĂNG CHI TIẾT RA BÊN CẠNH */}
                    <div className="lg:col-span-7 flex flex-col space-y-4">
                      <div className="p-5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex-1 flex flex-col shadow-lg">
                        {/* Header cột kỹ năng */}
                        <div className="flex items-center justify-between pb-3 border-b border-slate-700 mb-4">
                          <div>
                            <h3 className="text-sm font-black text-white flex items-center gap-2">
                              <Award className="w-4 h-4 text-amber-400" />
                              <span>Bảng Kỹ Năng Chi Tiết ({totalSkillsCount})</span>
                            </h3>
                            <p className="text-[11px] text-slate-400 mt-0.5">Liệt kê và phân loại đầy đủ các kỹ năng phát hiện từ CV</p>
                          </div>

                          <button
                            onClick={handleApplyToProfile}
                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all"
                            title="Lưu tất cả kỹ năng đã quét vào Hồ sơ cá nhân"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Lưu vào Hồ sơ</span>
                          </button>
                        </div>

                        {/* Danh sách kỹ năng chi tiết theo nhóm */}
                        <div className="space-y-4.5 flex-1 overflow-y-auto pr-1 max-h-[520px]">
                          {/* Nhóm 1: Chuyên môn & Lập trình */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                                  💻 Kỹ năng Chuyên môn & Lập trình ({techSkills.length})
                                </h4>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">Độ tương thích cao</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {techSkills.length > 0 ? (
                                techSkills.map((sk, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 text-xs font-semibold hover:border-cyan-400 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                                    {sk}
                                    <span className="text-[10px] text-cyan-400/80 font-mono font-bold ml-1">95%</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500 italic">Chưa phát hiện nhóm này</span>
                              )}
                            </div>
                          </div>

                          {/* Nhóm 2: Công cụ, Nền tảng & Frameworks */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                                  🛠️ Công cụ & Nền tảng ({toolSkills.length})
                                </h4>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">Thực hành tốt</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {toolSkills.length > 0 ? (
                                toolSkills.map((sk, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 text-xs font-semibold hover:border-purple-400 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                    {sk}
                                    <span className="text-[10px] text-purple-400/80 font-mono font-bold ml-1">90%</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500 italic">Chưa phát hiện nhóm này</span>
                              )}
                            </div>
                          </div>

                          {/* Nhóm 3: Ngoại ngữ & Kỹ năng Mềm */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                                  🗣️ Ngoại ngữ & Kỹ năng Mềm ({softSkills.length})
                                </h4>
                              </div>
                              <span className="text-[10px] text-slate-400 font-semibold">Tự tin</span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {softSkills.length > 0 ? (
                                softSkills.map((sk, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs font-semibold hover:border-emerald-400 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    {sk}
                                    <span className="text-[10px] text-emerald-400/80 font-mono font-bold ml-1">Đạt</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-500 italic">Chưa phát hiện nhóm này</span>
                              )}
                            </div>
                          </div>

                          {/* Nhóm 4: Nghiệp vụ & Khác nếu có */}
                          {businessSkills.length > 0 && (
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                  💼 Nghiệp vụ & Khác ({businessSkills.length})
                                </h4>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {businessSkills.map((sk, i) => (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs font-semibold hover:border-amber-400 transition-colors">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    {sk}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Matched Jobs */}
              {(analysisResult.matchedJobs || []).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    🎯 Công việc phù hợp nhất với CV
                    <span className="text-xs font-medium text-slate-400">(dựa trên AI phân tích kỹ năng)</span>
                  </h3>
                  <div className="space-y-2.5">
                    {analysisResult.matchedJobs.map(({ job, matchPercentage, matchedReason }) => (
                      <div
                        key={job.id}
                        className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 hover:border-indigo-500/60 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{job.companyLogo || '🏢'}</span>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4
                                className="text-xs sm:text-sm font-bold text-white hover:text-indigo-400 transition-colors cursor-pointer"
                                onClick={() => { soundFx.playPop(); setSelectedJobForDetail(job); }}
                              >
                                {job.title}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                                {matchPercentage}% Match
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {job.company} • <span className="text-emerald-400 font-semibold">{job.salary_display || job.salary_text || 'Thỏa thuận'}</span> • {job.district}
                            </p>
                            <p className="text-[10px] text-indigo-300/90 mt-0.5">💡 {matchedReason}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                          <button
                            onClick={() => { soundFx.playPop(); setSelectedJobForDetail(job); }}
                            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition-all"
                          >
                            Chi tiết
                          </button>
                          <button
                            onClick={() => { soundFx.playPop(); setSelectedJobForApply(job); }}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 transition-all"
                          >
                            Ứng tuyển
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>AI phân tích theo tiêu chuẩn ATS — Upload file PDF/DOCX để có kết quả chính xác nhất.</span>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-all"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
