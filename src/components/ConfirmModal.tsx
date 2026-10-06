import React from 'react';
import { AlertTriangle, Trash2, X, Check, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  details,
  confirmText = 'Yes, Proceed',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-100 text-red-600 ring-4 ring-red-50',
          btnBg: 'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-100 text-amber-600 ring-4 ring-amber-50',
          btnBg: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
        };
      case 'primary':
      default:
        return {
          icon: <HelpCircle className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-100 text-blue-600 ring-4 ring-blue-50',
          btnBg: 'bg-blue-700 hover:bg-blue-800 text-white focus:ring-blue-500',
        };
    }
  };

  const { icon, iconBg, btnBg } = getVariantStyles();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 relative animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg transition"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start space-x-4">
          <div className={`p-3 rounded-2xl flex-shrink-0 ${iconBg}`}>{icon}</div>
          <div className="flex-1 pt-1">
            <h3 className="text-base font-bold text-slate-900 leading-snug">{title}</h3>
            <p className="mt-2 text-xs text-slate-600 leading-relaxed">{message}</p>
            {details && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-700 text-xs font-mono font-medium">
                {details}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition focus:outline-none"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${btnBg}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
