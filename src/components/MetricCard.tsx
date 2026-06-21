import React from 'react';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  icon: LucideIcon;
  iconColorClass: string;
  bgColorClass: string;
}

export default function MetricCard({
  title,
  value,
  subValue,
  icon: Icon,
  iconColorClass,
  bgColorClass,
}: MetricCardProps) {
  // Determine if this is critical or standard value
  const isCritical = title.toLowerCase().includes('mínimo') || title.toLowerCase().includes('sem estoque');
  const isBRLValue = typeof value === 'string' && value.includes('R$');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
    >
      <div>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">
          {title}
        </span>
        <h3 className={`text-2xl font-black mt-1 font-display tracking-tight leading-none ${
          isCritical && Number(value) > 0 
            ? 'text-rose-500' 
            : isBRLValue 
              ? 'text-blue-600' 
              : 'text-slate-800'
        }`}>
          {value}
        </h3>
      </div>
      <div className="flex items-center justify-between mt-4 pt-1">
        {subValue ? (
          <p className={`text-[11px] font-semibold ${
            isCritical && Number(value) > 0 ? 'text-rose-450' : 'text-slate-500'
          }`}>
            {title.toLowerCase().includes('mínimo') && Number(value) > 0 ? '⚠️ Lote crítico' : subValue}
          </p>
        ) : (
          <div />
        )}
        <div className={`p-2 rounded-xl border ${
          isCritical && Number(value) > 0 
            ? 'bg-rose-50 border-rose-100 text-rose-500' 
            : 'bg-slate-50 border-slate-100 text-slate-500'
        }`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
}
