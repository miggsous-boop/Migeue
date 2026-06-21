import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { Product } from '../types';
import { Layers, AlertCircle } from 'lucide-react';

interface InventoryChartsProps {
  products: Product[];
}

const COLORS = {
  emEstoque: '#10b981', // green-500
  alerta: '#f59e0b',    // yellow-500
  esgotado: '#ef4444',  // red-500
};

export default function InventoryCharts({ products }: InventoryChartsProps) {
  // Compute category chart data
  const categoryData = React.useMemo(() => {
    const map: { [key: string]: { name: string; totalStock: number; value: number } } = {};
    products.forEach((p) => {
      const cat = p.category || 'Sem Categoria';
      if (!map[cat]) {
        map[cat] = { name: cat, totalStock: 0, value: 0 };
      }
      map[cat].totalStock += p.quantity;
      map[cat].value += p.quantity * p.price;
    });

    return Object.values(map)
      .sort((a, b) => b.totalStock - a.totalStock)
      .slice(0, 5); // Show top 5
  }, [products]);

  // Compute status levels pie chart data
  const statusData = React.useMemo(() => {
    let outOfStock = 0;
    let lowStock = 0;
    let normalStock = 0;

    products.forEach((p) => {
      if (p.quantity === 0) {
        outOfStock++;
      } else if (p.quantity <= p.minQuantity) {
        lowStock++;
      } else {
        normalStock++;
      }
    });

    return [
      { name: 'Em Estoque', value: normalStock, color: COLORS.emEstoque },
      { name: 'Nível Crítico', value: lowStock, color: COLORS.alerta },
      { name: 'Sem Estoque', value: outOfStock, color: COLORS.esgotado },
    ].filter((item) => item.value > 0);
  }, [products]);

  if (products.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      {/* Category volume bar chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
          <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
            <Layers className="w-4.5 h-4.5" />
          </div>
          <h4 className="text-sm font-bold text-slate-850 font-display">
            Top Categorias por Quantidade
          </h4>
        </div>
        <div className="h-64 w-full">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    fontSize: '12px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                  }}
                  formatter={(value: any) => [`${value} un`, 'Quantidade']}
                />
                <Bar dataKey="totalStock" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Nenhuma movimentação registrada nas categorias.
            </div>
          )}
        </div>
      </div>

      {/* Stock level status pie chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-slate-100">
          <div className="p-1.5 bg-blue-50 rounded-lg text-blue-600">
            <AlertCircle className="w-4.5 h-4.5" />
          </div>
          <h4 className="text-sm font-bold text-slate-850 font-display">
            Status dos Níveis de Alerta
          </h4>
        </div>
        <div className="h-64 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
          {statusData.length > 0 ? (
            <>
              <div className="w-44 h-44 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #f1f5f9',
                        borderRadius: '8px',
                        fontSize: '11px',
                      }}
                      formatter={(value: any) => [`${value} produto(s)`, 'Quantidade']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-2xl font-bold text-slate-800">
                    {products.length}
                  </span>
                  <span className="text-[10px] text-slate-400 uppercase font-medium tracking-wider">
                    Total
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {statusData.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="font-medium text-slate-600">{item.name}:</span>
                    <span className="text-slate-500 font-mono">
                      {item.value} ({Math.round((item.value / products.length) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 w-full">
              Consolide produtos para analisar alertas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
