import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { scrollToJobResults } from '../services/scrollService';
import { 
  Search, 
  Hash, 
  X, 
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';

export default function FilterBar({ filters, setFilters, onResetFilters }) {
  const { recordHashtagClick } = useApp();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const popularHashtags = [
    '#parttime',
    '#phucvu',
    '#it',
    '#intern',
    '#caugiay',
    '#dongda',
    '#haibatrung',
    '#sinhvien',
    '#remote',
    '#barista'
  ];

  const categories = [
    'Tất cả ngành',
    'F&B',
    'IT',
    'Bán hàng',
    'Marketing',
    'Gia sư',
    'Kho vận',
    'Thiết kế'
  ];

  const districts = [
    'Tất cả khu vực',
    'Cầu Giấy',
    'Đống Đa',
    'Hai Bà Trưng',
    'Thanh Xuân',
    'Nam Từ Liêm',
    'Bắc Từ Liêm',
    'Ba Đình',
    'Hoàn Kiếm',
    'Hoàng Mai',
    'Tây Hồ',
    'Hà Đông',
    'Long Biên',
    'Gia Lâm'
  ];

  const handleHashtagClick = (tag) => {
    recordHashtagClick(tag);
    if (filters.hashtag === tag) {
      setFilters(prev => ({ ...prev, hashtag: '' }));
    } else {
      setFilters(prev => ({ ...prev, hashtag: tag }));
    }
    scrollToJobResults();
  };

  const handleCategorySelect = (cat) => {
    setFilters(prev => ({
      ...prev,
      category: cat === 'Tất cả ngành' ? '' : cat
    }));
    scrollToJobResults();
  };

  const activeFilterCount = [
    filters.category,
    filters.location,
    filters.job_type,
    filters.time,
    filters.experience,
    filters.hashtag,
    filters.min_salary_hourly,
    filters.active_only
  ].filter(Boolean).length;

  return (
    <div id="filter-bar-section" className="mb-8 scroll-mt-24">
      {/* Search & Top Action Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-4">
        
        {/* Direct Keyword Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filters.keyword || ''}
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                scrollToJobResults();
              }
            }}
            placeholder="Tìm theo chức danh, công ty hoặc kỹ năng (VD: Java, Pha chế, Thu ngân...)"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
          />

          {filters.keyword && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, keyword: '' }))}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Category Selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <select
            value={filters.category || 'Tất cả ngành'}
            onChange={(e) => handleCategorySelect(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-slate-900">{c}</option>
            ))}
          </select>

          <select
            value={filters.location || 'Tất cả khu vực'}
            onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value === 'Tất cả khu vực' ? '' : e.target.value }))}
            className="px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {districts.map((d) => (
              <option key={d} value={d} className="bg-slate-900">{d}</option>
            ))}
          </select>

          {/* Advanced Filter Modal Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
              activeFilterCount > 0 || showAdvanced
                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-indigo-500 text-[10px] text-white flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>

          {activeFilterCount > 0 && (
            <button
              onClick={onResetFilters}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
              title="Đặt lại bộ lọc"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Popular Hashtag Cloud */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-slate-400 font-medium flex items-center gap-1">
          <Hash className="w-3.5 h-3.5 text-indigo-400" />
          Hashtag hot:
        </span>
        {popularHashtags.map((tag) => {
          const isSelected = filters.hashtag === tag;
          return (
            <button
              key={tag}
              onClick={() => handleHashtagClick(tag)}
              className={`px-2.5 py-1 rounded-full font-medium transition-all ${
                isSelected
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/50 scale-105'
                  : 'bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300'
              }`}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {/* Advanced Filter Drawer */}
      {showAdvanced && (
        <div className="mt-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-fadeIn">
          
          {/* Job Type */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Hình thức làm việc</label>
            <select
              value={filters.job_type || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, job_type: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Tất cả hình thức</option>
              <option value="PART_TIME">Part-time (Bán thời gian)</option>
              <option value="FULL_TIME">Full-time (Toàn thời gian)</option>
              <option value="INTERN">Thực tập sinh (Intern)</option>
              <option value="FREELANCE">Freelance / Dự án</option>
            </select>
          </div>

          {/* Time Shift */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Ca làm việc</label>
            <select
              value={filters.time || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, time: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Tất cả ca làm</option>
              <option value="BUỔI_TỐI">Ca Tối (Sau 17h)</option>
              <option value="BUỔI_SÁNG">Ca Sáng (07h - 12h)</option>
              <option value="BUỔI_CHIỀU">Ca Chiều (13h - 18h)</option>
              <option value="LINH_HOẠT">Ca Linh hoạt theo lịch học</option>
            </select>
          </div>

          {/* Experience */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Kinh nghiệm</label>
            <select
              value={filters.experience || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, experience: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Tất cả mức kinh nghiệm</option>
              <option value="NO_EXPERIENCE">Không yêu cầu kinh nghiệm</option>
              <option value="LESS_THAN_1_YEAR">Dưới 1 năm kinh nghiệm</option>
              <option value="1_TO_2_YEARS">Từ 1 - 2 năm kinh nghiệm</option>
            </select>
          </div>

          {/* Minimum Hourly Salary */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Mức lương tối thiểu</label>
            <select
              value={filters.min_salary_hourly || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, min_salary_hourly: e.target.value ? Number(e.target.value) : null }))}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="">Tất cả mức lương</option>
              <option value="30000">Từ 30.000đ/giờ trở lên</option>
              <option value="35000">Từ 35.000đ/giờ trở lên</option>
              <option value="40000">Từ 40.000đ/giờ trở lên</option>
            </select>
          </div>

          {/* Deadline / Active Only */}
          <div>
            <label className="text-xs font-semibold text-slate-400 mb-1.5 block">Hạn nộp hồ sơ</label>
            <button
              type="button"
              onClick={() => setFilters(prev => ({ ...prev, active_only: !prev.active_only }))}
              className={`w-full px-3 py-2 rounded-xl border text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                filters.active_only
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20 ring-1 ring-emerald-500'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${filters.active_only ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
              <span>{filters.active_only ? 'Chỉ tin còn hạn ✓' : 'Tất cả tin (kể cả hết hạn)'}</span>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
