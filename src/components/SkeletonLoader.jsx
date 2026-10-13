import React from 'react';
import JobCardSkeleton from './JobCardSkeleton';

/**
 * Universal SkeletonLoader component for WorkLink UI
 * Hỗ trợ các kiểu hiển thị:
 * - 'job' | 'job-card': Lưới khung xương đồng bộ cho danh sách tuyển dụng
 * - 'card': Thẻ bài viết / item tổng quát
 * - 'list': Danh sách item hàng ngang
 * - 'circle': Avatar / huy hiệu tròn
 * - 'line': Dòng văn bản mặc định
 */
export default function SkeletonLoader({
  type = 'line',
  count = 1,
  className = '',
  height = '1rem',
  width = '100%'
}) {
  const items = Array.from({ length: count });

  // 1. Chuyên biệt cho danh sách việc làm (Job List)
  if (type === 'job' || type === 'job-card') {
    return (
      <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
        {items.map((_, idx) => (
          <JobCardSkeleton key={idx} />
        ))}
      </div>
    );
  }

  // 2. Kiểu card tổng quát
  if (type === 'card') {
    return (
      <div className={`space-y-4 ${className}`}>
        {items.map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 animate-pulse space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-800 shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-1/3 bg-slate-800 rounded" />
                <div className="h-3 w-1/4 bg-slate-800/60 rounded" />
              </div>
            </div>
            <div className="h-4 w-3/4 bg-slate-800 rounded" />
            <div className="h-3 w-full bg-slate-800/40 rounded" />
            <div className="flex gap-2 pt-2">
              <div className="h-6 w-20 bg-slate-800 rounded-md" />
              <div className="h-6 w-20 bg-slate-800 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // 3. Kiểu danh sách hàng ngang
  if (type === 'list') {
    return (
      <div className={`space-y-3 ${className}`}>
        {items.map((_, idx) => (
          <div
            key={idx}
            className="flex items-center gap-4 p-3 rounded-xl bg-slate-900/40 border border-slate-800/50 animate-pulse"
          >
            <div className="w-10 h-10 rounded-lg bg-slate-800 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-3.5 w-2/5 bg-slate-800 rounded" />
              <div className="h-3 w-1/4 bg-slate-800/60 rounded" />
            </div>
            <div className="h-7 w-16 bg-slate-800 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  // 4. Kiểu hình tròn / Avatar
  if (type === 'circle') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {items.map((_, idx) => (
          <div
            key={idx}
            style={{ width, height: width }}
            className="rounded-full bg-slate-800 animate-pulse shrink-0"
          />
        ))}
      </div>
    );
  }

  // 5. Default: Kiểu dòng (line)
  return (
    <div className={`space-y-2 ${className}`}>
      {items.map((_, idx) => (
        <div
          key={idx}
          style={{ height, width }}
          className="rounded-md bg-slate-800/70 animate-pulse"
        />
      ))}
    </div>
  );
}

export { JobCardSkeleton };
