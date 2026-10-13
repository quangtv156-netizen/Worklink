import React from 'react';

/**
 * JobCardSkeleton Component
 * Hiệu ứng loading skeleton đồng bộ, chuẩn xác theo cấu trúc của JobCard
 * Giúp giao diện chuyển cảnh mượt mà, chuyên nghiệp (UX polish)
 */
export default function JobCardSkeleton() {
  return (
    <div className="relative rounded-2xl bg-slate-900/60 border border-slate-800/80 p-5 flex flex-col justify-between overflow-hidden animate-pulse">
      {/* Hiệu ứng tia sáng quét (Shimmer gradient) */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none" />

      <div>
        {/* Header: Company Avatar & Bookmark button */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-800/90 flex-shrink-0" />
            <div className="space-y-2">
              <div className="h-4 w-32 bg-slate-800/90 rounded-md" />
              <div className="h-3 w-20 bg-slate-800/60 rounded-md" />
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-slate-800/50" />
        </div>

        {/* Title & Salary */}
        <div className="h-5 w-4/5 bg-slate-800/90 rounded-md mb-2" />
        <div className="h-4 w-2/5 bg-slate-800/60 rounded-md mb-4" />

        {/* Badges / Meta tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="h-6 w-24 bg-slate-800/80 rounded-md" />
          <div className="h-6 w-20 bg-slate-800/80 rounded-md" />
          <div className="h-6 w-28 bg-slate-800/80 rounded-md" />
        </div>

        {/* Description snippet */}
        <div className="space-y-1.5 mb-5">
          <div className="h-3 w-full bg-slate-800/40 rounded" />
          <div className="h-3 w-4/5 bg-slate-800/40 rounded" />
        </div>
      </div>

      {/* Footer: Deadline & Action button */}
      <div className="pt-4 border-t border-slate-800/60 flex items-center justify-between">
        <div className="h-4 w-28 bg-slate-800/60 rounded-md" />
        <div className="h-8 w-24 bg-slate-800/90 rounded-xl" />
      </div>
    </div>
  );
}
