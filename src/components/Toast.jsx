import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toasts } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => {
        let Icon = CheckCircle2;
        let bgClass = 'bg-emerald-950/90 border-emerald-500/30 text-emerald-200';

        if (toast.type === 'error') {
          Icon = AlertCircle;
          bgClass = 'bg-rose-950/90 border-rose-500/30 text-rose-200';
        } else if (toast.type === 'info') {
          Icon = Info;
          bgClass = 'bg-indigo-950/90 border-indigo-500/30 text-indigo-200';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 transform translate-y-0 ${bgClass}`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
