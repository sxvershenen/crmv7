import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface ToastProps {
  message: string | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="fixed top-6 right-6 z-[120] animate-in fade-in slide-in-from-top-4 duration-200">
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-[#18191b] text-white text-[13px] font-medium shadow-xl">
        <CheckCircle2 className="w-4 h-4 text-[#2B9E47]" />
        <span>{message}</span>
      </div>
    </div>
  );
};
