import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, TrendingUp, TrendingDown, RefreshCw, AlertTriangle, Percent } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    productId: string, 
    type: 'IN' | 'OUT' | 'ADJUST', 
    quantityChanged: number, 
    reason: string,
    discountData?: { discountPercent: number; originalPrice: number; discountedPrice: number }
  ) => Promise<void>;
  product: Product | null;
  defaultType?: 'IN' | 'OUT' | 'ADJUST';
}

const IN_REASONS = [
  'Compra / Reposição de Lote',
  'Devolução de Cliente',
  'Retorno de Consumo Interno',
  'Ajuste Físico (Inventário)',
  'Outros',
];

const OUT_REASONS = [
  'Venda / Despacho de Pedido',
  'Uso Interno / Consumo da Equipe',
  'Avaria / Danificado / Vencido',
  'Devolução para Fornecedor',
  'Ajuste Físico (Inventário)',
  'Perda / Extravio',
  'Outros',
];

export default function TransactionModal({
  isOpen,
  onClose,
  onSubmit,
  product,
  defaultType = 'IN',
}: TransactionModalProps) {
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>(defaultType);
  const [quantity, setQuantity] = useState<number>(1);
  const [reasonCategory, setReasonCategory] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Discount options states
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [selectedBasePriceType, setSelectedBasePriceType] = useState<'venda' | 'revenda'>('venda');
  const [discountedPriceInput, setDiscountedPriceInput] = useState<string>('');

  useEffect(() => {
    setType(defaultType);
    setQuantity(1);
    
    const initialReasons = defaultType === 'IN' ? IN_REASONS : OUT_REASONS;
    setReasonCategory(initialReasons[0]);
    setCustomReason('');
    setErrorMsg('');
    setLoading(false);

    setApplyDiscount(false);
    setSelectedBasePriceType('venda');
    setDiscountedPriceInput('');
  }, [product, isOpen, defaultType]);

  const basePrice = selectedBasePriceType === 'venda'
    ? (product?.price || 0)
    : (product?.resalePrice || product?.price || 0);

  useEffect(() => {
    if (product) {
      setDiscountedPriceInput(basePrice.toString());
    }
  }, [selectedBasePriceType, product]);

  if (!product) return null;

  // Adjust default selection when switching Type
  const handleTypeChange = (newType: 'IN' | 'OUT' | 'ADJUST') => {
    setType(newType);
    const presetOptions = newType === 'IN' ? IN_REASONS : OUT_REASONS;
    setReasonCategory(presetOptions[0]);
  };

  // Live calculation of expected stock post-operation
  const currentQty = product.quantity || 0;
  let finalQty = currentQty;

  if (type === 'IN') {
    finalQty = currentQty + quantity;
  } else if (type === 'OUT') {
    finalQty = Math.max(0, currentQty - quantity);
  } else if (type === 'ADJUST') {
    finalQty = quantity;
  }

  const handleTransactionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (quantity <= 0 && type !== 'ADJUST') {
      setErrorMsg('A quantidade movimentada deve ser maior que zero.');
      setLoading(false);
      return;
    }

    if (type === 'OUT' && currentQty < quantity) {
      setErrorMsg(`Estoque insuficiente! Você está tentando dar saída em ${quantity} unidades, mas existem apenas ${currentQty} disponíveis.`);
      setLoading(false);
      return;
    }

    let discountData: { discountPercent: number; originalPrice: number; discountedPrice: number } | undefined = undefined;
    let extraReason = '';

    if (type === 'OUT' && applyDiscount) {
      const discountedPriceVal = parseFloat(discountedPriceInput) || 0;
      if (discountedPriceVal <= 0) {
        setErrorMsg('O preço final com desconto deve ser maior que zero.');
        setLoading(false);
        return;
      }
      if (discountedPriceVal > basePrice) {
        setErrorMsg('O preço final com desconto não pode ser maior que o preço de referência original.');
        setLoading(false);
        return;
      }

      const diff = basePrice - discountedPriceVal;
      const pct = basePrice > 0 ? (diff / basePrice) * 100 : 0;
      const discountPercent = Math.max(0, parseFloat(pct.toFixed(2)));

      discountData = {
        discountPercent,
        originalPrice: basePrice,
        discountedPrice: discountedPriceVal
      };

      if (discountPercent > 0) {
        extraReason = ` [Desconto de ${discountPercent}% de R$ ${basePrice.toFixed(2)} por R$ ${discountedPriceVal.toFixed(2)}]`;
      }
    }

    const baseReason = reasonCategory === 'Outros' 
      ? `Outros: ${customReason.trim()}` 
      : `${reasonCategory}${customReason.trim() ? ` (${customReason.trim()})` : ''}`;

    const finalReason = baseReason.trim() + extraReason;

    if (!baseReason.trim()) {
      setErrorMsg('Por favor, descreva ou selecione o motivo da movimentação.');
      setLoading(false);
      return;
    }

    try {
      await onSubmit(
        product.id, 
        type, 
        type === 'ADJUST' ? quantity - currentQty : quantity, 
        finalReason,
        discountData
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      let parsedError = 'Erro ao realizar o lançamento.';
      try {
        const jsonErr = JSON.parse(err.message);
        if (jsonErr && jsonErr.error) {
          parsedError = `Erro administrativo: ${jsonErr.error}`;
        }
      } catch {
        parsedError = err.message || parsedError;
      }
      setErrorMsg(parsedError);
    } finally {
      setLoading(false);
    }
  };

  const reasonList = type === 'IN' ? IN_REASONS : OUT_REASONS;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col"
        >
          {/* Header */}
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 text-sm font-display">
                Lançar Movimentação de Estoque
              </h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Ref: {product.name} ({product.id})
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-650 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleTransactionSubmit} className="p-6 space-y-4">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg flex items-start gap-2.5 text-xs font-medium"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* Selector Slider Tab */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => handleTypeChange('IN')}
                translate="no"
                className={`py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer notranslate ${
                  type === 'IN'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-650 hover:text-slate-800 hover:bg-white/30'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                Entrada (+)
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('OUT')}
                translate="no"
                className={`py-2 text-xs font-bold rounded-md flex items-center justify-center gap-1.5 transition-all cursor-pointer notranslate ${
                  type === 'OUT'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-650 hover:text-slate-800 hover:bg-white/30'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                Saída (-)
              </button>
            </div>

            {/* Stock Calc Preview Grid */}
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-xl grid grid-cols-3 gap-2 text-center divide-x divide-slate-100">
              <div>
                <span className="text-[10px] text-slate-450 uppercase font-bold">Inicial</span>
                <p className="text-sm font-bold text-slate-600 font-mono mt-0.5">{currentQty}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-455 uppercase font-bold">Mudança</span>
                <p className={`text-sm font-bold font-mono mt-0.5 ${
                  type === 'IN' ? 'text-blue-600' : 'text-rose-600'
                }`}>
                  {type === 'IN' ? '+' : '-'}{quantity}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-slate-450 uppercase font-bold">Esperado</span>
                <p className="text-sm font-bold text-slate-800 font-mono mt-0.5">{finalQty}</p>
              </div>
            </div>

            {/* Quantity Input */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Quantidade das Unidades
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                className="w-full bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            {/* Discount Option Section (OUT only) */}
            {type === 'OUT' && (
              <div className="bg-slate-50 border border-slate-150 p-3.5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Percent className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                    Aplicar Desconto?
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={applyDiscount}
                      onChange={(e) => setApplyDiscount(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-500"></div>
                  </label>
                </div>

                {applyDiscount && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 pt-2 border-t border-slate-200/60 overflow-hidden"
                  >
                    {/* Choose base price type: Venda vs Revenda */}
                    <div>
                      <span className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">
                        Preço de Referência
                      </span>
                      <div className="grid grid-cols-2 gap-2 bg-slate-200/55 p-0.5 rounded-lg">
                        <button
                          type="button"
                          onClick={() => setSelectedBasePriceType('venda')}
                          className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            selectedBasePriceType === 'venda'
                              ? 'bg-white text-slate-800 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Venda (R$ {product.price.toFixed(2)})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedBasePriceType('revenda')}
                          className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                            selectedBasePriceType === 'revenda'
                              ? 'bg-white text-slate-800 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          Revenda (R$ {(product.resalePrice || 0).toFixed(2)})
                        </button>
                      </div>
                    </div>

                    {/* Final price with discount */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider mb-1.5">
                        Valor Unitário já com o Desconto (R$)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required={applyDiscount}
                        className="w-full bg-white text-slate-800 text-sm font-semibold rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-mono text-center text-rose-600 block"
                        value={discountedPriceInput}
                        onChange={(e) => setDiscountedPriceInput(e.target.value)}
                        placeholder="Ex: 35.00"
                      />
                    </div>

                    {/* Resulting calculations live info */}
                    <div className="p-2.5 bg-rose-50 border border-rose-100 rounded-lg flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">Resultado do Desconto</span>
                      
                      {(() => {
                        const discVal = parseFloat(discountedPriceInput) || 0;
                        const diff = basePrice - discVal;
                        const pctOfDiscount = basePrice > 0 && discVal < basePrice
                          ? (((basePrice - discVal) / basePrice) * 100)
                          : 0;
                        const totalSave = diff * quantity;

                        return (
                          <div className="mt-1">
                            <p className="text-sm font-black text-rose-600">
                              {pctOfDiscount > 0 ? `${pctOfDiscount.toFixed(2)}% de desconto` : '0.00% de desconto'}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              Preço original: R$ {basePrice.toFixed(2)} → Preço final: R$ {discVal.toFixed(2)}
                            </p>
                            {quantity > 1 && totalSave > 0 && (
                              <p className="text-[9px] text-rose-500 font-bold mt-1 uppercase">
                                Redução total de R$ {totalSave.toFixed(2)} no lote!
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* Reason Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Motivo da Operação
              </label>
              <select
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={reasonCategory}
                onChange={(e) => setReasonCategory(e.target.value)}
              >
                {reasonList.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Description Text */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Informações Complementares (Opcional)
              </label>
              <textarea
                rows={2}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Ex: Nota fiscal Nº 481, Pedido do cliente João Silva, reposição ordinária, etc."
              />
            </div>

            {/* Footer Buttons */}
            <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-transparent hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                disabled={loading}
              >
                Voltar
              </button>
              <button
                type="submit"
                className={`px-5 py-2 text-xs font-bold text-white rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${
                  type === 'IN' 
                    ? 'bg-blue-600 hover:bg-blue-700/90 shadow-blue-500/10' 
                    : 'bg-rose-600 hover:bg-rose-700/90 shadow-rose-500/10'
                }`}
                disabled={loading}
              >
                {loading ? 'Processando...' : 'Confirmar Lançamento'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
