import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, HelpCircle, AlertCircle, Upload, Trash2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: Partial<Product> & { initialStock?: number }) => Promise<void>;
  product?: Product | null; // If editing, we pass it
}

const PRESET_CATEGORIES = [
  'Alimentos',
  'Eletrônicos',
  'Fardamento & EPI',
  'Escritório',
  'Ferramentas',
  'Limpeza',
  'Embalagens',
  'Outros',
];

export default function ProductFormModal({
  isOpen,
  onClose,
  onSubmit,
  product,
}: ProductFormModalProps) {
  const isEdit = !!product;

  const [id, setId] = useState('');
  const [autoSku, setAutoSku] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState<number>(0);
  const [minQuantity, setMinQuantity] = useState<number>(5);
  const [price, setPrice] = useState<number>(0.0);
  const [resalePrice, setResalePrice] = useState<number>(0.0);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [brand, setBrand] = useState('');
  const [packaging, setPackaging] = useState('UN');
  const [dragActive, setDragActive] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isEdit && product) {
      setId(product.id || '');
      setAutoSku(false);
      setName(product.name || '');
      setCategory(product.category || '');
      setQuantity(product.quantity || 0);
      setMinQuantity(product.minQuantity || 0);
      setPrice(product.price || 0.0);
      setResalePrice(product.resalePrice || 0.0);
      setLocation(product.location || '');
      setDescription(product.description || '');
      setImageUrl(product.imageUrl || '');
      setBrand(product.brand || '');
      setPackaging(product.packaging || 'UN');
    } else {
      // Clear data for new creation
      setId('');
      setAutoSku(true);
      setName('');
      setCategory('');
      setQuantity(0);
      setMinQuantity(5);
      setPrice(0.0);
      setResalePrice(0.0);
      setLocation('');
      setDescription('');
      setImageUrl('');
      setBrand('');
      setPackaging('UN');
    }
    setErrorMsg('');
    setLoading(false);
  }, [product, isEdit, isOpen]);

  // Handle sku auto-generation
  const generateRandomSku = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'SKU-';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setId(result);
  };

  useEffect(() => {
    if (autoSku && !isEdit) {
      generateRandomSku();
    }
  }, [autoSku, isEdit, isOpen]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    setImageCompressing(true);
    setErrorMsg('');

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
      setImageCompressing(false);
    };

    reader.onerror = () => {
      setErrorMsg('Erro ao carregar o arquivo.');
      setImageCompressing(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Strict SKU Sanitization
    const sanitizedId = id.trim().toUpperCase();
    const cleanName = name.trim();
    const finalCategory = category.trim();

    // Checks
    if (!sanitizedId) {
      setErrorMsg('O código SKU é obrigatório.');
      setLoading(false);
      return;
    }

    const skuRegex = /^[A-Z0-9_\-]+$/;
    if (!skuRegex.test(sanitizedId)) {
      setErrorMsg('O SKU só pode conter letras, números, hífen e sublinha (sem espaços ou acentos).');
      setLoading(false);
      return;
    }

    if (!cleanName) {
      setErrorMsg('O nome do produto é obrigatório.');
      setLoading(false);
      return;
    }

    if (!finalCategory) {
      setErrorMsg('Por favor, especifique uma categoria.');
      setLoading(false);
      return;
    }

    if (quantity < 0) {
      setErrorMsg('A quantidade não pode ser negativa.');
      setLoading(false);
      return;
    }

    if (minQuantity < 0) {
      setErrorMsg('A quantidade mínima não pode ser negativa.');
      setLoading(false);
      return;
    }

    if (price < 0) {
      setErrorMsg('O preço de venda não pode ser negativo.');
      setLoading(false);
      return;
    }

    if (resalePrice < 0) {
      setErrorMsg('O preço de revenda não pode ser negativo.');
      setLoading(false);
      return;
    }

    try {
      await onSubmit({
        id: sanitizedId,
        name: cleanName,
        category: finalCategory,
        quantity: isEdit ? quantity : 0, // In creation, starting quantity goes via transaction if specified
        initialStock: isEdit ? undefined : quantity, // Special hook for initial transaction
        minQuantity,
        price,
        resalePrice,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        brand: brand.trim() || undefined,
        packaging: packaging || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      let parsedError = 'Ocorreu um erro ao salvar o produto.';
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 flex flex-col"
        >
          {/* Modal Header */}
          <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-base font-display">
              {isEdit ? 'Editar Produto' : 'Cadastrar Novo Produto'}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-650 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[80vh]">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg flex items-start gap-2.5 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}

            {/* SKU Input */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Código SKU / Código de Barras
              </label>
              {!isEdit ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase font-mono placeholder:lowercase"
                      value={id}
                      onChange={(e) => setId(e.target.value.toUpperCase())}
                      placeholder="Ex: ELEC-NOT-001"
                      disabled={autoSku}
                    />
                    <button
                      type="button"
                      onClick={() => setAutoSku(!autoSku)}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        autoSku
                          ? 'bg-blue-50 text-blue-750 border-blue-200 cursor-pointer'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 cursor-pointer'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Auto-Gerar
                    </button>
                  </div>
                  {autoSku ? (
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <HelpCircle className="w-3 h-3 text-blue-500" />
                      Código SKU gerado automaticamente via algoritmos de estoque.
                    </p>
                  ) : (
                    <p className="text-[10px] text-amber-500 font-medium">
                      Use somente letras maiúsculas, números, hífen e sublinha. Sem espaços.
                    </p>
                  )}
                </div>
              ) : (
                <input
                  type="text"
                  className="w-full bg-slate-100 text-slate-500 text-sm font-semibold rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase"
                  value={id}
                  disabled
                />
              )}
            </div>

            {/* Product Name */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Nome do Produto
              </label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Notebook Pro 15'' 16GB"
              />
            </div>

            {/* Categoria escrita do zero */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Categoria
              </label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ex: Alimentos, Limpeza, Peças, Elétrica, Escritório..."
              />
            </div>

            {/* Quantidade e Nível Mínimo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantidade */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  {isEdit ? 'Quantidade Atual' : 'Estoque Inicial'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  className={`w-full text-slate-800 text-sm rounded-lg border px-3 py-2 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                    isEdit
                      ? 'bg-slate-100 text-slate-500 border-slate-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                  disabled={isEdit} // Edit quantity ONLY via "Entrada/Saída" to preserve audit ledger trails!
                />
                {isEdit && (
                  <p className="text-[9px] text-slate-400 mt-1">
                    Alteração de quantidade via lançamentos de Entrada/Saída na listagem.
                  </p>
                )}
              </div>

              {/* Min Alerta */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Nível de Alerta Mín.
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                />
              </div>
            </div>

            {/* Preços Diferenciados (Venda vs Revenda) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Preço de Venda */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide flex items-center justify-between">
                  <span>Preço de Venda (R$)</span>
                  <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded">Venda / Varejo</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-semibold"
                  value={price}
                  onChange={(e) => setPrice(Math.max(0.0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                />
              </div>

              {/* Preço de Revenda */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide flex items-center justify-between">
                  <span>Preço de Revenda (R$)</span>
                  <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded">Revenda / Atacado</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-semibold"
                  value={resalePrice}
                  onChange={(e) => setResalePrice(Math.max(0.0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                />
              </div>
            </div>

            {/* Warehouse Location */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Setor / Prateleira (Localização no Galpão)
              </label>
              <input
                type="text"
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Corredor A, Prateleira 4B"
              />
            </div>

            {/* MARCA E EMBALAGEM SIDE-BY-SIDE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Marca
                </label>
                <input
                  type="text"
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Royal, Bison, Importado"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  Tipo de Embalagem
                </label>
                <select
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
                  value={packaging}
                  onChange={(e) => setPackaging(e.target.value)}
                >
                  <option value="UN">Unidade (UN)</option>
                  <option value="KIT">Kit (KIT)</option>
                  <option value="PAR">Par (PAR)</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                Descrição do Item
              </label>
              <textarea
                rows={2}
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-sans"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes adicionais, fornecedor ou especificações técnicas"
              />
            </div>

            {/* Imagem do Produto */}
            <div className="space-y-2.5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">
                Imagem do Produto
              </label>

              {/* Visual Preview or Upload zone */}
              <div 
                className={`relative border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] transition-all ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50/50' 
                    : imageUrl 
                      ? 'border-slate-200 bg-slate-50' 
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100/65'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {imageCompressing ? (
                  <div className="flex flex-col items-center justify-center text-blue-600 gap-2 font-bold py-6 text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-slate-700">Processando imagem em alta qualidade...</span>
                    <span className="text-[10px] text-slate-450 font-medium">Mantendo nitidez e fidelidade de cores originais</span>
                  </div>
                ) : imageUrl ? (
                  <div className="relative w-full max-w-[150px] aspect-square rounded-lg overflow-hidden shadow-xs border border-slate-200 transition-transform">
                    <img 
                      src={imageUrl} 
                      alt="Product preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="absolute top-1.5 right-1.5 p-1.5 bg-rose-600/90 text-white rounded-full hover:bg-rose-700 transition-colors shadow-sm cursor-pointer"
                      title="Deletar imagem"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-slate-650 transition-colors w-full h-full py-4 text-center">
                    <Upload className="w-8 h-8 mb-2 text-slate-400" />
                    <span className="text-xs font-bold text-slate-700">Arrastar & Soltar imagem aqui</span>
                    <span className="text-[10px] text-slate-400 font-medium mt-1">ou clique para selecionar do dispositivo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleFileChange} 
                    />
                  </label>
                )}
              </div>

              {/* Information text about image quality */}
              <div className="text-[11px] text-slate-500">
                Imagens são armazenadas em alta definição original e sem perda de qualidade direto no armazenamento do seu aparelho.
              </div>
            </div>

            {/* Form Actions */}
            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-transparent hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700/90 rounded-lg transition-all shadow-md shadow-blue-500/20 flex items-center gap-1.5 cursor-pointer"
                disabled={loading}
              >
                {loading ? 'Salvando...' : isEdit ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
