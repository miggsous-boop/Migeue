import React, { useState } from 'react';
import { Transaction } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Calendar, 
  User, 
  ArrowRight,
  ClipboardList,
  Trash2,
  FileDown,
  X,
  Filter,
  Percent
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';

interface TransactionHistoryProps {
  transactions: Transaction[];
  onClearTransactions?: () => Promise<void>;
  currentUserRole?: 'Administrador' | 'Editor' | 'Visualizador' | null;
  onShowAlert?: (title: string, message: string, type?: 'danger' | 'warning' | 'info' | 'success') => void;
}

export default function TransactionHistory({ 
  transactions, 
  onClearTransactions,
  currentUserRole,
  onShowAlert
}: TransactionHistoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Date Period Filter states
  const [enableDateFilter, setEnableDateFilter] = useState(false);
  const [reportType, setReportType] = useState<'day' | 'month' | 'year'>('day');
  
  // Defaults
  const todayStr = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const currentYearNum = new Date().getFullYear(); // YYYY

  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [selectedYear, setSelectedYear] = useState(currentYearNum);

  // Helper date extraction
  const getTxDate = (timestamp: any): Date => {
    if (!timestamp) {
      return new Date(); // Fallback imediato para pendências de sincronização local do serverTimestamp
    }
    
    // Se for um Timestamp do Firestore real com método toDate
    if (typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // Se já for uma instância de Date
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // Se for um timestamp serializado { seconds, nanoseconds } ou { _seconds, _nanoseconds }
    if (typeof timestamp === 'object') {
      if (typeof timestamp.seconds === 'number') {
        return new Date(timestamp.seconds * 1000);
      }
      if (typeof timestamp._seconds === 'number') {
        return new Date(timestamp._seconds * 1000);
      }
    }
    
    // Fallback para strings ISO, números epoch (ms) ou representações de data estruturadas
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) {
      return d;
    }
    
    return new Date(); // Fallback final seguro
  };

  // Safe Date Formatting
  const formatDate = (timestamp: any) => {
    try {
      const date = getTxDate(timestamp);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '-';
    }
  };

  // Full interactive filter logic
  const filteredTransactions = React.useMemo(() => {
    return transactions.filter(t => {
      // 1. Text Search Filter
      const matchProduct = t.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           t.productId.toLowerCase().includes(searchTerm.toLowerCase());
      const matchUser = t.userDisplayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        t.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
      const matchReason = t.reason?.toLowerCase().includes(searchTerm.toLowerCase()) || false;
      const passText = matchProduct || matchUser || matchReason;

      if (!passText) return false;

      // 2. Date Period Filter
      if (enableDateFilter) {
        try {
          const date = getTxDate(t.timestamp);
          const y = date.getFullYear();
          const m = String(date.getMonth() + 1).padStart(2, '0');
          const d = String(date.getDate()).padStart(2, '0');

          if (reportType === 'day') {
            const comparisonStr = `${y}-${m}-${d}`;
            return comparisonStr === selectedDate;
          } else if (reportType === 'month') {
            const comparisonStr = `${y}-${m}`;
            return comparisonStr === selectedMonth;
          } else if (reportType === 'year') {
            return y === selectedYear;
          }
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [transactions, searchTerm, enableDateFilter, reportType, selectedDate, selectedMonth, selectedYear]);

  // Compute statistics for the filtered period
  const reportStats = React.useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    
    filteredTransactions.forEach(t => {
      if (t.type === 'IN') {
        entradas += t.quantityChanged;
      } else if (t.type === 'OUT') {
        saidas += Math.abs(t.quantityChanged);
      }
    });

    return {
      entradas,
      saidas,
      totalCount: filteredTransactions.length
    };
  }, [filteredTransactions]);

  // Handle PDF Export
  const handleExportPDF = () => {
    if (filteredTransactions.length === 0) {
      if (onShowAlert) {
        onShowAlert("Exportação Inválida", "Nenhuma movimentação encontrada para o período selecionado para exportar.", "warning");
      } else {
        alert("Nenhuma movimentação encontrada para o período selecionado para exportar.");
      }
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Theme Color Definitions
    const primaryColor = [15, 23, 42];  // Slate-900
    const accentColor = [37, 99, 235];   // Blue-600
    const lightBg = [248, 250, 252];     // Slate-50
    const textDark = [30, 41, 59];       // Slate-800
    const textGray = [100, 116, 139];    // Slate-500
    const borderCell = [226, 232, 240];  // Slate-200

    const margin = 15;
    let currentY = 15;

    // --- 1. HEADER ---
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(margin, currentY, 180, 28, 'F');
    doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
    doc.rect(margin, currentY, 180, 28, 'S');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('RELATÓRIO DE AUDITORIA E MOVIMENTAÇÃO DE ESTOQUE', margin + 6, currentY + 11);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text('CONTROLE DE LOGS DE ENTRADAS, SAÍDAS E AJUSTES DE INVENTÁRIO', margin + 6, currentY + 17);

    // Get filter description
    let filterDescStr = 'Todo o Histórico';
    if (enableDateFilter) {
      if (reportType === 'day') {
        const [y, m, d] = selectedDate.split('-');
        filterDescStr = `Dia: ${d}/${m}/${y}`;
      } else if (reportType === 'month') {
        const [y, m] = selectedMonth.split('-');
        filterDescStr = `Mês: ${m}/${y}`;
      } else if (reportType === 'year') {
        filterDescStr = `Ano: ${selectedYear}`;
      }
    }
    doc.setFont('Helvetica', 'bold');
    doc.text(`Período: ${filterDescStr}`, 195 - margin - 6, currentY + 17, { align: 'right' });

    currentY += 34;

    // --- 2. SUMMARY METRICS ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('RESUMO DO PERÍODO', margin, currentY);

    doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
    doc.line(margin, currentY + 2, 195 - margin, currentY + 2);
    
    currentY += 8;

    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    
    // Counter Boxes
    doc.setFont('Helvetica', 'bold');
    doc.text('Total Entradas (Produtos):', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(16, 185, 129); // emerald Green
    doc.text(`+ ${reportStats.entradas} un`, margin + 45, currentY);

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('Total Saídas (Produtos):', 110, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(239, 68, 68); // rose Red
    doc.text(`- ${reportStats.saidas} un`, 152, currentY);

    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('Registros de Logs:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(`${reportStats.totalCount} movimentações`, margin + 45, currentY);

    doc.setFont('Helvetica', 'bold');
    doc.text('Emissão do Relatório:', 110, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(new Date().toLocaleString('pt-BR'), 152, currentY);

    currentY += 10;

    // --- 3. TIMELINE TABLE ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('LANÇAMENTOS DE AUDITORIA', margin, currentY);

    currentY += 3;

    // Table Header
    doc.setFillColor(30, 41, 59); // Slate-800
    doc.rect(margin, currentY, 180, 8, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('CÓDIGO / SKU', margin + 3, currentY + 5.5);
    doc.text('PRODUTO', margin + 30, currentY + 5.5);
    doc.text('FLUXO', margin + 95, currentY + 5.5);
    doc.text('RESPONSÁVEL', margin + 120, currentY + 5.5);
    doc.text('DATA / HORA', margin + 150, currentY + 5.5);

    currentY += 8;

    // Draw Table Entries
    filteredTransactions.forEach((t, idx) => {
      // Check page height limit to create a new page if needed
      if (currentY > 265) {
        doc.addPage();
        currentY = 20;

        // Table Header on new page
        doc.setFillColor(30, 41, 59);
        doc.rect(margin, currentY, 180, 8, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text('CÓDIGO / SKU', margin + 3, currentY + 5.5);
        doc.text('PRODUTO', margin + 30, currentY + 5.5);
        doc.text('FLUXO', margin + 95, currentY + 5.5);
        doc.text('RESPONSÁVEL', margin + 120, currentY + 5.5);
        doc.text('DATA / HORA', margin + 150, currentY + 5.5);
        currentY += 8;
      }

      // Alternate row bg
      if (idx % 2 === 1) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, currentY, 180, 8.5, 'F');
      }

      // Border bottom
      doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
      doc.line(margin, currentY + 8.5, 195 - margin, currentY + 8.5);

      doc.setTextColor(textDark[0], textDark[1], textDark[2]);

      // SKU text
      doc.setFont('Courier', 'bold');
      doc.setFontSize(7);
      const skuText = t.productId.length > 14 ? `${t.productId.slice(0, 12)}..` : t.productId;
      doc.text(skuText, margin + 3, currentY + 5.5);

      // Name text
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      const prodText = t.productName.length > 34 ? `${t.productName.slice(0, 32)}...` : t.productName;
      doc.text(prodText, margin + 30, currentY + 5.5);

      // Quantity change text
      const isIncrease = t.type === 'IN';
      doc.setFont('Helvetica', 'bold');
      if (isIncrease) {
        doc.setTextColor(16, 185, 129); // green
        doc.text(`+${t.quantityChanged}`, margin + 95, currentY + 5.5);
      } else {
        doc.setTextColor(239, 68, 68); // red
        doc.text(`-${t.quantityChanged}`, margin + 95, currentY + 5.5);
      }

      // Reset text colors
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);

      // User Display
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7);
      const shortUser = t.userDisplayName.split(' ')[0] || 'Membro';
      const userText = shortUser.length > 15 ? `${shortUser.slice(0, 13)}..` : shortUser;
      doc.text(userText, margin + 120, currentY + 5.5);

      // Formatted Date
      const dateText = formatDate(t.timestamp);
      doc.text(dateText, margin + 150, currentY + 5.5);

      currentY += 8.5;
    });

    // Save download trigger
    const fileDateSuffix = enableDateFilter ? filterDescStr.replace(/\//g, '-') : 'Geral';
    doc.save(`Relatorio_Movimentacoes_Estoque_${fileDateSuffix}.pdf`);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mt-6" id="auditoria-root">
      {/* Header and Search block */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
            <ClipboardList className="w-5.5 h-5.5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-sm font-display">Histórico de Lançamentos</h3>
            <p className="text-[11px] text-slate-500 font-medium">Auditoria em tempo real de toda a equipe</p>
          </div>
        </div>

        {/* Global Controls & Search Row */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Audit Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              className="w-full bg-slate-50 text-slate-800 text-xs rounded-xl border border-slate-200 pl-8 pr-3 py-2.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
              placeholder="Buscar por produto, SKU, e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          </div>

          {/* Toggle Period Filtering */}
          <button
            onClick={() => setEnableDateFilter(!enableDateFilter)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border cursor-pointer transition-all ${
              enableDateFilter 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtro de Período {enableDateFilter ? 'Ativo' : ''}</span>
          </button>

          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl border border-blue-600 transition-all cursor-pointer shadow-xs hover:shadow-sm"
            title="Exportar PDF do período selecionado"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Exportar PDF</span>
          </button>

          {/* Clear Transactions History Button */}
          {currentUserRole === 'Administrador' && onClearTransactions && (
            <button
              onClick={onClearTransactions}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl border border-slate-200 hover:border-rose-100 transition-all cursor-pointer"
              title="Limpar todos os logs de lançamentos de forma definitiva"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-rose-500" />
              <span>Limpar Histórico</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Expandable Period Selector */}
      <AnimatePresence>
        {enableDateFilter && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-5"
          >
            <div className="p-4 bg-slate-50/70 border border-slate-100 rounded-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Filtro por:</span>
                  <div className="bg-slate-200/60 p-0.5 rounded-lg flex items-center">
                    {(['day', 'month', 'year'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setReportType(type)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                          reportType === type
                            ? 'bg-white text-slate-800 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {type === 'day' ? 'Dia' : type === 'month' ? 'Mês' : 'Ano'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Period Inputs based on Report type */}
                <div className="flex items-center gap-2">
                  {reportType === 'day' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium font-mono">Selecionar Dia:</span>
                      <input
                        type="date"
                        className="bg-white text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                      />
                    </div>
                  )}

                  {reportType === 'month' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium font-mono">Selecionar Mês:</span>
                      <input
                        type="month"
                        className="bg-white text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                      />
                    </div>
                  )}

                  {reportType === 'year' && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 font-medium font-mono">Selecionar Ano:</span>
                      <input
                        type="number"
                        min="2020"
                        max="2100"
                        className="bg-white text-slate-800 text-xs font-semibold rounded-lg border border-slate-200 px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono w-24"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value) || currentYearNum)}
                      />
                    </div>
                  )}

                  {/* Disable filter clear reset */}
                  <button
                    onClick={() => {
                      setEnableDateFilter(false);
                      setSearchTerm('');
                    }}
                    className="p-1 px-1.5 bg-slate-200/50 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
                    title="Remover filtro de datas"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Stats indicators for filtered logs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200/50">
                <div className="bg-white rounded-lg p-3 border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">Lançamentos</span>
                    <p className="text-sm font-extrabold text-slate-800 font-mono">{reportStats.totalCount}</p>
                  </div>
                  <ClipboardList className="w-4 h-4 text-blue-500 shrink-0" />
                </div>

                <div className="bg-white rounded-lg p-3 border border-emerald-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wide">Entradas registradas</span>
                    <p className="text-sm font-extrabold text-emerald-700 font-mono">+{reportStats.entradas} un</p>
                  </div>
                  <TrendingUp className="w-4 h-4 text-emerald-500 shrink-0" />
                </div>

                <div className="bg-white rounded-lg p-3 border border-rose-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wide">Saídas registradas</span>
                    <p className="text-sm font-extrabold text-rose-700 font-mono">-{reportStats.saidas} un</p>
                  </div>
                  <TrendingDown className="w-4 h-4 text-rose-500 shrink-0" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {filteredTransactions.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-xs text-slate-400 font-mono mb-1">Nenhum lançamento de auditoria encontrado.</p>
          {enableDateFilter && (
            <p className="text-[10px] text-slate-400 font-serif">Mude ou desligue o filtro de período para buscar em datas históricas.</p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="max-h-[500px] overflow-y-auto divide-y divide-slate-100 pr-1">
            {filteredTransactions.map((t, idx) => {
              const isIncrease = t.type === 'IN';
              return (
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  key={`${t.id || ''}-${idx}`}
                  className="py-4 hover:bg-slate-50/50 px-2 transition-colors rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    {/* Action Icon Indicator */}
                    <div className={`p-2 rounded-lg shrink-0 ${
                      isIncrease ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {isIncrease ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    </div>

                    {/* Operational detail lines */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-bold text-xs text-slate-800 font-mono uppercase bg-slate-100 px-1.5 py-0.5 rounded-sm">
                          {t.productId}
                        </span>
                        <h4 className="font-semibold text-xs text-slate-700">
                          {t.productName}
                        </h4>
                        {t.discountPercent !== undefined && t.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-1 font-extrabold text-[10px] text-rose-600 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-sm uppercase tracking-wider font-mono shadow-2xs">
                            <Percent className="w-3 h-3 text-rose-500 shrink-0" />
                            {t.discountPercent}% DESCONTO
                          </span>
                        )}
                      </div>

                      {/* Flows explanation */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 font-mono bg-slate-50/30 px-1 py-0.5 rounded-md inline-block">
                        <span>Qtd. Anterior: <strong className="text-slate-600">{t.previousQuantity}</strong></span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-300 animate-pulse" />
                        <span>Quantidade do fluxo: <strong className={isIncrease ? 'text-emerald-600' : 'text-rose-600'}>{isIncrease ? '+' : ''}{t.quantityChanged}</strong></span>
                        <ArrowRight className="w-2.5 h-2.5 text-slate-300 animate-pulse" />
                        <span>Estoque Atual: <strong className="text-slate-700">{t.newQuantity}</strong></span>
                      </div>

                      {/* Reason descriptor */}
                      {t.reason && (
                        <p className="text-xs text-slate-600 italic bg-gray-50/50 p-1.5 rounded border border-gray-100 border-dashed max-w-lg">
                          Motivo: {t.reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Operational audit meta */}
                  <div className="flex flex-col md:items-end justify-center shrink-0 space-y-1 md:text-right">
                    {/* Actor Details */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                      <div className="w-4 h-4 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-[9px] border">
                        {t.userDisplayName?.substring(0, 1).toUpperCase() || <User className="w-2.5 h-2.5" />}
                      </div>
                      <span className="max-w-[120px] truncate">{t.userDisplayName}</span>
                      <span className="text-[10px] text-slate-400">({t.userEmail.split('@')[0]})</span>
                    </div>

                    {/* Timestamp Details */}
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{formatDate(t.timestamp)}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
