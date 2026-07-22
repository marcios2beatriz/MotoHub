"use client";

import React, { useEffect } from 'react';
import { MessageSquare, X, Bell } from 'lucide-react';

export interface ChatToast {
  id: string;
  title: string;
  message: string;
  sender: string;
  onClick?: () => void;
}

interface ChatToastBannerProps {
  toast: ChatToast | null;
  onClose: () => void;
}

export default function ChatToastBanner({ toast, onClose }: ChatToastBannerProps) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div 
      onClick={() => {
        if (toast.onClick) toast.onClick();
        onClose();
      }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md bg-slate-900 text-white rounded-2xl p-4 shadow-2xl border border-indigo-500/30 flex items-start justify-between gap-3 animate-bounce-short cursor-pointer transition-all hover:scale-[1.02]"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="p-2.5 bg-indigo-600 rounded-xl text-white flex-shrink-0 animate-pulse">
          <MessageSquare className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="bg-emerald-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
              Nova Mensagem
            </span>
            <p className="text-xs font-bold text-slate-300 truncate">{toast.title}</p>
          </div>
          <p className="text-sm font-semibold text-white mt-1 leading-snug line-clamp-2">
            {toast.message}
          </p>
        </div>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }} 
        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors flex-shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}