/**
 * ExternalJobsPanel — Bảng việc làm Minh hoạ (Demo)
 * Hiển thị dữ liệu mẫu để minh hoạ giao diện. Không phải tin tuyển dụng thực tế.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { soundFx } from '../services/soundEffects';
import {
  ExternalLink,
  RefreshCw,
  Search,
  MapPin,
  Building2,
  DollarSign,
  Clock,
  Filter,
  ChevronRight,
  ShieldCheck,
  Zap,
  AlertCircle,
  CheckCircle2,
  Briefcase,
  Sparkles
} from 'lucide-react';

import { API_BASE } from '../config/apiBase.js';

const CATEGORY_TABS = [
  { id: 'all', label: 'Tất cả ngành nghề' },
  { id: 'IT', label: '💻 Công nghệ / IT' },
  { id: 'Marketing', label: '📱 Marketing & Ads' },
  { id: 'Bán hàng', label: '💼 Sales & B2B' },
  { id: 'F&B', label: '☕ F&B & Barista' },
  { id: 'Thiết kế', label: '🎨 UI/UX & Đồ họa' },
  { id: 'Kế toán', label: '📊 Tài chính & Kế toán' }
];

const LOCATION_OPTS = [
  { value: '', label: 'Tất cả địa điểm' },
  { value: 'Hà Nội', label: '🏙️ Hà Nội' },
  { value: 'HCM', label: '🌆 TP. Hồ Chí Minh' },
  { value: 'Đà Nẵng', label: '🌊 Đà Nẵng' },
  { value: 'Remote', label: '🏠 Remote / Toàn quốc' }
];

function timeSince(isoString) {
  if (!isoString) return 'Vừa đăng';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(1, mins)} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  return `${Math.floor(hrs / 24)} ngày trước`;
}

export default function ExternalJobsPanel() {
  const [jobs, setJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [location, setLocation] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState(null);

  const LIMIT = 12;

  const fetchJobs = useCallback(async (pg = 1, kw = keyword, loc = location, cat = activeCategory) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        q: kw,
        location: loc,
        category: cat === 'all' ? '' : cat,
        page: pg,
        limit: LIMIT
      });
      const res = await fetch(`${API_BASE}/api/external-jobs?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        setJobs(data.jobs || []);
        setTotal(data.total || 0);
        setLastSync(new Date().toISOString());
      }
    } catch (err) {
      console.warn('[TopCV Jobs Load Error]', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [keyword, location, activeCategory]);

  useEffect(() => {
    fetchJobs(1, '', '', 'all');
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchJobs(1, keyword, location, activeCategory);
    soundFx.playPop();
  };

  const handleCategoryChange = (catId) => {
    setActiveCategory(catId);
    setPage(1);
    fetchJobs(1, keyword, location, catId);
    soundFx.playPop();
  };

  const handleRefresh = () => {
    soundFx.playPop();
    fetchJobs(page, keyword, location, activeCategory);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

      {/* Hero Header — Demo Notice */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800/40 to-slate-900 border border-amber-500/30 shadow-xl mb-6 relative overflow-hidden">
        {/* Glow decoration */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold mb-3 shadow-sm">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>Dữ liệu Minh hoạ — DEMO 🔖</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2 tracking-tight flex items-center gap-2">
              Việc Làm Mẫu (Demo)
            </h1>
            <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
              ⚠️ Đây là <strong>dữ liệu minh hoạ</strong> — tên công ty, mức lương và các thông tin khác đều là{' '}
              <strong className="text-amber-300">hư cấu</strong>, chỉ phục vụ mục đích trình bày giao diện.
              Không phải tin tuyển dụng thực tế từ bất kỳ sàn tuyển dụng nào.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-amber-500/30 text-amber-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm disabled:opacity-50"
              title="Làm mới danh sách"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Demo Disclaimer */}
        <div className="mt-5 pt-4 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Tên công ty là hư cấu, không đại diện thực tế</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Link ứng tuyển không dẫn tới tin tuyển dụng thật</span>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Chỉ dùng để minh hoạ chức năng giao diện</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <form onSubmit={handleSearch} className="mb-6 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md shadow-md">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Tìm theo vị trí, công nghệ (React, Node.js, Marketing, Barista...)"
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="relative sm:w-48">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <select
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                setPage(1);
                fetchJobs(1, keyword, e.target.value, activeCategory);
              }}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer"
            >
              {LOCATION_OPTS.map(opt => (
                <option key={opt.value} value={opt.value} className="bg-slate-900 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            <span>Tìm việc</span>
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-800/60 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleCategoryChange(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </form>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span>Tìm thấy <strong className="text-amber-400 font-bold">{jobs.length}</strong> việc làm (dữ liệu mẫu)</span>
          {activeCategory !== 'all' && (
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {CATEGORY_TABS.find(t => t.id === activeCategory)?.label}
            </span>
          )}
        </div>
        {lastSync && (
          <span className="hidden sm:inline text-slate-500">
            Cập nhật lúc: {new Date(lastSync).toLocaleTimeString('vi-VN')}
          </span>
        )}
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 animate-pulse h-48 flex flex-col justify-between">
              <div>
                <div className="h-4 bg-slate-800 rounded w-3/4 mb-3" />
                <div className="h-3 bg-slate-800/60 rounded w-1/2 mb-4" />
                <div className="h-3 bg-slate-800/40 rounded w-full mb-2" />
                <div className="h-3 bg-slate-800/40 rounded w-2/3" />
              </div>
              <div className="h-8 bg-slate-800/50 rounded-xl w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && jobs.length === 0 && (
        <div className="text-center py-16 px-4 rounded-3xl bg-slate-900/40 border border-dashed border-slate-800">
          <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-300 mb-1">Không tìm thấy việc làm phù hợp</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            Thử thay đổi từ khóa tìm kiếm hoặc chọn lại địa điểm / ngành nghề khác.
          </p>
          <button
            onClick={() => {
              setKeyword('');
              setLocation('');
              setActiveCategory('all');
              fetchJobs(1, '', '', 'all');
            }}
            className="px-4 py-2 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          >
            Xem tất cả việc làm TopCV
          </button>
        </div>
      )}

      {/* Jobs Grid */}
      {!isLoading && jobs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(job => (
            <div
              key={job.id}
              className="group p-5 rounded-2xl bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-xl hover:shadow-emerald-950/20 flex flex-col justify-between"
            >
              <div>
                {/* Source Badge & Time */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Demo 🔖
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    {timeSince(job.publishedAt)}
                  </span>
                </div>

                {/* Job Title */}
                <h3 className="text-sm font-bold text-white group-hover:text-emerald-300 transition-colors line-clamp-2 mb-1.5 leading-snug">
                  {job.title}
                </h3>

                {/* Company Name */}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
                  <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-medium truncate">{job.company}</span>
                </div>

                {/* Salary & Location */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <DollarSign className="w-3.5 h-3.5" />
                    {job.salary}
                  </span>

                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-slate-800/80 text-slate-400 border border-slate-700/60">
                    <MapPin className="w-3 h-3" />
                    {job.district ? `${job.district}, ${job.location}` : job.location}
                  </span>
                </div>

                {/* Description snippet */}
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">
                  {job.description}
                </p>

                {/* Badges */}
                {Array.isArray(job.badges) && job.badges.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {job.badges.map((b, idx) => (
                      <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 border border-slate-700/50">
                        {b}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Apply Button */}
              {(() => {
                const cleanKeyword = (job.title || '').replace(/\(.*?\)/g, '').trim();
                const realApplyUrl = (job.applyUrl && job.applyUrl !== '#')
                  ? job.applyUrl
                  : `https://www.topcv.vn/tim-viec-lam?keyword=${encodeURIComponent(cleanKeyword || 'developer')}`;
                return (
                  <a
                    href={realApplyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => soundFx.playPop()}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 group/btn cursor-pointer"
                  >
                    <span>Ứng tuyển thực tế tại TopCV</span>
                    <ExternalLink className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                  </a>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Demo Notice Footer */}
      <div className="mt-8 p-4 rounded-2xl bg-amber-950/20 border border-amber-500/20 text-center">
        <p className="text-xs text-amber-300/70">
          🔖 <strong>Lưu ý:</strong> Toàn bộ dữ liệu hiển thị trên trang này là <strong>minh hoạ (demo)</strong>.
          Tên công ty, mức lương, và link ứng tuyển đều là hư cấu, không đại diện cho bất kỳ tin tuyển dụng thực tế nào.
        </p>
      </div>

    </div>
  );
}
