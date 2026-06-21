import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { X, HelpCircle, AlertCircle, Upload, Trash2, Sparkles, Plus, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface KitFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: Partial<Product> & { initialStock?: number }) => Promise<void>;
  product?: Product | null;
  products: Product[]; // List of all products to choose components from
}

export default function KitFormModal({
  isOpen,
  onClose,
  onSubmit,
  product,
  products,
}: KitFormModalProps) {
  const isEdit = !!product;

  const [id, setId] = useState('');
  const [autoSku, setAutoSku] = useState(true);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Kits');
  const [quantity, setQuantity] = useState<number>(0);
  const [minQuantity, setMinQuantity] = useState<number>(5);
  const [price, setPrice] = useState<number>(0.0);
  const [resalePrice, setResalePrice] = useState<number>(0.0);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [imageCompressing, setImageCompressing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Kit Items state
  const [kitItems, setKitItems] = useState<{ productId: string; quantityNeeded: number; productName: string }[]>([]);
  const [selectedCompId, setSelectedCompId] = useState('');
  const [compQty, setCompQty] = useState<number>(1);
  const [compSearchTerm, setCompSearchTerm] = useState('');

  useEffect(() => {
    if (isEdit && product) {
      setId(product.id || '');
      setAutoSku(false);
      setName(product.name || '');
      setCategory(product.category || 'Kits');
      setQuantity(product.quantity || 0);
      setMinQuantity(product.minQuantity || 5);
      setPrice(product.price || 0.0);
      setResalePrice(product.resalePrice || 0.0);
      setLocation(product.location || '');
      setDescription(product.description || '');
      setImageUrl(product.imageUrl || '');
      setKitItems(product.kitItems || []);
    } else {
      setId('');
      setAutoSku(true);
      setName('');
      setCategory('Kits');
      setQuantity(0);
      setMinQuantity(5);
      setPrice(0.0);
      setResalePrice(0.0);
      setLocation('');
      setDescription('');
      setImageUrl('');
      setKitItems([]);
    }
    setErrorMsg('');
    setLoading(false);
    setSelectedCompId('');
    setCompQty(1);
    setCompSearchTerm('');
  }, [product, isEdit, isOpen]);

  // Handle sku auto-generation
  const generateRandomSku = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'KIT-';
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

  // Read files as base64 raw data URL for 100% full visual image quality as requested
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
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

  // Add component to Active list
  const handleAddComponent = () => {
    if (!selectedCompId) {
      setErrorMsg('Selecione um componente para adicionar.');
      return;
    }
    const foundProd = products.find(p => p.id === selectedCompId);
    if (!foundProd) return;

    if (compQty <= 0) {
      setErrorMsg('A quantidade do componente deve ser maior do que zero.');
      return;
    }

    // Check if duplicate
    const exists = kitItems.find(item => item.productId === selectedCompId);
    if (exists) {
      setErrorMsg('Este componente já está inserido no kit.');
      return;
    }

    setKitItems([
      ...kitItems,
      {
        productId: foundProd.id,
        productName: foundProd.name,
        quantityNeeded: compQty,
      }
    ]);

    setSelectedCompId('');
    setCompQty(1);
    setCompSearchTerm('');
    setErrorMsg('');
  };

  // Remove component helper
  const handleRemoveComponent = (productId: string) => {
    setKitItems(kitItems.filter(item => item.productId !== productId));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const sanitizedId = id.trim().replace(/\s+/g, '-').toUpperCase();
    const cleanName = name.trim();
    const finalCategory = category.trim() || 'Kits';

    if (!sanitizedId.match(/^[A-Z0-9_\-]+$/)) {
      setErrorMsg('O SKU digitado contém caracteres inválidos. Use somente letras, números, hífen ou sublinha.');
      setLoading(false);
      return;
    }

    if (!cleanName) {
      setErrorMsg('Por favor, determine o nome do kit.');
      setLoading(false);
      return;
    }

    if (minQuantity < 0) {
      setErrorMsg('O nível mínimo de alerta não pode ser negativo.');
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

    if (kitItems.length === 0) {
      setErrorMsg('Um kit necessita de pelo menos um componente inserido.');
      setLoading(false);
      return;
    }

    try {
      await onSubmit({
        id: sanitizedId,
        name: cleanName,
        category: finalCategory,
        quantity: isEdit ? quantity : 0,
        initialStock: isEdit ? undefined : quantity,
        minQuantity,
        price,
        resalePrice,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        isKit: true,
        kitItems,
      });
      onClose();
    } catch (err: any) {
      console.error(err);
      let parsedError = 'Ocorreu um erro ao salvar o kit composto.';
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

  // Filter components search
  const filteredComponents = products.filter(p => {
    // Cannot add current self when editing or another kit recursively
    if (p.isKit) return false;
    if (p.id === id) return false;

    const query = compSearchTerm.toLowerCase();
    return p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query));
  });

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
            <h3 className="font-bold text-slate-800 text-base font-display flex items-center gap-1.5">
              <Layers className="w-5 h-5 text-blue-600 animate-pulse" />
              {isEdit ? 'Editar Kit Composto' : 'Cadastrar Novo Kit'}
            </h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-650 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 max-h-[85vh]">
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
                Código SKU / Barras do Kit
              </label>
              {!isEdit ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 bg-slate-50 text-slate-800 text-sm font-semibold rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase font-mono placeholder:lowercase"
                      value={id}
                      onChange={(e) => setId(e.target.value.toUpperCase())}
                      placeholder="Ex: KIT-BIKE-PRO"
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
                      Código SKU gerado automaticamente via algoritmos de kits.
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
                Nome do Kit
              </label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Bicicleta Completa Sport"
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
                placeholder="Ex: Kits, Combos, Alimentos..."
              />
            </div>

            {/* COMPOSIÇÃO DO KIT COMPONENT BUILDER */}
            <div className="bg-blue-50/40 border border-blue-150 p-4 rounded-xl space-y-3.5">
              <span className="block text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Componentes / Peças do Kit
              </span>

              <div className="space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1">
                      Filtrar Componentes (Pesquisa)
                    </label>
                    <input
                      type="text"
                      className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2.5 py-1.5 focus:border-blue-500 outline-hidden"
                      placeholder="Buscar por SKU ou Nome..."
                      value={compSearchTerm}
                      onChange={(e) => setCompSearchTerm(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1">
                      Selecione o Componente
                    </label>
                    <select
                      className="w-full bg-white text-slate-800 text-xs rounded-lg border border-slate-200 px-2 py-1.5 focus:border-blue-500 outline-hidden"
                      value={selectedCompId}
                      onChange={(e) => setSelectedCompId(e.target.value)}
                    >
                      <option value="">-- Selecione uma peça --</option>
                      {filteredComponents.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.id}) [Estoque: {p.quantity}]
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex gap-2 items-end">
                  <div className="w-1/3">
                    <label className="block text-[10px] font-bold text-slate-450 uppercase tracking-widest mb-1">
                      Quantidade Necessária
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-white text-slate-800 text-xs font-bold rounded-lg border border-slate-200 px-3 py-1.5 focus:border-blue-500 outline-hidden text-center"
                      value={compQty}
                      onChange={(e) => setCompQty(Math.max(1, parseInt(e.target.value) || 1))}
                    />
                  </div>

                  <div className="flex-1">
                    <button
                      type="button"
                      onClick={handleAddComponent}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Incluir Peça
                    </button>
                  </div>
                </div>
              </div>

              {/* Added items list */}
              {kitItems.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic text-center py-2 bg-white/50 border border-dashed border-blue-100 rounded-lg">
                  Nenhuma peça/produto inserido na composição deste kit.
                </p>
              ) : (
                <div className="bg-white border border-slate-150 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
                  {kitItems.map((item) => (
                    <div key={item.productId} className="flex items-center justify-between p-2 text-xs">
                      <div className="space-y-0.5">
                        <p className="font-bold text-slate-700">{item.productName}</p>
                        <p className="font-mono text-[9px] text-slate-400">SKU: {item.productId} • Necessário: {item.quantityNeeded} un.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveComponent(item.productId)}
                        className="text-rose-500 hover:text-rose-700 p-1 hover:bg-slate-50 rounded-full transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quantidade e Nível Mínimo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quantidade */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide">
                  {isEdit ? 'Quantidade Atual do Kit' : 'Estoque Inicial do Kit'}
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
                  disabled={isEdit}
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
                  <span>Preço de Venda do Kit (R$)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  className="w-full bg-slate-50 text-slate-800 text-sm rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-mono font-semibold text-blue-600 animate-pulse"
                  value={price}
                  onChange={(e) => setPrice(Math.max(0.0, parseFloat(e.target.value) || 0))}
                  placeholder="0,00"
                />
              </div>

              {/* Preço de Revenda */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wide flex items-center justify-between">
                  <span>Preço de Revenda do Kit (R$)</span>
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
                placeholder="Ex: Corredor K, Prateleira 2A"
              />
            </div>

            {/* Descrição do Kit */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">
                Descrição do Kit
              </label>
              <textarea
                className="w-full bg-slate-50 text-slate-800 text-xs rounded-lg border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Kit Bicicleta Sport contendo quadro de liga leve, aros, guidão e pneus de alto desempenho..."
              />
            </div>

            {/* Drag & Drop Photo Upload */}
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-500 mb-1 uppercase tracking-wide">
                Foto do Kit (Upload direto de arquivo)
              </label>
              <div
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50/50'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                {imageUrl ? (
                  <div className="space-y-3 flex flex-col items-center">
                    <img
                      src={imageUrl}
                      alt="Preview do kit"
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 object-cover rounded-xl border border-slate-200 shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-[10px] text-rose-500 hover:text-rose-600 font-bold bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      Remover foto do kit
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 flex flex-col items-center">
                    <div className="p-3 bg-white rounded-full border border-slate-100 shadow-2xs">
                      <Upload className="w-5 h-5 text-slate-450" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-700">Arrastar & Soltar arquivo de imagem</p>
                      <p className="text-[10px] text-slate-400 font-medium">Ou clique abaixo para selecionar pelo seletor de arquivos</p>
                    </div>
                    <div>
                      <input
                        type="file"
                        id="kit-file-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileChange}
                      />
                      <label
                        htmlFor="kit-file-upload"
                        className="inline-block bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-800 px-3.5 py-2 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-all active:scale-97"
                      >
                        Escolher Arquivo do Disco
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500">
                Fotos grandes são mantidas com qualidade original integral no armazenamento interno do aparelho.
              </div>
            </div>

            {/* Save Actions Button */}
            <div className="flex gap-3 pt-4 border-t border-slate-100 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-500 cursor-pointer"
              >
                Voltar / Cancelar
              </button>
              <button
                type="submit"
                disabled={loading || imageCompressing}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shrink-0 cursor-pointer disabled:opacity-40 select-none shadow-md shadow-blue-500/10 flex items-center gap-1.5"
              >
                {loading ? 'Gravando dados...' : isEdit ? 'Salvar Edição' : 'Concluir Cadastro'}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
