import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

interface CustomNotificationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info' | 'success';
  confirmLabel?: string;
  cancelLabel?: string;
  isAlertOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function CustomNotificationModal({
  isOpen,
  title,
  message,
  type = 'info',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  isAlertOnly = false,
  onConfirm,
  onCancel,
}: CustomNotificationModalProps) {
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const icons = {
    danger: <AlertTriangle className="w-6 h-6 text-rose-600" />,
    warning: <AlertTriangle className="w-6 h-6 text-amber-500" />,
    info: <Info className="w-6 h-6 text-blue-500" />,
    success: <CheckCircle2 className="w-6 h-6 text-emerald-500" />
  };

  const colors = {
    danger: {
      border: 'border-rose-100',
      bgLight: 'bg-rose-50',
      button: 'bg-rose-600 hover:bg-rose-700 focus:ring-rose-500 text-white',
    },
    warning: {
      border: 'border-amber-100',
      bgLight: 'bg-amber-50',
      button: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400 text-white',
    },
    info: {
      border: 'border-blue-100',
      bgLight: 'bg-blue-50',
      button: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white',
    },
    success: {
      border: 'border-emerald-100',
      bgLight: 'bg-emerald-50',
      button: 'bg-emerald-600 hover:bg-emerald-700 focus:ring-emerald-500 text-white',
    }
  };

  const scheme = colors[type];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop animates */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
          />

          {/* Modal box animates */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.35 }}
            className={`relative w-full max-w-md bg-white rounded-2xl shadow-xl border ${scheme.border} overflow-hidden z-10`}
          >
            {/* Header / Accent Bar */}
            <div className={`p-5 flex items-start gap-4 ${scheme.bgLight}`}>
              <div className="p-2 rounded-xl bg-white shadow-xs shrink-0">
                {icons[type]}
              </div>
              <div className="space-y-1 pr-6">
                <h3 className="text-sm font-black text-slate-950 tracking-tight font-display">
                  {title}
                </h3>
                <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                  {message}
                </p>
              </div>

              <button
                onClick={onCancel}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100/80 transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Actions Footer */}
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
              {!isAlertOnly && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:border-slate-300 rounded-xl shadow-xs transition-all cursor-pointer font-sans"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                onClick={onConfirm}
                className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer font-sans focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${scheme.button}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
