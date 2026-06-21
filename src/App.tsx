import React, { useState, useEffect, useRef } from 'react';
import { 
  handleFirestoreError,
  OperationType,
  testConnection,
  setCachedAccessToken
} from './firebase';
import { Product, Transaction, TeamMember } from './types';
import MetricCard from './components/MetricCard';
import InventoryCharts from './components/InventoryCharts';
import ProductFormModal from './components/ProductFormModal';
import KitFormModal from './components/KitFormModal';
import TransactionModal from './components/TransactionModal';
import TransactionHistory from './components/TransactionHistory';
import TeamCollaborationView from './components/TeamCollaborationView';
import OrderSeparationView from './components/OrderSeparationView';
import CustomNotificationModal from './components/CustomNotificationModal';

import { 
  Plus, 
  Search, 
  LogOut, 
  Database, 
  AlertTriangle, 
  Layers, 
  Boxes, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Edit3, 
  Trash2, 
  Eye,
  Lock,
  UserCheck,
  Users,
  UserPlus,
  Copy,
  Check,
  Mail,
  Shield,
  ChevronDown,
  ChevronUp,
  X,
  Barcode,
  Download,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Auth state
  const [user, setUser] = useState<{ uid: string; displayName?: string | null; email?: string | null; photoURL?: string | null } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Role & Authorization states
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<'Administrador' | 'Editor' | 'Visualizador' | null>(null);
  const [authChecking, setAuthChecking] = useState(false);

  // Editable logo state and refs
  const [logoPhoto, setLogoPhoto] = useState<string | null>(() => localStorage.getItem('estoque_logo_photo_v2'));
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showCustomAlert('Erro', 'Por favor, selecione apenas arquivos de imagem.', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX_SIZE = 400;
        let width = img.width;
        let height = img.height;

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          } else {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          showCustomAlert('Erro', 'Não foi possível processar a imagem do logo.', 'danger');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const logoBase64 = canvas.toDataURL('image/png');
        
        if (logoBase64.length > 800000) {
          const jpegBase64 = canvas.toDataURL('image/jpeg', 0.8);
          setLogoPhoto(jpegBase64);
          localStorage.setItem('estoque_logo_photo_v2', jpegBase64);
        } else {
          setLogoPhoto(logoBase64);
          localStorage.setItem('estoque_logo_photo_v2', logoBase64);
        }
        
        showCustomAlert('Sucesso', 'A logo foi atualizada com sucesso!', 'success');
      };
      
      img.onerror = () => {
        showCustomAlert('Erro', 'Erro ao ler a imagem. O arquivo pode estar corrompido.', 'danger');
      };

      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  // Local DB states
  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [dbConnected, setDbConnected] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);

  // Filter & Search states
  const [activeTab, setActiveTab ] = useState<'estoque' | 'auditoria' | 'equipe' | 'separacao'>('estoque');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'outofstock' | 'normal'>('all');
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});
  const [zoomedImage, setZoomedImage] = useState<{ url: string; name: string } | null>(null);

  // Modals controller states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isKitModalOpen, setIsKitModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [selectedProductForTx, setSelectedProductForTx] = useState<Product | null>(null);
  const [defaultTxType, setDefaultTxType] = useState<'IN' | 'OUT'>('IN');

  const [authError, setAuthError] = useState('');

  // Access Code and Viewer Registration states
  const [registerName, setRegisterName] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerRole, setRegisterRole] = useState<'Administrador' | 'Editor' | 'Visualizador'>('Administrador');

  // Custom dialog/alert state
  const [customDialog, setCustomDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    isAlertOnly?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: () => {},
  });

  const askConfirmation = (options: {
    title: string;
    message: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  }) => {
    setCustomDialog({
      isOpen: true,
      title: options.title,
      message: options.message,
      type: options.type || 'info',
      confirmLabel: options.confirmLabel,
      cancelLabel: options.cancelLabel,
      isAlertOnly: false,
      onConfirm: async () => {
        setCustomDialog(prev => ({ ...prev, isOpen: false }));
        await options.onConfirm();
      }
    });
  };

  const showCustomAlert = (title: string, message: string, type: 'danger' | 'warning' | 'info' | 'success' = 'info') => {
    setCustomDialog({
      isOpen: true,
      title,
      message,
      type,
      isAlertOnly: true,
      confirmLabel: 'OK',
      onConfirm: () => setCustomDialog(prev => ({ ...prev, isOpen: false }))
    });
  };

  // 1. Monitor local profile auth state
  useEffect(() => {
    const savedProfile = localStorage.getItem('estoque_local_user');
    if (savedProfile) {
      try {
        const parsed = JSON.parse(savedProfile);
        setUser(parsed);
        setCurrentUserRole(parsed.role || 'Administrador');
        setIsAuthorized(true);
      } catch (e) {
        localStorage.removeItem('estoque_local_user');
      }
    }
    setAuthLoading(false);
  }, []);

  // 2. Load Local Storage Data when authenticated
  useEffect(() => {
    if (!user) {
      setProducts([]);
      setTransactions([]);
      setTeamMembers([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    // Load products if exists, otherwise empty array
    const storedProducts = localStorage.getItem('estoque_products_v2');
    let loadedProducts: Product[] = [];
    if (storedProducts) {
      loadedProducts = JSON.parse(storedProducts);
    } else {
      loadedProducts = [];
      localStorage.setItem('estoque_products_v2', JSON.stringify(loadedProducts));
    }

    // Load transactions if exists, otherwise empty array
    const storedTx = localStorage.getItem('estoque_transactions_v2');
    let loadedTx: Transaction[] = [];
    if (storedTx) {
      loadedTx = JSON.parse(storedTx);
    } else {
      loadedTx = [];
      localStorage.setItem('estoque_transactions_v2', JSON.stringify(loadedTx));
    }

    // Load team members if exists, otherwise empty array
    const storedTeam = localStorage.getItem('estoque_team_members_v2');
    let loadedTeam: TeamMember[] = [];
    if (storedTeam) {
      loadedTeam = JSON.parse(storedTeam);
    } else {
      loadedTeam = [];
      localStorage.setItem('estoque_team_members_v2', JSON.stringify(loadedTeam));
    }

    setProducts(loadedProducts);
    setTransactions(loadedTx);
    setTeamMembers(loadedTeam);
    setDataLoading(false);
  }, [user]);

  // Auth actions configured for Offline Local Profile Mode
  const handleOfflineLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerName.trim()) {
      setAuthError('Por favor, informe o seu nome completo.');
      return;
    }
    if (!registerEmail.trim() || !registerEmail.includes('@')) {
      setAuthError('Por favor, informe um endereço de e-mail válido.');
      return;
    }

    const cleanEmail = registerEmail.trim().toLowerCase();
    
    // Auto-detect role of the user:
    // 1. Owner email (miggsous@gmail.com) receives 'Administrador'
    // 2. If found on the team list (provided via backup), inherits that exact role (included inside invite)
    // 3. Otherwise fallback to read-only 'Visualizador' for protection against uninvited direct users
    let roleAssigned: 'Administrador' | 'Editor' | 'Visualizador' = 'Visualizador';
    if (cleanEmail === 'miggsous@gmail.com') {
      roleAssigned = 'Administrador';
    } else {
      const storedTeam = localStorage.getItem('estoque_team_members_v2');
      if (storedTeam) {
        try {
          const parsedTeam = JSON.parse(storedTeam);
          if (Array.isArray(parsedTeam)) {
            const match = parsedTeam.find((m: any) => m.email.trim().toLowerCase() === cleanEmail);
            if (match) {
              roleAssigned = match.role as any;
            }
          }
        } catch (err) {
          console.error("Erro ao validar permissões da equipe local:", err);
        }
      }
    }

    const payload = {
      uid: `local-${Date.now()}`,
      displayName: registerName.trim(),
      email: cleanEmail,
      photoURL: '',
      role: roleAssigned
    };

    localStorage.setItem('estoque_local_user', JSON.stringify(payload));
    setUser(payload);
    setCurrentUserRole(roleAssigned);
    setIsAuthorized(true);
    setAuthError('');
  };

  const handleLogout = async () => {
    localStorage.removeItem('estoque_local_user');
    setUser(null);
    setCurrentUserRole(null);
    setIsAuthorized(null);
  };

  // Create or Update Product locally
  const handleSaveProduct = async (productData: Partial<Product> & { initialStock?: number }) => {
    if (!user) return;

    const productId = productData.id!;
    const isEdit = products.some(p => p.id === productId);

    const completePayload: Product = {
      id: productId,
      name: productData.name!,
      category: productData.category!,
      quantity: isEdit ? (products.find(p => p.id === productId)?.quantity || 0) : (productData.initialStock || 0),
      minQuantity: productData.minQuantity!,
      price: productData.price!,
      resalePrice: productData.resalePrice || 0,
      location: productData.location || '',
      description: productData.description || '',
      imageUrl: productData.imageUrl || '',
      brand: productData.brand || '',
      packaging: productData.packaging || 'UN',
      updatedAt: new Date().toISOString(),
      updatedBy: user.displayName || 'Membro',
      updatedByEmail: user.email || '',
    };

    let updatedProducts = [...products];
    if (isEdit) {
      updatedProducts = products.map(p => p.id === productId ? completePayload : p);
    } else {
      updatedProducts = [completePayload, ...products];
    }

    let updatedTx = [...transactions];
    if (!isEdit) {
      const txId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const txPayload: Transaction = {
        id: txId,
        productId,
        productName: productData.name!,
        type: 'IN',
        quantityChanged: productData.initialStock || 0,
        previousQuantity: 0,
        newQuantity: productData.initialStock || 0,
        timestamp: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email || '',
        userDisplayName: user.displayName || 'Membro',
        reason: 'Cadastro do produto no sistema de estoque.',
      };
      updatedTx = [txPayload, ...updatedTx];
    }

    setProducts(updatedProducts);
    setTransactions(updatedTx);
    localStorage.setItem('estoque_products_v2', JSON.stringify(updatedProducts));
    localStorage.setItem('estoque_transactions_v2', JSON.stringify(updatedTx));
  };

  // Perform Stock Adjustment locally
  const handleRecordTransaction = async (
    productId: string, 
    type: 'IN' | 'OUT' | 'ADJUST', 
    quantityChanged: number, 
    reason: string,
    discountData?: { discountPercent: number; originalPrice: number; discountedPrice: number }
  ) => {
    if (!user) return;

    const matchedProd = products.find(p => p.id === productId);
    if (!matchedProd) return;

    let currentProducts = [...products];
    let currentTransactions = [...transactions];

    const currentQty = matchedProd.quantity || 0;
    
    let delta = quantityChanged;
    let finalQty = currentQty;

    if (type === 'IN') {
      finalQty = currentQty + delta;
    } else if (type === 'OUT') {
      delta = -Math.abs(delta);
      finalQty = Math.max(0, currentQty + delta);
    } else if (type === 'ADJUST') {
      finalQty = quantityChanged;
      delta = finalQty - currentQty;
    }

    const completeProductPayload: Product = {
      ...matchedProd,
      quantity: finalQty,
      updatedAt: new Date().toISOString(),
      updatedBy: user.displayName || 'Membro',
      updatedByEmail: user.email || '',
    };

    currentProducts = currentProducts.map(p => p.id === productId ? completeProductPayload : p);

    const txId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txPayload: Transaction = {
      id: txId,
      productId,
      productName: matchedProd.name,
      type: type === 'ADJUST' ? (delta >= 0 ? 'IN' : 'OUT') : type,
      quantityChanged: Math.abs(delta),
      previousQuantity: currentQty,
      newQuantity: finalQty,
      timestamp: new Date().toISOString(),
      userId: user.uid,
      userEmail: user.email || '',
      userDisplayName: user.displayName || 'Membro',
      reason,
      ...discountData
    };
    currentTransactions = [txPayload, ...currentTransactions];

    // Auto-deduct components if it's a Kit and the operation decreased stock quantities (delta < 0)
    if (matchedProd.isKit && matchedProd.kitItems && matchedProd.kitItems.length > 0 && delta < 0) {
      const positiveDelta = Math.abs(delta);
      matchedProd.kitItems.forEach((kitComp, idx) => {
        const compId = kitComp.productId;
        const compQtyNeeded = kitComp.quantityNeeded;
        const totalCompToSubtract = positiveDelta * compQtyNeeded;

        const targetCompIndex = currentProducts.findIndex(p => p.id === compId);
        if (targetCompIndex !== -1) {
          const targetComp = currentProducts[targetCompIndex];
          const prevCompQty = targetComp.quantity || 0;
          const newCompQty = Math.max(0, prevCompQty - totalCompToSubtract);

          currentProducts[targetCompIndex] = {
            ...targetComp,
            quantity: newCompQty,
            updatedAt: new Date().toISOString(),
            updatedBy: user.displayName || 'Membro',
            updatedByEmail: user.email || '',
          };

          const compTxId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}-COMP-${idx}`;
          const compTxPayload: Transaction = {
            id: compTxId,
            productId: compId,
            productName: targetComp.name,
            type: 'OUT',
            quantityChanged: totalCompToSubtract,
            previousQuantity: prevCompQty,
            newQuantity: newCompQty,
            timestamp: new Date().toISOString(),
            userId: user.uid,
            userEmail: user.email || '',
            userDisplayName: user.displayName || 'Membro',
            reason: `Baixa integrada de componente (Composição do Kit: ${matchedProd.name} | Cód: ${productId})`,
          };
          currentTransactions = [compTxPayload, ...currentTransactions];
        }
      });
    }

    setProducts(currentProducts);
    setTransactions(currentTransactions);
    localStorage.setItem('estoque_products_v2', JSON.stringify(currentProducts));
    localStorage.setItem('estoque_transactions_v2', JSON.stringify(currentTransactions));
  };

  // Delete Product locally
  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!user) return;

    askConfirmation({
      title: 'Excluir Produto',
      message: `Deseja mesmo remover o produto "${productName}" (${productId}) do estoque? Esta ação registrará um log permanente e removerá o produto de forma definitiva.`,
      type: 'danger',
      confirmLabel: 'Sim, excluir',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        const matchedProd = products.find(p => p.id === productId);
        const currentQty = matchedProd?.quantity || 0;

        const txId = `TX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        const txPayload: Transaction = {
          id: txId,
          productId,
          productName,
          type: 'OUT',
          quantityChanged: currentQty,
          previousQuantity: currentQty,
          newQuantity: 0,
          timestamp: new Date().toISOString(),
          userId: user.uid,
          userEmail: user.email || '',
          userDisplayName: user.displayName || 'Membro',
          reason: 'REMOÇÃO DEFINITIVA DO PRODUTO: Estoque liquidado/desativado.',
        };

        const updatedProducts = products.filter(p => p.id !== productId);
        const updatedTx = [txPayload, ...transactions];

        setProducts(updatedProducts);
        setTransactions(updatedTx);
        localStorage.setItem('estoque_products_v2', JSON.stringify(updatedProducts));
        localStorage.setItem('estoque_transactions_v2', JSON.stringify(updatedTx));
        showCustomAlert('Sucesso', `O produto "${productName}" foi removido com sucesso.`, 'success');
      }
    });
  };

  // Clear All Transactions locally
  const handleClearTransactions = async () => {
    if (!user) return;
    if (currentUserRole !== 'Administrador') {
      showCustomAlert('Acesso Negado', "Apenas Operadores com perfil Administrador têm permissão para limpar o histórico.", 'warning');
      return;
    }

    askConfirmation({
      title: 'Limpar Todo o Histórico?',
      message: "Deseja mesmo limpar TODO o histórico de lançamentos? Esta ação removerá permanentemente todas as movimentações de auditoria de forma irreversível.",
      type: 'danger',
      confirmLabel: 'Limpar Histórico',
      cancelLabel: 'Cancelar',
      onConfirm: async () => {
        setTransactions([]);
        localStorage.setItem('estoque_transactions_v2', JSON.stringify([]));
        showCustomAlert('Sucesso', "Histórico de movimentações limpo com sucesso!", 'success');
      }
    });
  };

  // Add / Invite Team Member locally
  const handleInviteMemberLocal = (newMember: TeamMember) => {
    const filtered = teamMembers.filter(m => m.id !== newMember.id);
    const updated = [newMember, ...filtered];
    setTeamMembers(updated);
    localStorage.setItem('estoque_team_members_v2', JSON.stringify(updated));
  };

  // Remove Team Member locally
  const handleRemoveMemberLocal = (id: string) => {
    const updated = teamMembers.filter(m => m.id !== id);
    setTeamMembers(updated);
    localStorage.setItem('estoque_team_members_v2', JSON.stringify(updated));
  };

  // Backup Import & Export handlers ("colocar como dados local armazenado numa pasta")
  const handleExportBackup = () => {
    try {
      const dataToExport = {
        version: "1.0",
        appName: "Gerenciador de Estoque",
        exportedAt: new Date().toISOString(),
        products,
        transactions,
        teamMembers,
        accessCodes: JSON.parse(localStorage.getItem('estoque_access_codes') || '[]'),
        userProfile: user
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToExport, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      
      const formattedDate = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute("download", `backup_estoque_${formattedDate}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      showCustomAlert(
        'Backup Exportado!',
        'O arquivo de backup de dados "backup_estoque_' + formattedDate + '.json" foi gerado com sucesso! Transfira e armazene este arquivo em qualquer pasta interna do seu aparelho (ex: Downloads, Documentos ou uma pasta dedicada) para manter seus dados seguros fora do navegador.',
        'success'
      );
    } catch (err: any) {
      showCustomAlert('Falha na Exportação', `Ocorreu um erro ao gerar o backup: ${err.message}`, 'danger');
    }
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = event.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = (e) => {
      try {
        const fileContent = e.target?.result;
        if (typeof fileContent !== 'string') return;

        const parsedData = JSON.parse(fileContent);
        
        // Validation check
        if (!parsedData.products || !Array.isArray(parsedData.products)) {
          throw new Error('O arquivo selecionado não contém um formato de backup de estoque válido.');
        }

        askConfirmation({
          title: 'Importar Novo Backup?',
          message: 'Deseja realmente carregar esse arquivo de backup? Esta ação irá substituir todo o estoque, histórico e membros atuais da sua máquina pelos dados salvos no arquivo selecionado.',
          type: 'warning',
          confirmLabel: 'Sim, carregar dados',
          cancelLabel: 'Cancelar',
          onConfirm: () => {
            const importedProducts = parsedData.products;
            const importedTx = parsedData.transactions || [];
            const importedTeam = parsedData.teamMembers || [];
            const importedCodes = parsedData.accessCodes || [];
            const importedUser = parsedData.userProfile || null;

            setProducts(importedProducts);
            setTransactions(importedTx);
            setTeamMembers(importedTeam);
            
            localStorage.setItem('estoque_products_v2', JSON.stringify(importedProducts));
            localStorage.setItem('estoque_transactions_v2', JSON.stringify(importedTx));
            localStorage.setItem('estoque_team_members_v2', JSON.stringify(importedTeam));
            localStorage.setItem('estoque_access_codes', JSON.stringify(importedCodes));
            
            // Recalculate local user's role based on the imported database to preserve security constraints
            if (user) {
              const cleanEmail = user.email.trim().toLowerCase();
              let newRole: 'Administrador' | 'Editor' | 'Visualizador' = 'Visualizador';
              if (cleanEmail === 'miggsous@gmail.com') {
                newRole = 'Administrador';
              } else {
                const foundInTeam = importedTeam.find((m: any) => m.email.trim().toLowerCase() === cleanEmail);
                if (foundInTeam) {
                  newRole = foundInTeam.role as any;
                }
              }
              const updatedUserProfile = { ...user, role: newRole };
              localStorage.setItem('estoque_local_user', JSON.stringify(updatedUserProfile));
              setUser(updatedUserProfile);
              setCurrentUserRole(newRole);
            } else if (importedUser) {
              localStorage.setItem('estoque_local_user', JSON.stringify(importedUser));
              setUser(importedUser);
              setCurrentUserRole(importedUser.role || 'Administrador');
            }

            showCustomAlert('Backup Carregado!', 'Toda a base de dados local de produtos, movimentações de auditoria e configurações foram restauradas com sucesso a partir do arquivo!', 'success');
          }
        });
      } catch (err: any) {
        showCustomAlert('Erro ao Importar', `Não foi possível ler o arquivo. Certifique-se de carregar um export JSON válido. Detalhe do erro: ${err.message}`, 'danger');
      }
    };
    
    fileReader.readAsText(files[0]);
    event.target.value = '';
  };

  // Compute dynamic dashboards states
  const metrics = React.useMemo(() => {
    let totalQuantity = 0;
    let criticalWarningCount = 0;
    let outOfStockCount = 0;
    let totalInventoryValue = 0;

    products.forEach((p) => {
      totalQuantity += p.quantity;
      if (p.quantity === 0) {
        outOfStockCount++;
      } else if (p.quantity <= p.minQuantity) {
        criticalWarningCount++;
      }
      totalInventoryValue += p.quantity * p.price;
    });

    return {
      skuCount: products.length,
      warningCount: criticalWarningCount,
      outOfStockCount,
      totalCapital: totalInventoryValue,
    };
  }, [products]);

  // Extract list of all categories present (with dynamic distinct checking) 
  const categoriesList = React.useMemo(() => {
    const list = new Set<string>();
    products.forEach((p) => {
      if (p.category) list.add(p.category);
    });
    return ['Todas', ...Array.from(list)];
  }, [products]);

  // Filter products list based on searchQuery,selectedCategory, and statusFilter
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (p.location && p.location.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;

      let matchesStatus = true;
      if (statusFilter === 'critical') {
        matchesStatus = p.quantity > 0 && p.quantity <= p.minQuantity;
      } else if (statusFilter === 'outofstock') {
        matchesStatus = p.quantity === 0;
      } else if (statusFilter === 'normal') {
        matchesStatus = p.quantity > p.minQuantity;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, statusFilter]);

  // --- RENDERING HANDLERS ---

  if (authLoading || authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <motion.div 
          animate={{ scale: [1, 1.1, 1] }} 
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="flex flex-col items-center"
        >
          <Boxes className="w-12 h-12 text-emerald-600 mb-4 animate-bounce" />
          <p className="text-slate-600 font-bold text-sm">Iniciando armazenamento local...</p>
        </motion.div>
      </div>
    );
  }

  // Cover Login UI configured for Offline / Local profile selection
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50/50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-100 overflow-hidden"
        >
          {/* Logo Brand Header */}
          <div className="bg-blue-600 p-8 text-white text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent)] pointer-events-none" />
            <Boxes className="w-14 h-14 mx-auto mb-3" />
            <h1 className="font-sans font-bold text-xl tracking-tight">Estoque Local & Offline</h1>
            <p className="text-blue-100 text-xs mt-1.5 font-medium">Controle de Inventário Integrado e Totalmente Local</p>
          </div>

          <div className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-base font-bold text-slate-800">Conectar ao Perfil do Dispositivo</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Configure os dados do seu operador local. As informações e os relatórios de auditoria serão salvos e atualizados em tempo real no armazenamento do aparelho.
              </p>
            </div>

            {authError && (
               <div className="bg-rose-50 border border-rose-250 text-rose-700 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                 <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                 <span>{authError}</span>
               </div>
            )}

            <form onSubmit={handleOfflineLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Seu Nome Completo
                </label>
                <input
                  type="text"
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="ex: Maurício Silva"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-semibold focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-800"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-between">
                  <span>Endereço de E-mail</span>
                  <span className="text-[8px] text-blue-600 font-extrabold font-mono">Usar miggsous@gmail.com para Privilégios</span>
                </label>
                <input
                  type="email"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="ex: operador@empresa.com"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3.5 text-xs font-semibold focus:bg-white focus:border-blue-500 outline-hidden transition-all text-slate-800"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200/60 p-3 rounded-xl">
                <p className="text-[10px] text-slate-550 font-medium leading-relaxed">
                  🔒 <strong>Permissões de Acesso:</strong> Seus níveis de privilégios (<em>Visualizador, Editor ou Administrador</em>) serão atribuídos de forma segura e automática baseando-se no convite recebido pelo administrador ou ao importar o backup <code>.json</code> do estoque.
                </p>
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-all duration-200 cursor-pointer shadow-xs active:scale-98 flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>Configurar Perfil & Acessar de Estoque</span>
              </button>
            </form>

            {/* Local file restoration shortcut */}
            <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-2.5">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Já possui um backup?</span>
              <label className="py-2 px-4 border border-dashed border-slate-300 hover:border-blue-500 text-slate-650 hover:text-blue-600 bg-slate-50 hover:bg-blue-50/50 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" />
                <span>Restaurar Backup (.json)</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans">
      
      {/* 1. APP NAVBAR BRAND */}
      <header className="bg-white border-b border-slate-200/90 py-4 px-6 sticky top-0 z-40 shadow-xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div 
              onClick={() => logoInputRef.current?.click()}
              title="Clique para alterar a logo"
              className="relative group cursor-pointer"
            >
              <div className={`rounded-xl overflow-hidden transition-all duration-300 group-hover:scale-105 active:scale-95 w-24 h-18 flex items-center justify-center ${
                logoPhoto ? 'p-0 bg-transparent' : 'p-3 bg-blue-600 text-white'
              }`}>
                {logoPhoto ? (
                  <img src={logoPhoto} alt="Logo" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <Boxes className="w-9 h-9" />
                )}
                
                {/* Hover Camera/Edit Overlay */}
                <div className="absolute inset-0 bg-slate-900/60 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <Upload className="w-5 h-5 text-white" />
                </div>
              </div>

              <input 
                type="file" 
                ref={logoInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 
                  className="font-black text-slate-800 text-base sm:text-lg tracking-normal leading-none uppercase italic"
                  style={{ fontFamily: '"FC Fastest", "เอฟซี ฟาสท์เทสท์", "Chakra Petch", sans-serif' }}
                >
                  Ciclocar Bike Shop
                </h1>
              </div>
            </div>
          </div>
 
          {/* User Section / Logout */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end text-right">
              <span className="text-xs font-bold text-slate-700">{user.displayName || 'Membro do Time'}</span>
              <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
            </div>
 
            {/* Profile Avatar */}
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt="user avatar" 
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-full border border-slate-200"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-blue-50 border border-blue-150 text-blue-700 flex items-center justify-center font-bold text-sm shadow-xs">
                {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
          </div>
        </div>
      </header>
 
      {/* Main container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
 
        {/* 2. SUMMARY METRICS PANELS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total de SKUs"
            value={metrics.skuCount}
            subValue="Modelos de produtos"
            icon={Boxes}
            iconColorClass="text-blue-600"
            bgColorClass="bg-blue-50"
          />
          <MetricCard
            title="Abaixo do Mínimo"
            value={metrics.warningCount}
            subValue={`${metrics.warningCount} itens em nível crítico`}
            icon={AlertTriangle}
            iconColorClass="text-amber-600"
            bgColorClass="bg-amber-50"
          />
          <MetricCard
            title="Sem Estoque"
            value={metrics.outOfStockCount}
            subValue={`${metrics.outOfStockCount} SKUs esgotados`}
            icon={AlertCircle}
            iconColorClass="text-rose-600"
            bgColorClass="bg-rose-50"
          />
          <MetricCard
            title="Valor de Inventário"
            value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalCapital)}
            subValue="Valoração total líquida"
            icon={Database}
            iconColorClass="text-blue-600"
            bgColorClass="bg-blue-50"
          />
        </div>

        {/* VIEW NAVIGATION TABS */}
        <div className="flex border-b border-slate-200 gap-6">
          <button
            onClick={() => setActiveTab('estoque')}
            className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all cursor-pointer font-display ${
              activeTab === 'estoque'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Estoque Geral
          </button>
          <button
            onClick={() => setActiveTab('auditoria')}
            className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all cursor-pointer font-display ${
              activeTab === 'auditoria'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Lançamentos & Auditoria ({transactions.length})
          </button>
          <button
            onClick={() => setActiveTab('equipe')}
            className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all cursor-pointer font-display ${
              activeTab === 'equipe'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Equipe
          </button>
          <button
            onClick={() => setActiveTab('separacao')}
            className={`pb-3 text-sm font-bold tracking-tight border-b-2 transition-all cursor-pointer font-display ${
              activeTab === 'separacao'
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Separação de Pedidos
          </button>
        </div>

        {activeTab === 'estoque' && (
          <>
            {/* GERENCIADOR DE BACKUP LOCAL */}
            <div className="bg-white rounded-2xl border border-slate-250 p-5 shadow-sm space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-[9px] font-extrabold tracking-wider uppercase">
                    📁 Backup e Armazenamento Interno
                  </span>
                  <h3 className="text-sm font-bold text-slate-800">Pasta / Diretório de Dados Local</h3>
                  <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                    Seus dados estão seguros e gravados offline neste navegador. Exporte backups regulares em formato .json para salvar em qualquer pasta do armazenamento interno do seu aparelho (Celular, Tablet ou PC) ou para compartilhar com outros membros.
                  </p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
                  <button
                    onClick={handleExportBackup}
                    className="p-2.5 px-4 rounded-xl bg-slate-905 hover:bg-slate-800 text-slate-700 hover:text-slate-900 border border-slate-200 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4 text-blue-600" />
                    <span>Salvar na Memória Interna</span>
                  </button>

                  <label className="p-2.5 px-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 hover:border-slate-300 transition-all text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-98">
                    <Upload className="w-4 h-4 text-emerald-600" />
                    <span>Restaurar Backup Local</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportBackup}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* 3. CHARTS COLLAPSIBLE PREVIEW */}
            <InventoryCharts products={products} />

            {/* 4. FILTER CONTROLS BAR */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search query input */}
                <div className="relative w-full sm:w-64">
                  <input
                    type="text"
                    className="w-full bg-slate-50 text-slate-850 text-xs rounded-xl border border-slate-200 pl-8 pr-3 py-2.5 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium"
                    placeholder="Buscar produto ou SKU..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>

                {/* Category selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider hidden sm:inline">Setor:</span>
                  <select
                    className="bg-slate-50 text-slate-700 text-xs rounded-xl border border-slate-200 px-3 py-2 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold cursor-pointer"
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    {categoriesList.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level indicators filters */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setStatusFilter('critical')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      statusFilter === 'critical'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                  >
                    Críticos
                  </button>
                  <button
                    onClick={() => setStatusFilter('outofstock')}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      statusFilter === 'outofstock'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                  >
                    Esgotados
                  </button>
                </div>
              </div>

              {/* Add Button */}
              {(currentUserRole === 'Administrador' || currentUserRole === 'Editor') && (
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <button
                    onClick={() => {
                      setSelectedProductForEdit(null);
                      setIsProductModalOpen(true);
                    }}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700/90 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/20 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Novo Produto
                  </button>
                  <button
                    onClick={() => {
                      setSelectedProductForEdit(null);
                      setIsKitModalOpen(true);
                    }}
                    className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/25 shrink-0"
                  >
                    <Layers className="w-4 h-4 text-blue-100 font-bold" />
                    Novo Kit
                  </button>
                </div>
              )}
            </div>

            {/* 5. INVENTORY RESPONSIVE LIST (COMPACT RECTANGLES) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header labels for Desktop only to preserve beautiful column layout */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50/70 border-b border-slate-150 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider font-mono">
                <div className="col-span-2">Cód SKU</div>
                <div className="col-span-6">Especificação / Nome</div>
                <div className="col-span-3">Categoria / Setor</div>
                <div className="col-span-1 text-right">Ação</div>
              </div>

              <div className="divide-y divide-slate-100">
                {dataLoading && products.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-mono">
                    Carregando inventário de produtos...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 font-mono">
                    Nenhum produto cadastrado com os filtros selecionados.
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isOutOfStock = p.quantity === 0;
                    const isCritical = p.quantity > 0 && p.quantity <= p.minQuantity;
                    
                    let statusBadge = (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md inline-block">
                        Ativo
                      </span>
                    );
                    if (isOutOfStock) {
                      statusBadge = (
                        <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md inline-block">
                          Esgotado
                        </span>
                      );
                    } else if (isCritical) {
                      statusBadge = (
                        <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-md inline-block">
                          Crítico
                        </span>
                      );
                    }

                    const isExpanded = !!expandedProductIds[p.id];

                    return (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setExpandedProductIds(prev => ({
                            ...prev,
                            [p.id]: !prev[p.id]
                          }));
                        }}
                        className={`transition-all duration-200 cursor-pointer select-none ${
                          isExpanded 
                            ? 'bg-blue-50/5 hover:bg-blue-50/10' 
                            : 'hover:bg-slate-50/80'
                        }`}
                      >
                        {/* Summary Rectangle (Items Visible: Photo, Name, Category, SKU) */}
                        <div className="p-4 px-6 sm:grid sm:grid-cols-12 items-center gap-4 flex flex-col sm:flex-row justify-between">
                          
                          {/* SKU block */}
                          <div className="w-full sm:col-span-2 font-mono text-xs text-slate-500 font-bold select-all uppercase flex items-center shrink-0">
                            <span className="inline-block sm:hidden text-[9px] text-slate-400 font-sans font-bold uppercase tracking-wider mr-2">CÓD SKU:</span>
                            <span className="px-2 py-0.5 sm:py-1 bg-slate-50 sm:bg-slate-100/60 border border-slate-200/80 rounded-lg">
                              {p.id}
                            </span>
                          </div>

                          {/* Foto & Nome block */}
                          <div className="w-full sm:col-span-6 flex items-center gap-3.5 min-w-0">
                            {/* Product Image */}
                            <div 
                              onClick={(e) => {
                                if (p.imageUrl) {
                                  e.stopPropagation();
                                  setZoomedImage({ url: p.imageUrl, name: p.name });
                                }
                              }}
                              className={`w-10 h-10 rounded-xl overflow-hidden bg-slate-50 border border-slate-150 shrink-0 flex items-center justify-center relative shadow-2xs ${
                                p.imageUrl ? 'cursor-zoom-in hover:scale-110 active:scale-95 transition-all shadow-md' : ''
                              }`}
                              title={p.imageUrl ? 'Clique para ver foto em alta definição' : undefined}
                            >
                              {p.imageUrl ? (
                                <img 
                                  src={p.imageUrl} 
                                  alt={p.name} 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Boxes className="w-4.5 h-4.5 text-slate-400" />
                              )}
                            </div>

                            {/* Product Name */}
                            <div className="min-w-0 flex-1">
                              <h3 className="font-extrabold text-slate-850 text-xs sm:text-sm leading-snug group-hover:text-blue-650 transition-colors font-display flex items-center gap-1.5 truncate" title={p.name}>
                                <span className="truncate">{p.name}</span>
                                {p.isKit && (
                                  <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-blue-700 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 uppercase tracking-wider font-mono shrink-0 shadow-3xs">
                                    <Layers className="w-2.5 h-2.5 shrink-0 text-blue-500 animate-pulse" />
                                    Kit
                                  </span>
                                )}
                              </h3>
                            </div>
                          </div>

                          {/* Category Badge & Expand Chevron Row */}
                          <div className="w-full sm:col-span-4 flex items-center justify-between sm:justify-start gap-4 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
                            {/* Category Badge */}
                            <div>
                              <span className="inline-block sm:hidden text-[9px] text-slate-400 font-sans font-bold uppercase tracking-wider mr-2">CATEGORIA:</span>
                              <span className="text-xs text-slate-600 font-bold bg-slate-100 border border-slate-200/60 rounded-lg px-2.5 py-1">
                                {p.category}
                              </span>
                            </div>

                            {/* Expansion indicators */}
                            <div className="flex items-center gap-2 sm:ml-auto select-none">
                              <span className="hidden md:inline text-[9px] font-extrabold text-blue-500 bg-blue-50 px-2 py-1 rounded-md tracking-wider uppercase">
                                {isExpanded ? 'Ocultar' : 'Detalhes'}
                              </span>
                              <div className="text-slate-400 shrink-0">
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-slate-500" />
                                )}
                              </div>
                            </div>
                          </div>

                        </div>

                        {/* Expandable Content Panel */}
                        {isExpanded && (
                          <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="px-6 pb-6 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4 cursor-default"
                          >
                            {/* Bento detail boxes (grid structure responsive for mobile cards) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                              
                              {/* 1. Availability */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Status & Disponibilidade</h4>
                                <div className="flex items-center justify-between">
                                  <div className="flex flex-col">
                                    <span className={`text-base font-black font-mono ${
                                      isOutOfStock ? 'text-rose-600' : isCritical ? 'text-amber-500' : 'text-slate-800'
                                    }`}>
                                      {p.quantity} <span className="text-xs text-slate-400 font-medium">un</span>
                                    </span>
                                    <span className="text-[9px] text-slate-400 font-medium font-mono">Crit: {p.minQuantity || 0} un</span>
                                  </div>
                                  <div className="shrink-0">
                                    {statusBadge}
                                  </div>
                                </div>
                                
                                <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 font-semibold font-mono truncate">
                                  📍 {p.location ? `Local: ${p.location}` : 'Sem localização cadastrada'}
                                </div>
                              </div>

                              {/* 2. Unit prices */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Valores de Tabela UN</h4>
                                <div className="space-y-1.5 pt-0.5">
                                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 font-mono">
                                    <span className="text-[9px] text-blue-600 font-extrabold bg-blue-50 border border-blue-100/60 px-1.5 py-0.5 rounded">COMPRA</span>
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.price)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs font-semibold text-slate-500 font-mono">
                                    <span className="text-[9px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100/60 px-1.5 py-0.5 rounded font-mono">REVENDA</span>
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.resalePrice || 0)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* 3. Valuation info */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs space-y-2">
                                <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Patrimônio de Estoque</h4>
                                <div className="space-y-1.5 pt-0.5">
                                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 font-mono">
                                    <span className="text-[9px] text-slate-400 uppercase">Val. Compra</span>
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.quantity * p.price)}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs text-slate-600 font-mono">
                                    <span className="text-[9px] text-slate-400 uppercase">Val. Revenda</span>
                                    <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(p.quantity * (p.resalePrice || 0))}</span>
                                  </div>
                                </div>
                              </div>

                              {/* 4. Description */}
                              <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between">
                                <div className="space-y-1">
                                  <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">Observação</h4>
                                  <p className="text-[11px] text-slate-600 italic bg-slate-50 border border-slate-100/80 p-1.5 rounded-lg line-clamp-2" title={p.description || 'Nenhuma observação registrada.'}>
                                    {p.description || 'Sem descrição.'}
                                  </p>
                                </div>
                              </div>

                            </div>

                            {p.isKit && p.kitItems && p.kitItems.length > 0 && (
                              <div className="bg-blue-50/40 border border-blue-100 rounded-xl p-4 space-y-2 mt-2">
                                <h4 className="text-[10px] font-extrabold text-blue-800 uppercase tracking-wider font-mono flex items-center gap-1">
                                  <Layers className="w-3.5 h-3.5" />
                                  Composição do Kit (Peças Constituintes)
                                </h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                  {p.kitItems.map((item) => (
                                    <div key={item.productId} className="bg-white border border-slate-150 p-2.5 rounded-lg flex items-center justify-between shadow-3xs text-xs">
                                      <div className="space-y-0.5 min-w-0 flex-1 pr-1.5">
                                        <p className="font-extrabold text-slate-700 truncate" title={item.productName}>
                                          {item.productName || 'Peça Desconhecida'}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-mono font-bold truncate">SKU: {item.productId}</p>
                                      </div>
                                      <span className="bg-blue-100/80 text-blue-850 text-[10px] font-black font-mono px-2 py-1 rounded shadow-3xs shrink-0">
                                        {item.quantityNeeded} un.
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Operations button controls */}
                            <div className="pt-3 border-t border-slate-150 flex flex-wrap items-center justify-between gap-3">
                              <span className="text-[10px] text-slate-400 font-mono font-bold">
                                SKU ID: <strong className="font-extrabold text-slate-600 select-all">{p.id}</strong>
                              </span>

                              <div className="flex flex-wrap items-center gap-2">
                                {currentUserRole !== 'Administrador' && currentUserRole !== 'Editor' ? (
                                  <span className="text-[10px] text-slate-400 font-bold italic bg-slate-50 border border-slate-100 rounded px-2.5 py-1.5">
                                    Apenas Visualização
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => {
                                        setSelectedProductForTx(p);
                                        setDefaultTxType('IN');
                                        setIsTxModalOpen(true);
                                      }}
                                      translate="no"
                                      className="p-1.5 px-3 rounded-xl bg-blue-50 text-blue-750 hover:bg-blue-600 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer border border-blue-100 shadow-2xs notranslate"
                                    >
                                      Entrada
                                    </button>
                                    
                                    <button
                                      onClick={() => {
                                        setSelectedProductForTx(p);
                                        setDefaultTxType('OUT');
                                        setIsTxModalOpen(true);
                                      }}
                                      disabled={p.quantity === 0}
                                      translate="no"
                                      className="p-1.5 px-3 rounded-xl bg-rose-50 text-rose-750 hover:bg-rose-650 hover:text-white transition-all text-xs font-bold flex items-center gap-1 cursor-pointer border border-rose-100 disabled:opacity-40 disabled:pointer-events-none shadow-2xs notranslate"
                                    >
                                      Saída
                                    </button>

                                    <div className="w-px h-5 bg-slate-200 mx-1" />

                                    <button
                                      onClick={() => {
                                        setSelectedProductForEdit(p);
                                        if (p.isKit) {
                                          setIsKitModalOpen(true);
                                        } else {
                                          setIsProductModalOpen(true);
                                        }
                                      }}
                                      title="Editar Produto"
                                      className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-150/80 text-slate-550 hover:text-slate-800 transition-all cursor-pointer shadow-3xs"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    {currentUserRole !== 'Editor' && (
                                      <button
                                        onClick={() => handleDeleteProduct(p.id, p.name)}
                                        title="Excluir Produto"
                                        className="p-2 rounded-xl bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition-all cursor-pointer shadow-3xs"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'auditoria' && (
          /* AUDIT LEDGER TIMELINE SCREEN */
          <TransactionHistory 
            transactions={transactions} 
            onClearTransactions={handleClearTransactions}
            currentUserRole={currentUserRole}
            onShowAlert={showCustomAlert}
          />
        )}

        {activeTab === 'equipe' && (
          /* TEAM COLLABORATION SCREEN */
          <TeamCollaborationView 
            user={user} 
            teamMembers={teamMembers} 
            currentUserRole={currentUserRole}
            onFirestoreError={handleFirestoreError} 
            onAskConfirmation={askConfirmation}
            onInviteMember={handleInviteMemberLocal}
            onRemoveMember={handleRemoveMemberLocal}
          />
        )}

        {activeTab === 'separacao' && (
          /* ORDER SEPARATION AND PDF GENERATION VIEW */
          <OrderSeparationView 
            products={products}
            user={user}
            currentUserRole={currentUserRole}
            onRecordTransaction={handleRecordTransaction}
            onFirestoreError={handleFirestoreError}
            onAskConfirmation={askConfirmation}
            onShowAlert={showCustomAlert}
          />
        )}
      </main>

      {/* FOOTER */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-medium">
          <p className="font-mono text-[11px]">Gerenciador de Estoque 100% Local © {new Date().getFullYear()}</p>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <UserCheck className="w-4.5 h-4.5 text-blue-600" />
            <span>Processado e Salvo Localmente com Segurança.</span>
          </div>
        </div>
      </footer>

      {/* CONTROL MODALS FOR SAVING OR MOVING PRODUCTS */}
      <ProductFormModal
        isOpen={isProductModalOpen}
        onClose={() => {
          setIsProductModalOpen(false);
          setSelectedProductForEdit(null);
        }}
        onSubmit={handleSaveProduct}
        product={selectedProductForEdit}
      />

      <KitFormModal
        isOpen={isKitModalOpen}
        onClose={() => {
          setIsKitModalOpen(false);
          setSelectedProductForEdit(null);
        }}
        onSubmit={handleSaveProduct}
        product={selectedProductForEdit}
        products={products}
      />

      <TransactionModal
        isOpen={isTxModalOpen}
        onClose={() => {
          setIsTxModalOpen(false);
          setSelectedProductForTx(null);
        }}
        onSubmit={handleRecordTransaction}
        product={selectedProductForTx}
        defaultType={defaultTxType}
      />

      <CustomNotificationModal
        isOpen={customDialog.isOpen}
        title={customDialog.title}
        message={customDialog.message}
        type={customDialog.type}
        confirmLabel={customDialog.confirmLabel}
        cancelLabel={customDialog.cancelLabel}
        isAlertOnly={customDialog.isAlertOnly}
        onConfirm={customDialog.onConfirm}
        onCancel={() => setCustomDialog(prev => ({ ...prev, isOpen: false }))}
      />

      {/* CONFIGURABLE PHOTO LIGHTBOX ZOOM OVERLAY */}
      <AnimatePresence>
        {zoomedImage && (
          <div 
            onClick={() => setZoomedImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.93, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.93, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-md w-full bg-white rounded-2xl overflow-hidden shadow-2xl border border-slate-200 flex flex-col cursor-default"
            >
              {/* Close Button */}
              <button
                onClick={() => setZoomedImage(null)}
                className="absolute top-3.5 right-3.5 p-1.5 bg-slate-900/60 hover:bg-slate-900/85 text-white rounded-full transition-colors z-10 cursor-pointer shadow-md"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="aspect-square w-full bg-slate-50 flex items-center justify-center overflow-hidden">
                <img 
                  src={zoomedImage.url} 
                  alt={zoomedImage.name} 
                  className="w-full h-full object-contain p-2 max-h-[55vh]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
                <div className="min-w-0 pr-4">
                  <h4 className="font-extrabold text-sm sm:text-base font-display truncate" title={zoomedImage.name}>
                    {zoomedImage.name}
                  </h4>
                  <p className="text-[10px] text-slate-450 font-medium tracking-wide uppercase">Foto Ampliada do Inventário</p>
                </div>
                <button
                  onClick={() => setZoomedImage(null)}
                  className="shrink-0 px-4 py-2 bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
