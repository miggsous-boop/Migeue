import React, { useState, useEffect } from 'react';
import { Product } from '../types';
import { jsPDF } from 'jspdf';
import { 
  ListChecks, 
  FileText, 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  MapPin, 
  AlertCircle, 
  RotateCcw, 
  Check, 
  CheckCircle2, 
  ArrowDownRight, 
  Calendar,
  User,
  Tag,
  Search,
  CheckCircle,
  FileDown,
  Users,
  Phone,
  Landmark,
  Percent,
  Layers,
  X,
  Boxes
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SeparationItem {
  product: Product;
  requestedQty: number;
  separatedQty: number;
  completed: boolean;
  basePrice: number;
  discountPercent?: number;
  discountedPrice?: number;
}

interface CompletedSeparation {
  id: string;
  orderCode: string;
  customerName: string;
  notes?: string;
  priority: 'Baixa' | 'Média' | 'Alta';
  orderType: 'atacado' | 'varejo';
  status: 'Pendente' | 'Concluído';
  items: {
    productId: string;
    productName: string;
    category: string;
    location: string;
    requestedQty: number;
    separatedQty: number;
    brand?: string;
    packaging?: string;
    price?: number;
    discountPercent?: number;
    discountedPrice?: number;
  }[];
  timestamp: string;
  operatorName: string;
  operatorEmail: string;
  deductedFromInventory: boolean;
}

interface OrderSeparationViewProps {
  products: Product[];
  user: any;
  currentUserRole?: 'Administrador' | 'Editor' | 'Visualizador' | null;
  onFirestoreError?: (err: any, op: string, path: string) => void;
  onRecordTransaction: (
    productId: string, 
    type: 'IN' | 'OUT' | 'ADJUST', 
    quantityChanged: number, 
    reason: string
  ) => Promise<any>;
  onAskConfirmation?: (options: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) => void;
  onShowAlert?: (title: string, message: string, type?: 'danger' | 'warning' | 'info' | 'success') => void;
}

export default function OrderSeparationView({
  products,
  user,
  currentUserRole,
  onRecordTransaction,
  onAskConfirmation,
  onShowAlert
}: OrderSeparationViewProps) {
  // Navigation internal tabs: "active" (nova separação), "history" (pedidos finalizados) or "clientes" (clientes cadastrados)
  const [subTab, setSubTab] = useState<'nova' | 'historico' | 'clientes'>('nova');

  // Customers states
  const [customers, setCustomers] = useState<{
    code: string;
    name: string;
    phone: string;
    cpfCnpj: string;
    fantasyName: string;
    city: string;
    neighborhood: string;
    address: string;
    activeSector: string;
  }[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cCpfCnpj, setCCpfCnpj] = useState('');
  const [cFantasyName, setCFantasyName] = useState('');
  const [cCity, setCCity] = useState('');
  const [cNeighborhood, setCNeighborhood] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cActiveSector, setCActiveSector] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerFilterQuery, setCustomerFilterQuery] = useState('');

  // Input states for building the order
  const [orderCode, setOrderCode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<'Baixa' | 'Média' | 'Alta'>('Média');
  const [orderType, setOrderType] = useState<'atacado' | 'varejo'>('varejo');

  // Product selected for addition to order
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedBasePriceType, setSelectedBasePriceType] = useState<'venda' | 'revenda'>('venda');
  const [applyDiscount, setApplyDiscount] = useState(false);
  const [discountedPriceInput, setDiscountedPriceInput] = useState('');
  const [addQty, setAddQty] = useState(1);
  const [searchProductQuery, setSearchProductQuery] = useState('');

  // Active picking/separation items queue
  const [separationItems, setSeparationItems] = useState<SeparationItem[]>([]);

  // Deduct options
  const [deductFromInventory, setDeductFromInventory] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [confirmingOrderId, setConfirmingOrderId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Local saved database of completed orders
  const [completedOrders, setCompletedOrders] = useState<CompletedSeparation[]>([]);

  // Initialize orderCode on mount
  useEffect(() => {
    if (!orderCode) {
      const dateStr = new Date().toISOString().slice(2,10).replace(/-/g, '');
      const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      setOrderCode(`SEP-${dateStr}-${rand}`);
    }
  }, [subTab]);

  // Look up selected product when selectedProductId changes
  useEffect(() => {
    const found = products.find(p => p.id === selectedProductId);
    if (found) {
      setSelectedProduct(found);
    } else {
      setSelectedProduct(null);
    }
  }, [selectedProductId, products]);

  // Synchronize base price reference selection with the order type
  useEffect(() => {
    setSelectedBasePriceType(orderType === 'atacado' ? 'revenda' : 'venda');
  }, [orderType]);

  // Synchronize discounted price input with the selected product base price
  useEffect(() => {
    if (selectedProduct) {
      const refBasePrice = selectedBasePriceType === 'venda'
        ? (selectedProduct.price || 0)
        : (selectedProduct.resalePrice || selectedProduct.price || 0);
      setDiscountedPriceInput(refBasePrice.toString());
    }
  }, [selectedBasePriceType, selectedProduct]);

  // Load completed orders and customers from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('saved_separations_v1');
      if (stored) {
        setCompletedOrders(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Erro ao ler separações salvas:', e);
    }

    try {
      const storedCust = localStorage.getItem('saved_customers_v1');
      if (storedCust) {
        setCustomers(JSON.parse(storedCust));
      }
    } catch (e) {
      console.error('Erro ao ler clientes salvos:', e);
    }
  }, []);

  // Save separation orders to localStorage helper
  const saveOrdersToLocalStorage = (list: CompletedSeparation[]) => {
    try {
      localStorage.setItem('saved_separations_v1', JSON.stringify(list));
      setCompletedOrders(list);
    } catch (e) {
      console.error('Erro ao salvar localmente:', e);
    }
  };

  // Autosearch filtered products available for adding to active separation queue
  const candidatesProducts = React.useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) || 
                            p.id.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
                            (p.category && p.category.toLowerCase().includes(searchProductQuery.toLowerCase()));
      // We list products even with 0 qty but show warning in selection if they are out of stock.
      return matchesSearch;
    });
  }, [products, searchProductQuery]);

  // Add item to active checklist
  const handleAddItem = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedProduct) {
      setErrorMessage('Selecione um produto para adicionar.');
      return;
    }

    // Check if product is already added
    const alreadyAdded = separationItems.find(item => item.product.id === selectedProduct.id);
    if (alreadyAdded) {
      setErrorMessage('Este produto já foi adicionado à lista. Ajuste a quantidade desejada diretamente na tabela abaixo.');
      return;
    }

    if (addQty <= 0) {
      setErrorMessage('A quantidade solicitada deve ser maior que zero.');
      return;
    }

    const basePrice = selectedBasePriceType === 'revenda'
      ? (selectedProduct.resalePrice || selectedProduct.price || 0)
      : (selectedProduct.price || 0);
    const finalPrice = applyDiscount ? parseFloat(discountedPriceInput) || 0 : basePrice;
    const discountPercent = basePrice > 0 ? Math.max(0, Math.min(100, ((basePrice - finalPrice) / basePrice) * 100)) : 0;

    const newItem: SeparationItem = {
      product: selectedProduct,
      requestedQty: addQty,
      separatedQty: 0,
      completed: false,
      basePrice,
      discountPercent: applyDiscount ? discountPercent : 0,
      discountedPrice: applyDiscount ? finalPrice : basePrice
    };

    setSeparationItems([...separationItems, newItem]);
    setSelectedProduct(null);
    setSelectedProductId('');
    setAddQty(1);
    setApplyDiscount(false);
    setDiscountedPriceInput('');
    setSearchProductQuery('');
    setErrorMessage('');
  };

  // Remove item from active separation checklist
  const handleRemoveItem = (id: string) => {
    setSeparationItems(separationItems.filter(item => item.product.id !== id));
  };

  // Adjust separated quantity counter
  const handleAdjustSeparatedQty = (id: string, amount: number) => {
    setSeparationItems(
      separationItems.map(item => {
        if (item.product.id === id) {
          const newQty = Math.max(0, Math.min(item.requestedQty, item.separatedQty + amount));
          return {
            ...item,
            separatedQty: newQty,
            completed: newQty === item.requestedQty
          };
        }
        return item;
      })
    );
  };

  // Set separated quantity fully to requested amount for picking ease
  const handleSetFullySeparated = (id: string) => {
    setSeparationItems(
      separationItems.map(item => {
        if (item.product.id === id) {
          return {
            ...item,
            separatedQty: item.requestedQty,
            completed: true
          };
        }
        return item;
      })
    );
  };

  // Clean all fields and reset picker
  const handleResetForm = () => {
    setSeparationItems([]);
    setCustomerName('');
    setNotes('');
    setPriority('Média');
    setOrderType('varejo');
    setSelectedProduct(null);
    setSelectedProductId('');
    setSelectedBasePriceType('venda');
    setApplyDiscount(false);
    setDiscountedPriceInput('');
    setAddQty(1);
    setSearchProductQuery('');
    setErrorMessage('');
    setSuccessMessage('');
    const dateStr = new Date().toISOString().slice(2,10).replace(/-/g, '');
    const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    setOrderCode(`SEP-${dateStr}-${rand}`);
  };

  // Check if everything is completely checked off
  const isAllSeparated = separationItems.length > 0 && separationItems.every(item => item.completed);

  // Finalize separation order
  const handleFinalizeSeparation = async () => {
    if (separationItems.length === 0) {
      setErrorMessage('A lista de itens está vazia. Adicione produtos antes de finalizar.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Por favor, informe o nome do cliente / destinatário.');
      return;
    }

    if (currentUserRole === 'Visualizador') {
      setErrorMessage('Seu perfil com permissão de "Visualizador" não tem autoridade para dar baixa automática ou gravar novos pedidos.');
      return;
    }

    setIsFinalizing(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      // 1. Archive Completed separation order as PENDENTE (Does NOT deduct stock immediately)
      const completedRecord: CompletedSeparation = {
        id: `REC-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        orderCode: orderCode.trim(),
        customerName: customerName.trim(),
        notes: notes.trim() || undefined,
        priority,
        orderType: orderType,
        status: 'Pendente',
        items: separationItems.map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          category: item.product.category,
          location: item.product.location || 'Não cadastrada',
          requestedQty: item.requestedQty,
          separatedQty: item.separatedQty,
          brand: item.product.brand || '',
          packaging: item.product.packaging || (item.product.isKit ? 'KIT' : (item.product.name.toLowerCase().includes('par') ? 'PAR' : 'UN')),
          price: item.basePrice,
          discountPercent: item.discountPercent || 0,
          discountedPrice: item.discountedPrice || item.basePrice
        })),
        timestamp: new Date().toISOString(),
        operatorName: user?.displayName || 'Membro do Time',
        operatorEmail: user?.email || '',
        deductedFromInventory: false
      };

      const updatedHistory = [completedRecord, ...completedOrders];
      saveOrdersToLocalStorage(updatedHistory);

      setSuccessMessage('Pedido gravado com sucesso como PENDENTE no histórico! Vá na aba do "Histórico de Pedidos" para fazer a confirmação de conclusão para dar baixa definitiva no estoque.');
      
      // Auto compile PDF directly immediately for the user
      generatePDFReport(completedRecord);

      // Reset local states to prepare for a new drafting
      handleResetForm();
    } catch (err: any) {
      console.error('Erro ao finalizar separação:', err);
      setErrorMessage('Erro ao salvar no banco. Verifique as credenciais ou conexão.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleConfirmCompletion = (orderId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentUserRole === 'Visualizador') {
      setErrorMessage('Seu perfil com permissão de "Visualizador" não tem autoridade para confirmar baixa.');
      return;
    }
    setConfirmingOrderId(orderId);
  };

  const handleExecuteConfirmCompletion = async (orderId: string) => {
    const order = completedOrders.find(o => o.id === orderId);
    if (!order) return;

    try {
      // Deduct from inventory
      for (const item of order.items) {
        if (item.separatedQty > 0) {
          // Register standard stock OUT transaction for separated amounts
          await onRecordTransaction(
            item.productId,
            'OUT',
            item.separatedQty,
            `Separação de pedido concluída: ${order.orderCode} (${order.customerName})`
          );
        }
      }

      // Update order status & deductedFromInventory
      const updatedOrders = completedOrders.map(o => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'Concluído' as const,
            deductedFromInventory: true
          };
        }
        return o;
      });

      saveOrdersToLocalStorage(updatedOrders);
      setConfirmingOrderId(null);
      setSuccessMessage(`Separação do pedido ${order.orderCode} consolidada e estoques atualizados com sucesso!`);
      
      // Re-trigger PDF download for the completed order
      const updatedOrder = updatedOrders.find(o => o.id === orderId);
      if (updatedOrder) {
        generatePDFReport(updatedOrder);
      }
    } catch (err: any) {
      console.error('Erro ao consolidar finalização:', err);
      setErrorMessage('Erro ao consolidar finalização do pedido. Estoque insuficiente ou erro interno.');
    }
  };

  // Helper function to generate PDF
  const generatePDFReport = (order: CompletedSeparation) => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Color definitions
    const primaryColor = [15, 23, 42]; // Slate-900 BG
    const accentColor = [37, 99, 235]; // Blue-600
    const lightBg = [248, 250, 252]; // Slate-50
    const textDark = [15, 23, 42];
    const textGray = [100, 116, 139];
    const borderCell = [226, 232, 240];

    // Page Width 210mm, Height 297mm. Margin 15mm.
    const margin = 15;
    let currentY = 15;

    // --- 1. HEADER (Accent and Title Block) ---
    doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
    doc.rect(margin, currentY, 180, 28, 'F');
    doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
    doc.rect(margin, currentY, 180, 28, 'S');

    // Add Logo if exists left-aligned in the card
    const logoPhoto = localStorage.getItem('estoque_logo_photo_v2');
    let textOffset = 6;
    if (logoPhoto) {
      try {
        doc.addImage(logoPhoto, 'JPEG', margin + 4, currentY + 3, 22, 22);
        textOffset = 30; // Shift title to the right to prevent overlap
      } catch (e) {
        console.error('Failed to add logo image to PDF:', e);
      }
    }

    // Title text inside header block
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('GUIA DE EXPEDIÇÃO & CONFERÊNCIA DE PEDIDO', margin + textOffset, currentY + 11);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text('CONTROLE INTEGRADO DE SEPARAÇÃO E AUDITORIA DE EXPEDIÇÕES', margin + textOffset, currentY + 17);

    // Dynamic Priority and Status Stamps on the right side
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text(`Prioridade: ${order.priority.toUpperCase()}`, 195 - margin - 4, currentY + 9, { align: 'right' });
    
    const statusLabel = order.status === 'Concluído' ? 'STATUS: CONCLUÍDO 🟢' : 'STATUS: PENDENTE 🟡';
    if (order.status === 'Concluído') {
      doc.setTextColor(22, 101, 52); // green-800
    } else {
      doc.setTextColor(217, 119, 6); // amber-606
    }
    doc.text(statusLabel, 195 - margin - 4, currentY + 15, { align: 'right' });

    const typeLabel = `CANAL: ${order.orderType === 'atacado' ? 'ATACADO 🏢' : 'VAREJO 🏪'}`;
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text(typeLabel, 195 - margin - 4, currentY + 21, { align: 'right' });

    currentY += 34;

    // --- 2. METADATA CARDS (Two columns) ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('DADOS DA EXPEDIÇÃO', margin, currentY);

    doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
    doc.line(margin, currentY + 2, 195 - margin, currentY + 2);
    
    currentY += 7;

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('Código do Pedido:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(order.orderCode, margin + 40, currentY);

    const formattedDate = new Date(order.timestamp).toLocaleString('pt-BR');
    doc.setFont('Helvetica', 'bold');
    doc.text('Data/Hora Emissão:', 110, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(formattedDate, 150, currentY);

    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.text('Destinatário/Cliente:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(order.customerName, margin + 40, currentY);

    doc.setFont('Helvetica', 'bold');
    doc.text('Operador Responsável:', 110, currentY);
    doc.setFont('Helvetica', 'normal');
    const displayOp = `${order.operatorName} (${order.operatorEmail.split('@')[0]})`;
    doc.text(displayOp, 150, currentY);

    currentY += 6;

    doc.setFont('Helvetica', 'bold');
    doc.text('Ajuste de Estoque:', margin, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.text(order.deductedFromInventory ? 'Baixado automaticamente do inventário' : 'Aguardando validação de estoque (Pendente)', margin + 40, currentY);

    currentY += 8;

    if (order.notes) {
      doc.setFont('Helvetica', 'bold');
      doc.text('Observações/Instruções:', margin, currentY);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.text(order.notes, margin, currentY + 5, { maxWidth: 180 });
      currentY += 12;
    }

    currentY += 5;

    // --- 3. ITEMS TABLE ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text('PRODUTOS A SEPARAR', margin, currentY);

    currentY += 3;

    // Draw table header (with coordinates summing up to 180mm precisely)
    // 9 (Item) + 22 (SKU) + 58 (Descrição) + 22 (Marca) + 13 (Emb) + 12 (Qtde) + 19 (Vlr Unit) + 25 (Total) = 180mm
    doc.setFillColor(30, 41, 59); // Dark blue-slate header BG
    doc.rect(margin, currentY, 180, 8, 'F');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('#', margin + 4.5, currentY + 5.5, { align: 'center' });
    doc.text('CÓDIGO SKU', margin + 10, currentY + 5.5);
    doc.text('DESCRIÇÃO DO CONCEITO / PRODUTO', margin + 32, currentY + 5.5);
    doc.text('MARCA', margin + 90, currentY + 5.5);
    doc.text('EMB.', margin + 117.5, currentY + 5.5, { align: 'center' });
    doc.text('QTDE', margin + 130, currentY + 5.5, { align: 'center' });
    doc.text('VLR.UNIT.', margin + 153, currentY + 5.5, { align: 'right' });
    doc.text('TOTAL', margin + 180, currentY + 5.5, { align: 'right' });

    currentY += 8;

    let overallOrderTotal = 0;

    // Draw table entries
    order.items.forEach((item, idx) => {
      // Alternate row backgrounds
      if (idx % 2 === 1) {
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.rect(margin, currentY, 180, 9, 'F');
      }

      // Border bottom
      doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
      doc.line(margin, currentY + 9, 195 - margin, currentY + 9);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(textDark[0], textDark[1], textDark[2]);

      // 1. Item line number
      doc.text((idx + 1).toString(), margin + 4.5, currentY + 5.5, { align: 'center' });

      // 2. Product code / SKU
      const idText = item.productId.length > 12 ? `${item.productId.slice(0, 10)}..` : item.productId;
      doc.setFont('Courier', 'bold'); // monospace feel for code
      doc.text(idText, margin + 10, currentY + 5.5);

      // 3. Product Name
      doc.setFont('Helvetica', 'normal');
      const nameText = item.productName.length > 34 ? `${item.productName.slice(0, 32)}...` : item.productName;
      doc.text(nameText, margin + 32, currentY + 5.5);

      // 4. Brand (Marca)
      const brandVal = (item.brand || 'IMPORTADO').toUpperCase();
      doc.text(brandVal.length > 14 ? `${brandVal.slice(0, 12)}.` : brandVal, margin + 90, currentY + 5.5);

      // 5. Packaging (Embalagem)
      const embValue = (item.packaging || 'UN').toUpperCase();
      doc.text(embValue, margin + 117.5, currentY + 5.5, { align: 'center' });

      // 6. Separated Quantity
      doc.setFont('Helvetica', 'bold');
      doc.text(`${item.separatedQty}/${item.requestedQty}`, margin + 130, currentY + 5.5, { align: 'center' });

      // 7. Unit price
      const unitValue = item.discountedPrice !== undefined ? item.discountedPrice : (item.price || 0);
      const unitFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(unitValue);
      doc.setFont('Helvetica', 'normal');
      doc.text(unitFormatted, margin + 153, currentY + 5.5, { align: 'right' });

      // 8. Total price for the amount separated
      const rowTotal = unitValue * item.separatedQty;
      overallOrderTotal += rowTotal;
      const rowTotalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rowTotal);
      doc.setFont('Helvetica', 'bold');
      doc.text(rowTotalFormatted, margin + 180, currentY + 5.5, { align: 'right' });

      currentY += 9;

      // Check page break during loops
      if (currentY > 265) {
        doc.addPage();
        currentY = 20;
        
        // Re-draw table header on new page
        doc.setFillColor(30, 41, 59);
        doc.rect(margin, currentY, 180, 8, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('#', margin + 4.5, currentY + 5.5, { align: 'center' });
        doc.text('CÓDIGO SKU', margin + 10, currentY + 5.5);
        doc.text('DESCRIÇÃO DO CONCEITO / PRODUTO', margin + 32, currentY + 5.5);
        doc.text('MARCA', margin + 90, currentY + 5.5);
        doc.text('EMB.', margin + 117.5, currentY + 5.5, { align: 'center' });
        doc.text('QTDE', margin + 130, currentY + 5.5, { align: 'center' });
        doc.text('VLR.UNIT.', margin + 153, currentY + 5.5, { align: 'right' });
        doc.text('TOTAL', margin + 180, currentY + 5.5, { align: 'right' });
        
        currentY += 8;
      }
    });

    currentY += 7;

    // --- 3.5 VALUE HIGHLIGHT SUMMARY BANNER ---
    doc.setFillColor(15, 23, 42); // slate 900
    doc.rect(margin, currentY, 180, 10, 'F');
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    
    const overallTotalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(overallOrderTotal);
    const totalLinesCount = order.items.length;
    doc.text(`TOTAL DE ITENS DISTINTOS: ${totalLinesCount}`, margin + 5, currentY + 6.5);
    doc.text(`VALOR TOTAL GERAL DO PEDIDO: ${overallTotalFormatted}`, margin + 180 - 4, currentY + 6.5, { align: 'right' });

    currentY += 21;

    // Ensure we don't bleed off page
    if (currentY > 240) {
      doc.addPage();
      currentY = 20;
    }

    // --- 4. SIGN-OFF SHEET & LEGAL STAMP ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(textDark[0], textDark[1], textDark[2]);
    doc.text('CONFERÊNCIA E ASSINATURAS', margin, currentY);
    doc.setDrawColor(borderCell[0], borderCell[1], borderCell[2]);
    doc.line(margin, currentY + 2, 195 - margin, currentY + 2);

    currentY += 18;

    // Assinatura 1
    doc.setDrawColor(180, 180, 180);
    doc.line(margin + 5, currentY, margin + 75, currentY);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.text('Responsável pela Separação (Picking)', margin + 12, currentY + 4);
    
    // Assinatura 2
    doc.line(110, currentY, 180, currentY);
    doc.text('Recebedor / Conferente / Transportador', 112, currentY + 4);

    currentY += 15;
    
    // System bottom credit
    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(180, 180, 180);
    doc.text('Guia gerada automaticamente pelo módulo de Separação de Pedidos em tempo real. Identificador do relatório: ' + order.id, margin, currentY);

    // Trigger save download
    doc.save(`Guia_Separacao_Estoque_${order.orderCode}.pdf`);
  };

  // Delete historical picker
  const handleDeleteCompletedOrder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const proceedWithDeletion = () => {
      const filtered = completedOrders.filter(o => o.id !== id);
      saveOrdersToLocalStorage(filtered);
      if (onShowAlert) {
        onShowAlert('Sucesso', 'Registro de separação de pedido excluído do histórico local com sucesso.', 'success');
      }
    };

    if (onAskConfirmation) {
      onAskConfirmation({
        title: 'Excluir Registro de Separação',
        message: 'Deseja excluir este registro de separação do seu histórico local de forma permanente?',
        type: 'danger',
        confirmLabel: 'Sim, excluir',
        cancelLabel: 'Cancelar',
        onConfirm: proceedWithDeletion
      });
    } else {
      if (window.confirm('Deseja excluir este registro de separação do seu histórico local?')) {
        proceedWithDeletion();
      }
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Tab Navigation header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-blue-600" />
          <h2 className="text-slate-850 font-extrabold text-sm font-display uppercase tracking-tight">
            Separação & Separação de Pedidos
          </h2>
        </div>
        <div className="flex items-center bg-slate-100 rounded-lg p-1 text-[11px] font-bold">
          <button
            onClick={() => setSubTab('nova')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
              subTab === 'nova' 
                ? 'bg-white text-slate-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            Nova Separação
          </button>
          <button
            onClick={() => setSubTab('historico')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              subTab === 'historico' 
                ? 'bg-white text-slate-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            Histórico de Pedidos
            {completedOrders.length > 0 && (
              <span className="bg-blue-600 text-white font-black rounded-full px-1.5 py-0.5 text-[8.5px]">
                {completedOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setSubTab('clientes')}
            className={`px-3 py-1.5 rounded-md transition-all cursor-pointer flex items-center gap-1 ${
              subTab === 'clientes' 
                ? 'bg-white text-slate-800 shadow-xs' 
                : 'text-slate-500 hover:text-slate-850'
            }`}
          >
            Clientes Cadastrados
            {customers.length > 0 && (
              <span className="bg-blue-600 text-white font-black rounded-full px-1.5 py-0.5 text-[8.5px]">
                {customers.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {subTab === 'nova' ? (
          <motion.div 
            key="new-order"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
          >
            
            {/* LEFT COLUMN: Configure Order & Add items to checklist queue */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Order Info Panel */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2.5">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <h3 className="text-slate-850 font-extrabold text-xs font-display">Identificação do Pedido</h3>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">
                      Código de Controle
                    </label>
                    <input
                      type="text"
                      value={orderCode}
                      onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
                      placeholder="ex: SEP-1206-001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-mono font-bold focus:bg-white focus:border-blue-500 outline-hidden tracking-wide text-slate-800"
                    />
                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-extrabold text-slate-555 uppercase tracking-wider">
                        Destinatário / Cliente *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCustomerModalOpen(true)}
                        className="text-[10px] font-extrabold text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        Novo Cliente
                      </button>
                    </div>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerSearchQuery(e.target.value);
                      }}
                      onFocus={() => setCustomerSearchQuery(customerName)}
                      placeholder="Busque cliente cadastrado ou escreva manualmente..."
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                    />

                    {/* Autocomplete dropdown box */}
                    {customerSearchQuery.trim() !== '' && (
                      (() => {
                        const matched = customers.filter(c => 
                          c.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) || 
                          c.code.includes(customerSearchQuery) || 
                          (c.fantasyName && c.fantasyName.toLowerCase().includes(customerSearchQuery.toLowerCase()))
                        );

                        if (matched.length === 0) return null;

                        return (
                          <div className="absolute left-0 right-0 z-40 mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                            {matched.map(c => (
                              <button
                                key={c.code}
                                type="button"
                                onClick={() => {
                                  setCustomerName(`${c.name} (Cód: ${c.code})`);
                                  setCustomerSearchQuery('');
                                }}
                                className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors flex flex-col gap-1 cursor-pointer"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-800">{c.name}</span>
                                  <span className="font-mono text-[10px] font-bold text-slate-400">Cód: {c.code}</span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium font-sans">
                                  <span>{c.fantasyName ? `Loja: ${c.fantasyName}` : 'Sem Nome Fantasia'}</span>
                                  <span>{c.city ? `${c.city} - ${c.neighborhood}` : ''}</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        );
                      })()
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">
                        Prioridade de Carga
                      </label>
                      <select
                        value={priority}
                        onChange={(e) => setPriority(e.target.value as any)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-2 text-xs font-bold focus:bg-white focus:border-blue-500 outline-hidden text-slate-700"
                      >
                        <option value="Baixa">Baixa 🟢</option>
                        <option value="Média">Média 🟡</option>
                        <option value="Alta">Alta 🔴</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">
                        Tipo de Pedido
                      </label>
                      <select
                        value={orderType}
                        onChange={(e) => setOrderType(e.target.value as 'atacado' | 'varejo')}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-2 text-xs font-bold focus:bg-white focus:border-blue-500 outline-hidden text-slate-700"
                      >
                        <option value="varejo">Varejo 🏪</option>
                        <option value="atacado">Atacado 🏢</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">
                      Observações / Notas adicionais
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Instruções de envio ou doca de carregamento..."
                      rows={2}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Add items panel */}
              <div className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-2.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <h3 className="text-slate-850 font-extrabold text-xs font-display">Busca de Produtos</h3>
                </div>

                <div className="space-y-4">
                  {/* Search Input bar */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-550 uppercase tracking-wider mb-1">
                      Buscar por Nome, Código/SKU ou Categoria
                    </label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchProductQuery}
                        onChange={(e) => setSearchProductQuery(e.target.value)}
                        placeholder="ex: Bicicleta, Pneu, BI-121..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-9 pr-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                      />
                    </div>
                  </div>

                  {/* If NOTHING matches and there is query */}
                  {searchProductQuery.trim() !== '' && candidatesProducts.length === 0 && (
                    <div className="p-3 bg-red-50 text-red-650 text-xs font-mono rounded-lg border border-red-100 text-center">
                      Nenhum produto correspondente em estoque.
                    </div>
                  )}

                  {/* Filtered candidates list layout (max height overflow) */}
                  {searchProductQuery.trim() !== '' && !selectedProduct && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100 bg-slate-50">
                      {candidatesProducts.map(p => {
                        const isOut = p.quantity <= 0;
                        const currentBasePrice = orderType === 'atacado' ? (p.resalePrice || p.price || 0) : (p.price || 0);

                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              if (!isOut) {
                                setSelectedProductId(p.id);
                              }
                            }}
                            className={`p-2.5 flex items-center gap-3 text-left transition-colors cursor-pointer select-none ${
                              isOut ? 'opacity-50 cursor-not-allowed bg-slate-100' : 'hover:bg-white font-sans'
                            }`}
                          >
                            {/* Image preview */}
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-200 shrink-0 border border-slate-300">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-100">
                                  <Boxes className="w-4 h-4 text-slate-400" />
                                </div>
                              )}
                            </div>

                            {/* Info columns */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-805 truncate">{p.name}</h4>
                                <span className="font-mono text-[9px] font-bold text-slate-400 font-mono">Código SKU: {p.id}</span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-slate-550 font-medium">
                                <span>Marca: {p.brand || 'IMPORTADO'} | {p.category || 'Geral'}</span>
                                <span className="font-semibold text-slate-700">
                                  Qtd: {p.quantity} {p.packaging || 'UN'}
                                </span>
                              </div>
                              <div className="text-[10px] font-bold text-blue-600 mt-0.5">
                                Preço Base: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentBasePrice)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* If selectedProduct is ACTIVE, show its edit/discount details directly with option to confirm add */}
                  {selectedProduct && (
                    <div className="bg-blue-50/25 border border-blue-150 rounded-xl p-4.5 space-y-4">
                      {/* Product Header */}
                      <div className="flex items-start gap-3">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-white border border-slate-200 shrink-0 shadow-xs flex items-center justify-center">
                          {selectedProduct.imageUrl ? (
                            <img src={selectedProduct.imageUrl} alt={selectedProduct.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-50">
                              <Boxes className="w-6 h-6 text-slate-400" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-xs">
                          <div className="flex justify-between items-start gap-1">
                            <div>
                              <h4 className="font-extrabold text-slate-900 text-sm leading-tight truncate">{selectedProduct.name}</h4>
                              <span className="inline-block bg-blue-100/80 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded mt-1">
                                {selectedProduct.category || 'Geral'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedProductId('');
                                setSelectedProduct(null);
                              }}
                              className="text-xs text-slate-400 hover:text-red-500 font-bold px-1 py-0.5 rounded transition-colors"
                            >
                              Limpar
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Info Panel: SKU and Stock */}
                      <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-150">
                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Código SKU</span>
                          <span className="font-mono font-bold select-all text-slate-755 text-xs">{selectedProduct.id}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-slate-400 uppercase font-bold tracking-wider">Quantidade em Estoque</span>
                          <span className="font-sans font-black text-slate-800 text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 inline-block mt-0.5">
                            {selectedProduct.quantity} {selectedProduct.packaging || 'UN'}
                          </span>
                        </div>
                      </div>

                      {/* Same Discount system from Output (Reference Price, Toggle, input & Live status) */}
                      <div className="border-t border-slate-200/60 pt-3 space-y-3">
                        {/* Choose base price type: Venda vs Revenda */}
                        <div>
                          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Preço de Referência ({orderType === 'atacado' ? 'Padrão Atacado' : 'Padrão Varejo'})
                          </span>
                          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-0.5 rounded-lg select-none">
                            <button
                              type="button"
                              onClick={() => setSelectedBasePriceType('venda')}
                              className={`py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
                                selectedBasePriceType === 'venda'
                                  ? 'bg-white text-slate-800 shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              Venda (R$ {(selectedProduct.price || 0).toFixed(2)})
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
                              Revenda (R$ {(selectedProduct.resalePrice || selectedProduct.price || 0).toFixed(2)})
                            </button>
                          </div>
                        </div>

                        {/* Apply Discount Checkbox / Slider */}
                        <div className="bg-white rounded-lg border border-slate-200 p-3 flex flex-col space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-705 uppercase tracking-wider flex items-center gap-1.5">
                              <Percent className="w-3.5 h-3.5 text-blue-500" />
                              Aplicar Desconto?
                            </span>
                            <label className="relative inline-flex items-center cursor-pointer select-none">
                              <input 
                                type="checkbox" 
                                className="sr-only peer" 
                                checked={applyDiscount}
                                onChange={(e) => setApplyDiscount(e.target.checked)}
                              />
                              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>

                          {applyDiscount && (
                            <div className="space-y-2 pt-2 border-t border-slate-100">
                              <label className="block text-[9px] font-extrabold text-slate-450 uppercase">
                                Valor Unitário Final com o Desconto (R$)
                              </label>
                              <div className="relative">
                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={discountedPriceInput}
                                  onChange={(e) => setDiscountedPriceInput(e.target.value)}
                                  className="w-full bg-slate-50 border border-slate-250 rounded-lg py-1.5 px-8 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-hidden"
                                />
                              </div>

                              {/* Discount Result live info */}
                              {(() => {
                                const tempBase = selectedBasePriceType === 'venda'
                                  ? (selectedProduct.price || 0)
                                  : (selectedProduct.resalePrice || selectedProduct.price || 0);
                                const discVal = parseFloat(discountedPriceInput) || 0;
                                const diff = tempBase - discVal;
                                const pctOfDiscount = tempBase > 0 && discVal < tempBase
                                  ? (((tempBase - discVal) / tempBase) * 100)
                                  : 0;

                                return pctOfDiscount > 0 ? (
                                  <div className="p-2 bg-blue-50/50 border border-blue-100 rounded-lg flex flex-col items-center justify-center text-center">
                                    <p className="text-[10px] text-blue-700 font-bold">
                                      Desconto de {pctOfDiscount.toFixed(1)}% (Economia de R$ {diff.toFixed(2)} por item)
                                    </p>
                                  </div>
                                ) : discVal > tempBase ? (
                                  <div className="p-2 bg-amber-50 border border-amber-100 rounded-lg flex flex-col items-center justify-center text-center">
                                    <p className="text-[10px] text-amber-700 font-bold">
                                      Acréscimo de R$ {Math.abs(diff).toFixed(2)} por item (Sem Desconto)
                                    </p>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Input & Button */}
                      <div className="flex gap-3 pt-1">
                        <div className="w-1/3">
                          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={addQty}
                            onChange={(e) => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-white border border-slate-250 rounded-lg py-2 text-xs font-mono font-bold text-center text-slate-800 focus:border-blue-500 focus:outline-hidden"
                          />
                        </div>
                        <div className="w-2/3 flex items-end">
                          <button
                            type="button"
                            onClick={handleAddItem}
                            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-97 hover:shadow-md"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar à Lista
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: ACTIVE PICKING LIST CHECKLIST GRID */}
            <div className="lg:col-span-8 space-y-6">
              
              <div className="bg-white rounded-2xl border border-slate-150 p-6 shadow-xs min-h-[400px] flex flex-col justify-between">
                
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                    <div className="space-y-0.5">
                      <h3 className="text-slate-800 font-extrabold text-sm font-display flex items-center gap-1.5">
                        Fila de Separação de Mercadorias
                        {separationItems.length > 0 && (
                          <span className="bg-slate-100 text-slate-700 border border-slate-200 rounded-full px-2 py-0.5 text-[10px] font-black">
                            {separationItems.length} SKUs contratados
                          </span>
                        )}
                      </h3>
                      <p className="text-[10px] text-slate-450 font-medium">Localize as unidades nas prateleiras físicas anotando a coleta abaixo</p>
                    </div>

                    {isAllSeparated && (
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full flex items-center gap-1 animate-pulse">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        Pronto para Expedição
                      </span>
                    )}
                  </div>

                  {/* Warning Messages */}
                  {errorMessage && (
                    <div className="mb-4 bg-rose-50 border border-rose-150 text-rose-800 p-3 rounded-lg text-xs font-semibold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {successMessage && (
                    <div className="mb-4 bg-emerald-50 border border-emerald-150 text-emerald-800 p-4 rounded-lg text-xs font-semibold space-y-1.5 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-4.5 h-4.5 text-emerald-600 shrink-0" />
                        <span className="font-extrabold text-emerald-900">Sucesso na Operação!</span>
                      </div>
                      <p className="text-emerald-700 ml-6 leading-relaxed">
                        {successMessage}
                      </p>
                    </div>
                  )}

                  {separationItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-4">
                      <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center">
                        <ListChecks className="w-6 h-6 text-slate-300" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-slate-650 font-extrabold text-xs">A lista de separação está vazia</p>
                        <p className="text-slate-400 text-[11px] max-w-sm leading-relaxed">
                          Selecione um produto alimentar ou peça de estoque à esquerda, configure a quantidade de expedição necessária e inclua na carga.
                        </p>
                      </div>
                    </div>
                  ) : (
                    
                    <div className="overflow-x-auto border border-slate-100 rounded-xl">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 text-[10px] uppercase tracking-wider">
                            <th className="py-2.5 px-3">Item / Registro</th>
                            <th className="py-2.5 px-3 text-center">Corredor/Loc</th>
                            <th className="py-2.5 px-3 text-right">Solicitado</th>
                            <th className="py-2.5 px-3 text-center w-[150px]">Coleta (Checkout)</th>
                            <th className="py-2.5 px-3 text-center">Status</th>
                            <th className="py-2.5 px-3"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {separationItems.map((item, idx) => {
                            const availableQty = item.product.quantity;
                            const isRequestedExceeded = item.requestedQty > availableQty;

                            return (
                              <tr key={`${item.product.id}-${idx}`} className={`hover:bg-slate-50/50 ${item.completed ? 'bg-emerald-50/10' : ''}`}>
                                
                                <td className="py-3 px-3">
                                  <div className="space-y-0.5">
                                    <span className="font-extrabold text-slate-800 text-[11px] block">{item.product.name}</span>
                                    <span className="font-mono text-[9px] text-slate-400 font-bold">Código SKU: {item.product.id}</span>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  {item.product.location ? (
                                    <span className="bg-slate-100 text-slate-700 font-extrabold rounded-md px-1.5 py-0.5 text-[9px] font-mono border border-slate-200">
                                      <MapPin className="w-2.5 h-2.5 inline mr-1 text-slate-500" />
                                      {item.product.location}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] text-slate-400 italic">Doca geral</span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-right font-mono font-bold">
                                  <span className={isRequestedExceeded ? 'text-amber-600 font-black' : 'text-slate-700'}>
                                    {item.requestedQty} un
                                  </span>
                                  {isRequestedExceeded && (
                                    <span className="block text-[8px] text-amber-600 font-sans font-bold mt-0.5" title="Quantidade solicitada excede estoque atual.">
                                      ⚠️ Excede ({availableQty})
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleAdjustSeparatedQty(item.product.id, -1)}
                                      className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 shrink-0 hover:bg-slate-100 flex items-center justify-center cursor-pointer font-bold active:scale-90"
                                    >
                                      <Minus className="w-3 h-3 text-slate-600" />
                                    </button>
                                    
                                    <span className="font-mono font-black text-xs text-slate-800 min-w-8 text-center bg-slate-50 rounded px-1 py-0.5 border border-slate-100">
                                      {item.separatedQty}
                                    </span>

                                    <button
                                      type="button"
                                      onClick={() => handleAdjustSeparatedQty(item.product.id, 1)}
                                      className="w-6 h-6 rounded-md bg-slate-50 border border-slate-200 shrink-0 hover:bg-slate-100 flex items-center justify-center cursor-pointer font-bold active:scale-90"
                                      disabled={item.separatedQty >= item.requestedQty}
                                      style={{ opacity: item.separatedQty >= item.requestedQty ? 0.3 : 1 }}
                                    >
                                      <Plus className="w-3 h-3 text-slate-600" />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleSetFullySeparated(item.product.id)}
                                      title="Separar tudo de uma vez"
                                      className="text-[9px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-1.5 py-0.5 rounded cursor-pointer shrink-0 border border-blue-100 ml-1"
                                    >
                                      Tudo
                                    </button>
                                  </div>
                                </td>

                                <td className="py-3 px-3 text-center">
                                  {item.completed ? (
                                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold inline-flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> OK
                                    </span>
                                  ) : item.separatedQty > 0 ? (
                                    <span className="bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded text-[9.5px] font-extrabold inline-flex items-center gap-0.5">
                                      {Math.round((item.separatedQty/item.requestedQty)*100)}%
                                    </span>
                                  ) : (
                                    <span className="bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[9.5px] font-bold">
                                      Pendente
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-3 text-center">
                                  <button
                                    onClick={() => handleRemoveItem(item.product.id)}
                                    title="Remover da lista"
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>

                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                </div>

                {/* Submitting Footer block of active picker */}
                {separationItems.length > 0 && (
                  <div className="mt-8 border-t border-slate-100 pt-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    
                    <button
                      type="button"
                      onClick={handleResetForm}
                      className="text-slate-500 hover:text-slate-800 font-bold text-xs flex items-center gap-1 py-1 cursor-pointer select-none"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Limpar de volta ao rascunho
                    </button>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        onClick={handleFinalizeSeparation}
                        disabled={isFinalizing}
                        className={`flex-1 sm:flex-none py-2.5 px-6 rounded-xl font-bold text-xs font-display flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-98 text-white ${
                          isAllSeparated 
                            ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/15' 
                            : 'bg-slate-800 hover:bg-slate-900 shadow-slate-500/10'
                        }`}
                      >
                        {isFinalizing ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Processando baixa...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span>Finalizar e Gravar Expedição</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                )}

              </div>

            </div>

          </motion.div>
        ) : subTab === 'clientes' ? (
          /* CLIENTES CADASTRADOS TAB */
          <motion.div 
            key="customer-list-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Top Filter and Actions bar */}
            <div className="bg-white rounded-2xl border border-slate-150 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3.5">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={customerFilterQuery}
                  onChange={(e) => setCustomerFilterQuery(e.target.value)}
                  placeholder="Filtrar clientes por código, nome, CPF/CNPJ, cidade, etc..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 pl-9 pr-3 text-xs font-semibold focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                />
              </div>

              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(true)}
                className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700/95 text-white font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/10 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Cadastrar Cliente
              </button>
            </div>

            {(() => {
              const filtered = customers.filter(c => 
                c.name.toLowerCase().includes(customerFilterQuery.toLowerCase()) ||
                c.code.includes(customerFilterQuery) ||
                (c.cpfCnpj && c.cpfCnpj.includes(customerFilterQuery)) ||
                (c.fantasyName && c.fantasyName.toLowerCase().includes(customerFilterQuery.toLowerCase())) ||
                (c.city && c.city.toLowerCase().includes(customerFilterQuery.toLowerCase())) ||
                (c.activeSector && c.activeSector.toLowerCase().includes(customerFilterQuery.toLowerCase()))
              );

              if (filtered.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center text-slate-400 space-y-4 max-w-lg mx-auto">
                    <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto">
                      <Users className="w-6 h-6 text-slate-300" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-slate-650 font-extrabold text-xs">A base de clientes está vazia</p>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Registre os seus parceiros e lojistas digitando os dados manualmente. Você poderá vinculá-los às guias de separação de forma muito mais rápida.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      Cadastrar Primeiro Cliente
                    </button>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((c) => (
                    <div 
                      key={c.code}
                      className="bg-white rounded-xl border border-slate-150 p-5 shadow-xs relative group flex flex-col justify-between hover:shadow-md hover:border-slate-300 transition-all"
                    >
                      <div>
                        {/* Title Row */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="space-y-1">
                            <span className="font-bold text-xs text-slate-800">{c.name}</span>
                            {c.fantasyName && (
                              <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                {c.fantasyName}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 pt-1.5">
                            <span className="font-mono text-[9px] font-black tracking-wide text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 shrink-0">
                              CÓD: {c.code}
                            </span>
                            
                            <button
                              type="button"
                              onClick={() => {
                                const proceedCustDelete = () => {
                                  const updatedCurCustomers = customers.filter(x => x.code !== c.code);
                                  setCustomers(updatedCurCustomers);
                                  localStorage.setItem('saved_customers_v1', JSON.stringify(updatedCurCustomers));
                                  if (onShowAlert) {
                                    onShowAlert('Excluído', `Cliente ${c.name} foi removido com sucesso.`, 'info');
                                  }
                                };

                                if (onAskConfirmation) {
                                  onAskConfirmation({
                                    title: 'Remover Cliente',
                                    message: `Tem certeza de que deseja remover o cliente "${c.name}" de forma permanente do cadastro local?`,
                                    type: 'danger',
                                    confirmLabel: 'Sim, remover',
                                    cancelLabel: 'Cancelar',
                                    onConfirm: proceedCustDelete
                                  });
                                } else {
                                  if (window.confirm(`Tem certeza de que deseja remover o cliente "${c.name}"?`)) {
                                    proceedCustDelete();
                                  }
                                }
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100 cursor-pointer"
                              title="Remover cliente"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Middle customer metadata details block */}
                        <div className="border-t border-slate-50 pt-3 mt-3 space-y-2 select-none text-xs">
                          {c.cpfCnpj && (
                            <div className="flex items-center gap-1.5">
                              <Landmark className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px] font-semibold text-slate-600">
                                CPF/CNPJ: {c.cpfCnpj}
                              </span>
                            </div>
                          )}

                          {c.phone && (
                            <div className="flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="font-mono text-[11px] font-semibold text-slate-650">
                                {c.phone}
                              </span>
                            </div>
                          )}

                          {c.activeSector && (
                            <div className="flex items-center gap-1.5">
                              <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase font-sans tracking-wide">
                                Setor: {c.activeSector}
                              </span>
                            </div>
                          )}

                          {(c.city || c.neighborhood || c.address) && (
                            <div className="flex items-start gap-1.5 pt-1 border-t border-slate-50 mt-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <div className="text-[11px] text-slate-505 leading-relaxed">
                                {c.address && <p>{c.address}</p>}
                                <p className="font-bold text-slate-600">
                                  {c.neighborhood ? `${c.neighborhood}, ` : ''}
                                  {c.city || ''}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Select shortcut overlay action */}
                      <div className="pt-3.5 mt-3 border-t border-slate-50 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerName(`${c.name} (Cód: ${c.code})`);
                            setSubTab('nova');
                            if (onShowAlert) {
                              onShowAlert('Pronto', `Cliente ${c.name} foi selecionado como destino da nova separação!`, 'success');
                            }
                          }}
                          className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg hover:bg-blue-100 transition-colors uppercase cursor-pointer"
                        >
                          Usar na Nova Separação
                        </button>
                      </div>

                    </div>
                  ))}
                </div>
              );
            })()}
          </motion.div>
        ) : subTab === 'historico' ? (
          /* HISTÓRICO DE PEDIDOS SEPARADOS TAB */
          <motion.div 
            key="history-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {completedOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center text-slate-400 space-y-4 max-w-lg mx-auto">
                <div className="w-14 h-14 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6 text-slate-300" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-slate-650 font-extrabold text-xs">Nenhum pedido finalizado nesta máquina</p>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    As guias de expedição que você finalizar e expedir utilizando este navegador ficarão salvas para auditoria rápida e reimpressão em PDF instantânea.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {completedOrders.map((order) => {
                  const itemsCount = order.items.reduce((acc, current) => acc + current.separatedQty, 0);
                  const isAllOk = order.items.every(i => i.separatedQty === i.requestedQty);

                  return (
                    <div 
                      key={order.id} 
                      className="bg-white rounded-xl border border-slate-150 p-5 shadow-xs hover:border-blue-300 transition-all cursor-pointer relative group flex flex-col justify-between"
                      onClick={() => generatePDFReport(order)}
                    >
                      <div>
                        {/* Title Block */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="space-y-1 select-none">
                            <span className="font-mono text-[10px] font-black tracking-wide text-blue-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5">
                              {order.orderCode}
                            </span>
                            <span className="block text-[10px] text-slate-400 font-bold font-mono">
                              {new Date(order.timestamp).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                              order.priority === 'Alta' 
                                ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                                : order.priority === 'Média' 
                                ? 'bg-amber-50 text-amber-700 border border-amber-100' 
                                : 'bg-teal-50 text-teal-700 border border-teal-100'
                            }`}>
                              {order.priority}
                            </span>
                            
                            <button
                              onClick={(e) => handleDeleteCompletedOrder(order.id, e)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100 cursor-pointer"
                              title="Remover histórico local"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Customer block */}
                        <div className="space-y-1 mb-4 select-none">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block font-sans">CLIENTE / DESTINATÁRIO</span>
                          <span className="text-xs font-extrabold text-slate-850 block truncate">{order.customerName}</span>
                          <span className="text-[11px] text-slate-505 block truncate">Operador: {order.operatorName}</span>
                        </div>

                        {/* Checklist items previews */}
                        <div className="border-t border-slate-100 pt-3 select-none">
                          <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest block mb-1.5">Itens Coletados</span>
                          <div className="space-y-1 max-h-16 overflow-y-auto pr-1">
                            {order.items.map((it, i) => (
                              <div key={i} className="flex items-center justify-between text-[11px] font-medium text-slate-650">
                                <span className="truncate max-w-[150px]">{it.productName}</span>
                                <span className="font-mono text-slate-500 font-bold shrink-0">{it.separatedQty}/{it.requestedQty} un</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Download trigger overlay row */}
                      <div className="pt-4 mt-4 border-t border-slate-50 flex flex-col gap-2.5">
                        <div className="flex items-center justify-between text-xs select-none">
                          <span className="text-[10px] font-bold">
                            {order.deductedFromInventory ? (
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-2 py-0.5 font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                CONCLUÍDA
                              </span>
                            ) : (
                              <span className="text-amber-800 bg-amber-50 border border-amber-150 rounded px-2 py-0.5 font-extrabold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                PENDENTE
                              </span>
                            )}
                          </span>

                          <div className="flex items-center gap-1 text-slate-500 group-hover:text-blue-600 font-bold transition-colors">
                            <FileDown className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                            <span>Imprimir PDF</span>
                          </div>
                        </div>

                        {/* Active deduction button if pending */}
                        {!order.deductedFromInventory && (
                          <button
                            type="button"
                            onClick={(e) => handleConfirmCompletion(order.id, e)}
                            className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[10px] uppercase tracking-wider transition-all flex items-center justify-center gap-1 shadow-sm shadow-emerald-500/10 cursor-pointer active:scale-[0.98]"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmar Separação e Baixar Estoque
                          </button>
                        )}
                      </div>

                      {/* Pure Elegant Overlay for Confirmation if active */}
                      {confirmingOrderId === order.id && (
                        <div 
                          className="absolute inset-0 bg-slate-900/95 rounded-xl p-4 flex flex-col justify-between z-10 text-white animate-fade-in" 
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                        >
                          <div className="space-y-2 text-center my-auto">
                            <AlertCircle className="w-8 h-8 text-amber-500 mx-auto animate-bounce" />
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-100">Deseja Baixar o Estoque?</h4>
                            <p className="text-[10px] text-slate-300 leading-relaxed px-1">
                              Esta ação atualizará o estoque real dando baixa definitiva de todos os itens do pedido {order.orderCode}.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingOrderId(null);
                              }}
                              className="w-1/2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-350 font-bold rounded-lg text-[10px] uppercase transition-colors cursor-pointer"
                            >
                              Voltar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExecuteConfirmCompletion(order.id);
                              }}
                              className="w-1/2 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-[10px] uppercase transition-all shadow-sm active:scale-95 cursor-pointer font-sans"
                            >
                              Baixar
                            </button>
                          </div>
                        </div>
                      )}

                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Customer Registration Dialog Modal Popup */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col"
          >
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800 text-sm font-display">
                  Cadastrar Novo Cliente
                </h3>
                <p className="text-[10px] text-slate-450 font-mono mt-0.5">
                  Preencha os dados manualmente. Um código numérico único será gerado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsCustomerModalOpen(false)}
                className="text-slate-400 hover:text-slate-650 transition-colors p-1 hover:bg-slate-100 rounded-full cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cName.trim()) return;

                // Unique numeric code generator of purely digits
                let code = '';
                let isUnique = false;
                while (!isUnique) {
                  code = Math.floor(100000 + Math.random() * 900000).toString();
                  isUnique = !customers.some(c => c.code === code);
                }

                const newCustomer = {
                  code,
                  name: cName.trim(),
                  phone: cPhone.trim(),
                  cpfCnpj: cCpfCnpj.trim(),
                  fantasyName: cFantasyName.trim(),
                  city: cCity.trim(),
                  neighborhood: cNeighborhood.trim(),
                  address: cAddress.trim(),
                  activeSector: cActiveSector.trim()
                };

                const updated = [...customers, newCustomer];
                setCustomers(updated);
                localStorage.setItem('saved_customers_v1', JSON.stringify(updated));

                // Auto assign client selection field
                setCustomerName(`${newCustomer.name} (Cód: ${newCustomer.code})`);
                
                // Clear state values
                setCName('');
                setCPhone('');
                setCCpfCnpj('');
                setCFantasyName('');
                setCCity('');
                setCNeighborhood('');
                setCAddress('');
                setCActiveSector('');
                
                setIsCustomerModalOpen(false);
                if (onShowAlert) {
                  onShowAlert('Cliente Cadastrado', `Cliente ${newCustomer.name} cadastrado com Código Numérico único: ${newCustomer.code}!`, 'success');
                }
              }}
              className="p-6 space-y-3.5 overflow-y-auto max-h-[75vh]"
            >
              {/* Nome */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                  Nome Completo / Razão Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="ex: João Silva Neto ou Comercial Ciclo Ltda"
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                />
              </div>

              {/* Nome Fantasia */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                  Nome Fantasia (Nome da Loja)
                </label>
                <input
                  type="text"
                  placeholder="ex: Ciclocar Bike Shop"
                  value={cFantasyName}
                  onChange={(e) => setCFantasyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Telefone */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                    Telefone
                  </label>
                  <input
                    type="text"
                    placeholder="ex: (11) 99999-9999"
                    value={cPhone}
                    onChange={(e) => setCPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800 font-mono"
                  />
                </div>

                {/* CPF ou CNPJ */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                    CPF ou CNPJ
                  </label>
                  <input
                    type="text"
                    placeholder="ex: 00.000.000/0001-00"
                    value={cCpfCnpj}
                    onChange={(e) => setCCpfCnpj(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cidade */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                    Cidade
                  </label>
                  <input
                    type="text"
                    placeholder="ex: São Paulo"
                    value={cCity}
                    onChange={(e) => setCCity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                  />
                </div>

                {/* Bairro */}
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                    Bairro
                  </label>
                  <input
                    type="text"
                    placeholder="ex: Centro"
                    value={cNeighborhood}
                    onChange={(e) => setCNeighborhood(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                  Endereço
                </label>
                <input
                  type="text"
                  placeholder="ex: Rua Das Flores, N 123"
                  value={cAddress}
                  onChange={(e) => setCAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                />
              </div>

              {/* Ramo Ativo */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wide mb-1">
                  Ramo Ativo (Setor do Cliente)
                </label>
                <input
                  type="text"
                  placeholder="ex: Bicicletas, Oficinas, Revenda de Peças"
                  value={cActiveSector}
                  onChange={(e) => setCActiveSector(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 text-xs font-medium focus:bg-white focus:border-blue-500 outline-hidden text-slate-800"
                />
              </div>

              {/* Buttons */}
              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-transparent hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700/90 rounded-lg transition-all shadow-md shadow-blue-500/10 cursor-pointer"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
