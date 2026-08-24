import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { supabase } from '../services/supabaseClient';
import { adminService as raffleService, adminService } from '../services/adminService';
import { storageService } from '../services/storageService';
import { Raffle, Purchase, Banner, WinningTicket } from '../types';
import { WHITE_LABEL_CONFIG } from '../white-label';
import { 
  LayoutDashboard, 
  Plus, 
  Edit, 
  Trash2, 
  Ticket, 
  DollarSign, 
  Users, 
  LogOut, 
  Save, 
  X,
  Search,
  Trophy,
  Code,
  Loader2,
  Lock,
  Image as ImageIcon,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  AlertTriangle,
  Unlock,
  Gift,
  Eye,
  UserPlus,
  Calendar,
  Filter,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eraser,
  Zap,
  MessageCircle,
  MessageSquare,
  Globe,
  Upload
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { imageSrc, handleImageError } from '../services/imagePlaceholder';

type DateFilter = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

import { AdminSimulation } from './AdminSimulation';

/**
 * Status de compra vem em duas convenções neste banco: a RPC antiga grava
 * 'PENDING' com payment_status nulo, a nova grava 'paid'/'pending' nos dois
 * campos. Comparar direto com 'PAID' fazia toda compra cancelada aparecer como
 * "PENDENTE" na aba de vendas, como se ainda houvesse pagamento a receber.
 */
function isPaidStatus(p: any): boolean {
  return String(p?.payment_status || '').toLowerCase() === 'paid'
    || String(p?.status || '').toLowerCase() === 'paid';
}

function isCancelledStatus(p: any): boolean {
  return String(p?.payment_status || '').toLowerCase() === 'cancelled'
    || String(p?.status || '').toLowerCase() === 'cancelled';
}


const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatIsoToLocalDatetime = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '';
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
        return '';
    }
};

const formatLocalDatetimeToIso = (localStr: string) => {
    if (!localStr) return null;
    try {
        const d = new Date(localStr);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
    } catch {
        return null;
    }
};

export const AdminPanel: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { refreshTheme, brandPrimary: globalBrandPrimary } = useTheme();
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  // Force dark mode
  useEffect(() => {
    document.documentElement.classList.add('admin-force-dark');
    return () => document.documentElement.classList.remove('admin-force-dark');
  }, []);
  
  // Login State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<'dashboard' | 'raffles' | 'tickets' | 'sales' | 'site' | 'users' | 'simulation' | 'search' | 'revelation' | 'suporte' | 'pixels'>('dashboard');
  
  // Support Messages
  const [supportMessages, setSupportMessages] = useState<any[]>([]);
  const [loadingSupport, setLoadingSupport] = useState(false);
  
  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Dashboard Logic
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [stats, setStats] = useState({ 
      totalRevenue: 0, 
      netRevenue: 0,
      totalDepositFees: 0,
      totalWithdrawalFees: 0,
      totalSimplifyFees: 0,
      activeRaffles: 0, 
      salesCount: 0, 
      avgTicket: 0,
      netAvgTicket: 0,
      pendingCount: 0,
      pendingValue: 0,
      salesByRaffle: [] as any[],
      feeSettings: {
        depositFeePercent: 2.50,
        depositFeeMin: 0.50,
        withdrawalFeePercent: 2.00,
        withdrawalFeeMin: 0.50
      }
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Simplify Fee States
  const [showFeeDetailsModal, setShowFeeDetailsModal] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'both' | 'gross' | 'net'>('both');
  const [feeDepositPercent, setFeeDepositPercent] = useState('2.50');
  const [feeDepositMin, setFeeDepositMin] = useState('0.50');
  const [feeWithdrawalPercent, setFeeWithdrawalPercent] = useState('2.00');
  const [feeWithdrawalMin, setFeeWithdrawalMin] = useState('0.50');
  const [savingFeeSettings, setSavingFeeSettings] = useState(false);

  // Users CRM
  const [users, setUsers] = useState<any[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  // Ranking Finalization State
  const [showFinalizeRanking, setShowFinalizeRanking] = useState(false);
  const [currentTopBuyer, setCurrentTopBuyer] = useState<{name: string, phone: string, totalTickets: number, prize: string} | null>(null);

  const handleSortUsers = (key: string) => {
      let direction: 'asc' | 'desc' = 'desc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'desc') {
          direction = 'asc';
      }
      setSortConfig({ key, direction });
  };

  const getSortedUsers = () => {
      let sortedUsers = [...users];
      if (sortConfig) {
          sortedUsers.sort((a, b) => {
              if (a[sortConfig.key] < b[sortConfig.key]) {
                  return sortConfig.direction === 'asc' ? -1 : 1;
              }
              if (a[sortConfig.key] > b[sortConfig.key]) {
                  return sortConfig.direction === 'asc' ? 1 : -1;
              }
              return 0;
          });
      }
      return sortedUsers;
  };

  // Raffle Form
  const [isEditing, setIsEditing] = useState<Raffle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [savingRaffle, setSavingRaffle] = useState(false);
  const [manualProgressPercent, setManualProgressPercent] = useState<number | string>('');

  // Winning Tickets State
  const [winningTickets, setWinningTickets] = useState<WinningTicket[]>([]);
  const [newWinningTicket, setNewWinningTicket] = useState({ number: '', prize: '' });
  
  // Manual Winner Assignment State (Inside Raffle Edit)
  const [assigningWinner, setAssigningWinner] = useState<WinningTicket | null>(null);
  const [assignForm, setAssignForm] = useState({ name: '', cpf: '', phone: '', imageFile: null as File | null });

  // Manual Ranking (Fake Buyers)
  const [manualRanking, setManualRanking] = useState<{ name: string; phone: string; totalTickets: number }[]>([]);
  const [newManualBuyer, setNewManualBuyer] = useState({ name: '', phone: '', totalTickets: '' });

  const handleAddManualBuyer = () => {
      if (!newManualBuyer.name || !newManualBuyer.totalTickets) return alert('Preencha nome e quantidade.');
      setManualRanking([...manualRanking, { 
          name: newManualBuyer.name, 
          phone: newManualBuyer.phone, 
          totalTickets: parseInt(newManualBuyer.totalTickets) 
      }]);
      setNewManualBuyer({ name: '', phone: '', totalTickets: '' });
  };

  const handleRemoveManualBuyer = (index: number) => {
      const updated = [...manualRanking];
      updated.splice(index, 1);
      setManualRanking(updated);
  };

  // Ticket Manager (Search & Manual Creation)
  const [searchTicket, setSearchTicket] = useState({ raffleId: '', number: '' });
  const [foundTicket, setFoundTicket] = useState<any>(null);
  
  // Unified Ticket Assignment State
  const [assignCpf, setAssignCpf] = useState('');
  const [assignName, setAssignName] = useState('');

  // Universal Search State
  const [universalSearchTerm, setUniversalSearchTerm] = useState('');
  const [universalSearchResults, setUniversalSearchResults] = useState<any[]>([]);
  const [isSearchingUniversal, setIsSearchingUniversal] = useState(false);
  const [searchedUniversal, setSearchedUniversal] = useState(false);
  const [editingPurchaseDate, setEditingPurchaseDate] = useState<string | null>(null);
  const [newPurchaseDateValue, setNewPurchaseDateValue] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  
  // Revelation State
  const [revelationRaffleId, setRevelationRaffleId] = useState('');
  const [revelationTicketNumber, setRevelationTicketNumber] = useState('');
  const [revelationResult, setRevelationResult] = useState<any>(null);

  // Register Winner State
  const [showRegisterWinnerForm, setShowRegisterWinnerForm] = useState(false);
  const [registerWinnerForm, setRegisterWinnerForm] = useState({ prizeType: 'rifa', prizeDescription: '', prizeValue: '', imageFile: null as File | null, imageUrl: '', winnerName: '', winnerPhone: '' });
  const [isRegisteringWinner, setIsRegisteringWinner] = useState(false);

  const [isRevealing, setIsRevealing] = useState(false);
  const [hasRevealed, setHasRevealed] = useState(false);
  const [assignPhone, setAssignPhone] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [cpfChecked, setCpfChecked] = useState(false);
  const [hasPurchase, setHasPurchase] = useState(false);

  // Sales Manager
  const [purchases, setPurchases] = useState<any[]>([]);
  const [editPurchase, setEditPurchase] = useState<any>(null);
  const [viewingPurchaseTickets, setViewingPurchaseTickets] = useState<{numbers: number[], info: any} | null>(null);

  // Site Settings & Favicon State
  const [isSavingSite, setIsSavingSite] = useState(false);
  const [siteTitle, setSiteTitle] = useState('Nova Plataforma');
  const [siteDescription, setSiteDescription] = useState('Sua sorte está aqui! Concorra a prêmios incríveis, carros, motos e Pix com total transparência e entrega garantida. Adquira suas cotas na Nova Plataforma!');
  const [brandPrimary, setBrandPrimary] = useState(WHITE_LABEL_CONFIG.brandPrimary);
  const [brandSecondary, setBrandSecondary] = useState(WHITE_LABEL_CONFIG.brandSecondary);
  const [siteTheme, setSiteTheme] = useState(WHITE_LABEL_CONFIG.theme);
  const [siteMode, setSiteMode] = useState(WHITE_LABEL_CONFIG.mode);
  const [siteFavicon, setSiteFavicon] = useState('');
  const [siteOgImage, setSiteOgImage] = useState('');
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationMin, setNotificationMin] = useState(20);
  const [notificationMax, setNotificationMax] = useState(500);
  const [savingSiteSettings, setSavingSiteSettings] = useState(false);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [isUploadingOgImage, setIsUploadingOgImage] = useState(false);
  
  // Sales Filters
  const [salesFilterStatus, setSalesFilterStatus] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [salesSort, setSalesSort] = useState<'DATE_DESC' | 'QTY_DESC' | 'QTY_ASC'>('DATE_DESC');
  const [salesPage, setSalesPage] = useState(1);
  const [salesSearch, setSalesSearch] = useState('');
  const ITEMS_PER_PAGE = 50;

  // Leads Filters (extending existing sortConfig)
  const [leadsFilterStatus, setLeadsFilterStatus] = useState<'ALL' | 'VIP' | 'CLIENTE' | 'QUENTE' | 'FRIO'>('ALL');
  const [leadsPage, setLeadsPage] = useState(1);

  const getFilteredAndSortedPurchases = () => {
      let result = [...purchases];

      // Filter
      if (salesSearch) {
          const lower = salesSearch.toLowerCase();
          result = result.filter(p => p.name?.toLowerCase().includes(lower) || p.cpf?.includes(lower));
      }
      if (salesFilterStatus !== 'ALL') {
          result = result.filter(p => p.status === salesFilterStatus);
      }

      // Sort
      result.sort((a, b) => {
          if (salesSort === 'DATE_DESC') {
              return new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime();
          }
          if (salesSort === 'QTY_DESC') {
              return b.quantity - a.quantity;
          }
          if (salesSort === 'QTY_ASC') {
              return a.quantity - b.quantity;
          }
          return 0;
      });

      const totalPages = Math.ceil(result.length / ITEMS_PER_PAGE);
      const startIndex = (salesPage - 1) * ITEMS_PER_PAGE;
      const paginatedItems = result.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      return { items: paginatedItems, totalPages };
  };

  const getFilteredAndSortedUsers = () => {
      let result = [...users];

      // Filter by Search
      if (searchUser) {
          const lower = searchUser.toLowerCase();
          result = result.filter(u => u.name?.toLowerCase().includes(lower) || u.cpf?.includes(lower));
      }

      // Filter by Status
      if (leadsFilterStatus !== 'ALL') {
          result = result.filter(u => u.status === leadsFilterStatus);
      }

      // Sort (using existing sortConfig)
      if (sortConfig) {
          result.sort((a, b) => {
              let valA = a[sortConfig.key];
              let valB = b[sortConfig.key];
              
              if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
              if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
              return 0;
          });
      }

      const totalPages = Math.ceil(result.length / ITEMS_PER_PAGE);
      const startIndex = (leadsPage - 1) * ITEMS_PER_PAGE;
      const paginatedItems = result.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      return { items: paginatedItems, totalPages };
  };
  const [banners, setBanners] = useState<any[]>([]);
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // --- Input Formatters ---
  const formatCPF = (val?: string | null) => {
    if (!val) return '';
    let value = String(val).replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    return value;
  };

  const formatPhone = (val?: string | null) => {
    if (!val) return '';
    let value = String(val).replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    return value;
  };

  const formatName = (val?: string | null) => {
    if (!val) return '';
    return String(val).replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '');
  };

  const getTabTitle = (tab?: string) => {
    if (!tab) return 'Painel';
    const tabTitles: Record<string, string> = {
      dashboard: 'Faturamento',
      raffles: 'Rifas',
      tickets: 'Editor de Bilhetes',
      sales: 'Gerenciador de Vendas',
      site: 'Configurações do Site',
      users: 'Base de Leads (CRM)',
      simulation: 'Simulador',
      history: 'Auditoria',
      search: 'Pesquisa Universal',
      revelation: 'Revelar Ganhador',
      suporte: 'Mensagens de Suporte (Atendimento)',
      pixels: 'Meta Pixels',
    };
    return tabTitles[tab] || tab;
  };

  useEffect(() => {
    if (activeTab === 'suporte') {
      setLoadingSupport(true);
      raffleService.getSupportMessages().then(msgs => {
        setSupportMessages(msgs);
        setLoadingSupport(false);
      }).catch(err => {
        console.error("Error loading support messages:", err);
        setSupportMessages([]);
        setLoadingSupport(false);
      });
    }
  }, [activeTab]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session && activeTab === 'dashboard') {
      loadDashboardWithFilters();
    }
  }, [session, activeTab, dateFilter, customStart, customEnd]); // Reload when filters change

  const loadDashboardWithFilters = async () => {
    setLoadingData(true);
    try {
        // Calculate date ranges
        const now = new Date();
        let start: Date | null = null;
        let end: Date | null = new Date(); // Default end is now

        switch (dateFilter) {
            case 'today':
                start = new Date();
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);
                break;
            case 'yesterday':
                start = new Date();
                start.setDate(start.getDate() - 1);
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setHours(23, 59, 59, 999);
                break;
            case '7days':
                start = new Date();
                start.setDate(start.getDate() - 7);
                start.setHours(0, 0, 0, 0);
                break;
            case '30days':
                start = new Date();
                start.setDate(start.getDate() - 30);
                start.setHours(0, 0, 0, 0);
                break;
            case 'custom':
                if (customStart) start = new Date(customStart + 'T00:00:00');
                if (customEnd) end = new Date(customEnd + 'T23:59:59');
                break;
            case 'all':
                start = null;
                end = null;
                break;
        }

        const sISO = start ? start.toISOString() : null;
        const eISO = end ? end.toISOString() : null;

        const data = await raffleService.getDashboardStats(sISO, eISO);
        setStats({
            totalRevenue: data.totalRevenue,
            netRevenue: data.netRevenue,
            totalDepositFees: data.totalDepositFees,
            totalWithdrawalFees: data.totalWithdrawalFees,
            totalSimplifyFees: data.totalSimplifyFees,
            activeRaffles: data.activeRaffles,
            salesCount: data.salesCount,
            avgTicket: data.avgTicket,
            netAvgTicket: data.netAvgTicket,
            pendingCount: data.pendingCount,
            pendingValue: data.pendingValue,
            salesByRaffle: data.salesByRaffle,
            feeSettings: data.feeSettings || stats.feeSettings
        });
        if (data.feeSettings) {
          setFeeDepositPercent(String(data.feeSettings.depositFeePercent ?? '2.50'));
          setFeeDepositMin(String(data.feeSettings.depositFeeMin ?? '0.50'));
          setFeeWithdrawalPercent(String(data.feeSettings.withdrawalFeePercent ?? '2.00'));
          setFeeWithdrawalMin(String(data.feeSettings.withdrawalFeeMin ?? '0.50'));
        }
        setChartData(data.chartData);

        // Also refresh raffle list for the management part
        const r = await raffleService.getAllRaffles();
        setRaffles(r);

    } catch (error) {
        console.error("Erro ao carregar dashboard", error);
    } finally {
        setLoadingData(false);
    }
  };

  // --- TAB LOADERS ---
  // Winners State
  const [winners, setWinners] = useState<any[]>([]);
  const loadWinners = async () => {
      setLoadingData(true);
      try {
          const data = await adminService.adminGetWinners();
          setWinners(data);
      } catch(e) { console.error(e); }
      finally { setLoadingData(false); }
  };

  useEffect(() => {
      if(!session) return;
      if (activeTab === 'sales') loadPurchases();
      if (activeTab === 'users') loadUsers();
      if (activeTab === 'winners' as any) loadWinners();
      if (activeTab === 'site') loadBanners();
      // (o log de auditoria fica no SuperAdminPanel; nao existe aba 'history' aqui)
      if (activeTab === 'raffles') loadRaffles();
  }, [activeTab]);

  
  // Pixels State
  const [pixelsList, setPixelsList] = useState<any[]>([]);

  const loadPixels = async () => {
    try {
      const data = await adminService.adminGetMetaPixels();
      setPixelsList(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (activeTab === 'pixels') loadPixels();
  }, [activeTab]);

  const loadRaffles = async () => {
      setLoadingData(true);
      try {
          const r = await raffleService.getAllRaffles();
          setRaffles(r);
      } catch (error) {
          console.error("Erro ao carregar rifas", error);
      } finally {
          setLoadingData(false);
      }
  };

  const loadAuditLogs = async () => {
      setLoadingData(true);
      try {
          const data = await raffleService.getAuditLogs(false); // false = only visible logs
          setAuditLogs(data);
      } catch(e) { console.error(e); }
      finally { setLoadingData(false); }
  };

  const loadUsers = async () => {
      setLoadingData(true);
      try {
          const data = await raffleService.getUsersCRM();
          setUsers(data);
      } catch(e) { console.error(e); }
      finally { setLoadingData(false); }
  };

  const handleExportUsers = () => {
      const headers = ['Nome,CPF,Telefone,Status,Total Gasto,Compras Realizadas,Pendencias'];
      const rows = users.map(u => [
          `"${u.name}"`,
          `"${u.cpf}"`,
          `"${u.phone}"`,
          u.status,
          Number(u.totalSpent || 0).toFixed(2),
          u.purchaseCount,
          u.pendingCount
      ].join(','));

      const csvContent = "data:text/csv;charset=utf-8," + headers.concat(rows).join("\n");
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "base_de_leads.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const loadPurchases = async () => {
      setLoadingData(true);
      try {
          const data = await raffleService.adminGetAllPurchases(5000);
          setPurchases(data || []);
      } catch(e) { console.error(e); } 
      finally { setLoadingData(false); }
  };

  const loadBanners = async () => {
      try {
          const data = await raffleService.adminGetBanners();
          setBanners(data);

          const settings = await raffleService.getSiteSettings();
          if (settings) {
              setSiteTitle(settings.siteTitle || 'Nova Plataforma');
              setSiteDescription(settings.siteDescription || 'Sua sorte está aqui! Concorra a prêmios incríveis, carros, motos e Pix com total transparência e entrega garantida. Adquira suas cotas na Nova Plataforma!');
              setBrandPrimary(settings.brandPrimary || WHITE_LABEL_CONFIG.brandPrimary);
              setBrandSecondary(settings.brandSecondary !== undefined ? settings.brandSecondary : WHITE_LABEL_CONFIG.brandSecondary);
              setSiteTheme(settings.siteTheme || WHITE_LABEL_CONFIG.theme);
          setSiteMode(settings.siteMode || WHITE_LABEL_CONFIG.mode);
              setSiteFavicon(settings.siteFavicon || '');
              setSiteOgImage(settings.siteOgImage || '');
              setNotificationEnabled(settings.notificationEnabled !== undefined ? settings.notificationEnabled : true);
              setNotificationMin(settings.notificationMin ?? 20);
              setNotificationMax(settings.notificationMax ?? 500);
          }
      } catch(e) { console.error(e); }
  };

  const loadWinningTickets = async (raffleId: string) => {
      try {
          const tickets = await raffleService.adminGetWinningTickets(raffleId);
          setWinningTickets(tickets);
      } catch (e) { console.error(e); }
  };

  // Ranking Config State
  const [rankingConfig, setRankingConfig] = useState<{ position: number; prize: string }[]>([]);
  const [newRankingItem, setNewRankingItem] = useState({ position: '', prize: '' });

  const handleAddRankingItem = () => {
      if (!newRankingItem.position || !newRankingItem.prize) return alert('Preencha a posição e o prêmio.');
      const pos = parseInt(newRankingItem.position);
      if (rankingConfig.some(r => r.position === pos)) return alert('Posição já configurada.');
      
      setRankingConfig(prev => [...prev, { position: pos, prize: newRankingItem.prize }].sort((a, b) => a.position - b.position));
      setNewRankingItem({ position: '', prize: '' });
  };

  const handleRemoveRankingItem = (pos: number) => {
      setRankingConfig(prev => prev.filter(r => r.position !== pos));
  };

  // --- HELPERS ---
  const handleOpenEdit = (raffle: Raffle) => {
      setIsEditing(raffle);
      setIsCreating(false);
      setFormData(raffle);
      setRankingConfig(raffle.rankingConfig || []); // Load ranking config
      setManualRanking(raffle.manualRanking || []); // Load manual ranking
      loadWinningTickets(raffle.id);
      
      // Calculate current visible percentage
      const currentSold = Math.max(raffle.soldNumbers, raffle.fakeSoldNumbers || 0);
      const percent = Math.floor((currentSold / raffle.totalNumbers) * 100);
      setManualProgressPercent(percent);
  };

  const handleOpenCreate = () => {
      setIsCreating(true);
      setIsEditing(null);
      setWinningTickets([]);
      setRankingConfig([]); // Reset ranking config
      setManualRanking([]); // Reset manual ranking
      setFormData({ totalNumbers: 1000, pricePerNumber: 0.99, minPurchase: 1 });
      setManualProgressPercent(0);
  };

  // --- ACTIONS ---

  const handleInitiateFinalizeRanking = async () => {
      if (!isEditing) return;
      
      try {
          // Fetch current ranking (limit 1)
          const ranking = await raffleService.getRaffleRanking(isEditing.id, 1);
          
          if (ranking.length > 0) {
              const winner = ranking[0];
              // Find prize for position 1
              const prizeConfig = rankingConfig.find(c => c.position === 1);
              const prize = prizeConfig ? prizeConfig.prize : 'Prêmio não definido';
              
              setCurrentTopBuyer({
                  name: winner.name,
                  phone: winner.phone,
                  totalTickets: winner.totalTickets,
                  prize: prize
              });
          } else {
              // No sales yet?
              setCurrentTopBuyer({
                  name: 'Ninguém',
                  phone: '',
                  totalTickets: 0,
                  prize: 'Nenhum'
              });
          }
          setShowFinalizeRanking(true);
      } catch (error) {
          alert('Erro ao buscar ranking atual.');
      }
  };

  const handleConfirmFinalizeRanking = async () => {
      if (!isEditing || !currentTopBuyer) return;
      
      try {
          if (currentTopBuyer.totalTickets > 0) {
              await raffleService.finalizeRankingCycle(isEditing.id, currentTopBuyer);
              alert('Ciclo finalizado! Ganhador salvo no histórico e ranking reiniciado.');
          } else {
              // Just reset date if no winner AND clear manual ranking
              const { error } = await supabase
                .from('raffles')
                .update({ 
                    ranking_start_date: new Date().toISOString(),
                    manual_ranking: [] // Clear fake buyers
                })
                .eq('id', isEditing.id);
                
              if (error) throw error;
              
              alert('Ranking reiniciado (sem ganhador salvo pois não houve vendas).');
          }
          
          // Clear local state immediately
          setManualRanking([]);
          setFormData((prev: any) => ({ ...prev, manualRanking: [] }));
          
          setShowFinalizeRanking(false);
          setIsEditing(null);
          setIsCreating(false);
          // Force reload to ensure fresh data
          window.location.reload();
      } catch (error) {
          console.error(error);
          alert('Erro ao finalizar ciclo.');
      }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Email ou senha inválidos.');
    setLoggingIn(false);
  };

  const handleSaveRaffle = async (e: React.FormEvent) => {
      e.preventDefault();

      // Manual Validation
      if (!formData.name) {
          return alert('Por favor, preencha o Nome da Campanha.');
      }
      if (!formData.description) {
          return alert('Por favor, preencha o Subtítulo (Curto).');
      }
      if (!formData.fullDescription) {
          return alert('Por favor, preencha a Descrição Detalhada.');
      }
      if (formData.pricePerNumber === undefined || formData.pricePerNumber === null || formData.pricePerNumber === '') {
          return alert('Por favor, preencha o Preço por Cota.');
      }
      if (formData.minPurchase === undefined || formData.minPurchase === null || formData.minPurchase === '') {
          return alert('Por favor, preencha a Compra Mínima de Cotas.');
      }
      if (formData.totalNumbers === undefined || formData.totalNumbers === null || formData.totalNumbers === '') {
          return alert('Por favor, preencha o Total de Números.');
      }


      setSavingRaffle(true);
      try {
          // Calculate fake sold numbers based on percentage input
          const percent = parseFloat(manualProgressPercent.toString()) || 0;
          const total = parseInt(formData.totalNumbers) || 0;
          
          if (total <= 0) {
            throw new Error("O total de números deve ser maior que zero.");
          }

          const fakeSold = Math.floor((percent / 100) * total);
          console.log("PAYLOAD SIZE:", JSON.stringify(formData).length); const payload = {
            ...formData,
            fakeSoldNumbers: fakeSold,
            rankingConfig: rankingConfig, // Add ranking config
            manualRanking: manualRanking, // Add manual ranking
            isFeatured: formData.isFeatured ?? false,
            totalNumbers: total,
            pricePerNumber: parseFloat(formData.pricePerNumber),
            minPurchase: parseInt(formData.minPurchase),
            drawDate: formData.drawDate || null,
            rankingStartDate: formData.rankingStartDate || null,
            rankingEndDate: formData.rankingEndDate || null,
            showPromoBanner: formData.showPromoBanner ?? true,
            promoBannerTitle: formData.promoBannerTitle || null,
            promoBannerSubtitle: formData.promoBannerSubtitle || null,
            showRanking: formData.showRanking ?? true,
            rankingMinValue: formData.rankingMinValue || null,
            termsAndRules: formData.termsAndRules || null,
            securityMarginPercent: formData.securityMarginPercent || 0
          };

          if (isCreating) {
              const result = await raffleService.createRaffle(payload);
              const newRaffleId = result?.id || (Array.isArray(result) ? result[0]?.id : null);
              if (newRaffleId && winningTickets.length > 0) {
                 for (const wt of winningTickets) {
                     await raffleService.adminCreateWinningTicket(newRaffleId, wt.ticketNumber, wt.prizeDescription);
                     if (wt.isActive === false) {
                         const createdList = await raffleService.getWinningTickets(newRaffleId);
                         const created = createdList.find((c: any) => c.ticketNumber === wt.ticketNumber);
                         if (created) {
                             await raffleService.adminToggleWinningTicket(created.id, false);
                         }
                     }
                 }
              }
          } else if (isEditing) {
              const updates = {
                  name: formData.name,
                  description: formData.description,
                  fullDescription: formData.fullDescription,
                  imageUrl: formData.imageUrl,
                  pricePerNumber: parseFloat(formData.pricePerNumber),
                  minPurchase: parseInt(formData.minPurchase),
                  status: formData.status,
                  fakeSoldNumbers: fakeSold,
                  winnerNumber: formData.winnerNumber || null,
                  winnerName: formData.winnerName || null,
                  rankingConfig: rankingConfig, // Add ranking config
                  manualRanking: manualRanking, // Add manual ranking
                  isFeatured: formData.isFeatured ?? false,
                  drawDate: formData.drawDate || null,
                  rankingStartDate: formData.rankingStartDate || null,
                  rankingEndDate: formData.rankingEndDate || null,
                  showPromoBanner: formData.showPromoBanner ?? true,
                  promoBannerTitle: formData.promoBannerTitle || null,
                  promoBannerSubtitle: formData.promoBannerSubtitle || null,
                  showRanking: formData.showRanking ?? true,
                  rankingMinValue: formData.rankingMinValue || null,
                  termsAndRules: formData.termsAndRules || null,
                  securityMarginPercent: formData.securityMarginPercent || 0
              };
              const result = await raffleService.updateRaffle(isEditing.id, updates);
          }
          alert('Rifa salva com sucesso!');
          setIsCreating(false);
          setIsEditing(null);
          setFormData({});
          loadDashboardWithFilters(); // Refresh
      } catch (err: any) {
          console.error(err);
          alert(`Erro ao salvar rifa: ${err.message || 'Erro desconhecido'}.`);
      } finally {
          setSavingRaffle(false);
      }
  };

  const handleAddWinningTicket = async () => {
      if (!newWinningTicket.number || !newWinningTicket.prize) return alert('Preencha o número e o prêmio.');
      
      if (isCreating) {
          setWinningTickets([...winningTickets, {
              id: Math.random().toString(),
              raffleId: 'temp',
              ticketNumber: parseInt(newWinningTicket.number),
              prizeDescription: newWinningTicket.prize,
              isActive: true,
              won: false
          } as any]);
          setNewWinningTicket({ number: '', prize: '' });
          return;
      }
      
      try {
          await raffleService.adminCreateWinningTicket(isEditing!.id, parseInt(newWinningTicket.number), newWinningTicket.prize);
          setNewWinningTicket({ number: '', prize: '' });
          loadWinningTickets(isEditing!.id);
      } catch(e: any) { 
         alert('Erro ao criar bilhete premiado: ' + e.message);
      }
  };

  const handleToggleWinningTicket = async (id: string, currentStatus: boolean) => {
      if (isCreating) {
          setWinningTickets(winningTickets.map(wt => wt.id === id ? { ...wt, isActive: !currentStatus } : wt));
          return;
      }
      try {
          await raffleService.adminToggleWinningTicket(id, !currentStatus);
          loadWinningTickets(isEditing!.id);
      } catch(e: any) {
          alert('Erro: ' + e.message);
      }
  };

  const handleDeleteWinningTicket = async (id: string) => {
      if(!confirm('Remover este bilhete premiado?')) return;
      if (isCreating) {
          setWinningTickets(winningTickets.filter(wt => wt.id !== id));
          return;
      }
      try {
          await raffleService.adminDeleteWinningTicket(id);
          loadWinningTickets(isEditing!.id);
      } catch(e: any) { 
         alert('Erro: ' + e.message);
      }
  };

  const handleOpenAssignWinner = (ticket: WinningTicket) => {
    setAssigningWinner(ticket);
    setAssignForm({ name: '', cpf: '', phone: '', imageFile: null });
  };

  const handleCheckAssignCpf = async () => {
    if (!assignForm.cpf || assignForm.cpf.length < 11) return alert('CPF inválido');
    try {
        const info = await raffleService.checkCpfInfo(assignForm.cpf);
        if (info.exists) {
            setAssignForm({
                ...assignForm,
                name: info.name || '',
                phone: info.phone || ''
            });
        } else {
            alert('Usuário não encontrado.');
        }
    } catch (e: any) {
        alert('Erro ao buscar CPF: ' + e.message);
    }
  };

  const handleSubmitAssignWinner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.name) return alert('Por favor, preencha o nome do ganhador.');

    if (!assigningWinner || !isEditing) return;
    
    try {
        let imageUrl = '';
        if (assignForm.imageFile) {
            imageUrl = await storageService.uploadImage(assignForm.imageFile, 'winners' as any);
        }

        await raffleService.adminManualAssignWinner(
            assigningWinner.id,
            isEditing.id,
            assigningWinner.ticketNumber,
            assignForm.name,
            assignForm.cpf,
            assignForm.phone,
            imageUrl
        );
        alert(`Sucesso! O bilhete ${assigningWinner.ticketNumber} foi atribuído a ${assignForm.name}.`);
        setAssigningWinner(null);
        loadWinningTickets(isEditing.id);
    } catch(e: any) {
        alert('Erro ao atribuir ganhador: ' + e.message);
    }
  };

  const handleDeleteRaffle = async (id: string) => {
      if(!confirm('ATENÇÃO: Deletar uma rifa apaga todo histórico de vendas, bilhetes e prêmios dela. Essa ação é irreversível. Confirmar?')) return;
      
      try {
          // A imagem no Storage e as tabelas dependentes são removidas no
          // servidor, com a service role. Esta chamada era feita aqui com a
          // chave anon e sem catch: bastava ela falhar para a rifa nunca ser
          // excluída.
          await raffleService.deleteRaffle(id);

          alert('Rifa e todos os dados vinculados foram deletados com sucesso.');
          loadDashboardWithFilters();
      } catch (e: any) {
          alert(e.message);
      }
  };

  const handleClearTickets = async (raffle: any) => {
      if (raffle.status !== 'FINISHED') {
          alert('Apenas rifas finalizadas podem ter seus bilhetes limpos.');
          return;
      }
      if(!confirm(`ATENÇÃO: Isso apagará todos os números de bilhetes gerados para a rifa "${raffle.name}". As compras continuarão existindo, mas os clientes não verão mais os números na aba "Meus Bilhetes". Essa ação é irreversível e ajuda a liberar espaço no banco de dados. Confirmar limpeza?`)) return;
      
      setLoadingData(true);
      try {
          await raffleService.adminClearRaffleTickets(raffle.id);
          alert('Bilhetes limpos com sucesso!');
      } catch (error: any) {
          alert('Erro ao limpar bilhetes: ' + error.message);
      } finally {
          setLoadingData(false);
      }
  };

  const handleSearchTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      setFoundTicket(null);
      setAssignCpf('');
      setCpfChecked(false);
      const { data, error } = await raffleService.getTicketOwner(searchTicket.raffleId, parseInt(searchTicket.number));
      if(error || !data) setFoundTicket({ error: 'Bilhete não encontrado.', number: searchTicket.number });
      else setFoundTicket(data);
  };

  const handleCheckCpf = async () => {
      if (!assignCpf || assignCpf.length < 11) return alert('CPF inválido');
      try {
          const info = await raffleService.checkCpfInfo(assignCpf, searchTicket.raffleId);
          setCpfChecked(true);
          setHasPurchase(info.hasPurchaseInRaffle || false);
          if (info.exists) {
              setAssignName(info.name || '');
              setAssignPhone(info.phone || '');
          } else {
              setAssignName('');
              setAssignPhone('');
          }
      } catch (e: any) {
          alert('Erro ao verificar CPF: ' + e.message);
      }
  };

  const handleAssignTicket = async () => {
      if (!assignCpf || assignCpf.length < 11) return alert('CPF inválido');
      if (!hasPurchase && (!assignName || !assignPhone)) return alert('Nome e telefone são obrigatórios para novos clientes.');
      
      try {
          await raffleService.adminProcessTicketAssignment(
              searchTicket.raffleId,
              parseInt(searchTicket.number),
              assignCpf,
              assignName,
              assignPhone,
              assignDate
          );
          alert('Bilhete processado com sucesso!');
          
          // Reset and refresh
          setAssignCpf('');
          setCpfChecked(false);
          setAssignName('');
          setAssignPhone('');
          setAssignDate('');
          
          // Refresh search
          const { data, error } = await raffleService.getTicketOwner(searchTicket.raffleId, parseInt(searchTicket.number));
          if(error || !data) setFoundTicket({ error: 'Bilhete não encontrado.', number: searchTicket.number });
          else setFoundTicket(data);

      } catch(e: any) {
          alert('Erro ao processar bilhete: ' + e.message);
      }
  };

  const handleUniversalSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!universalSearchTerm.trim()) return;
      
      setIsSearchingUniversal(true);
      setUniversalSearchResults([]);
      setEditingPurchaseDate(null);
      setNewPurchaseDateValue('');
      setActionPassword('');
      try {
          const term = universalSearchTerm.trim();
          let query = supabase
              .from('purchases')
              .select('*, raffles(name)');
              
          // Check if it's a ticket number (only digits)
          if (/^\d+$/.test(term)) {
              // Search by ticket number
              const { data: ticketsData } = await supabase
                  .from('raffle_ticket_pool')
                  .select('purchase_id')
                  .eq('ticket_number', parseInt(term));
                  
              if (ticketsData && ticketsData.length > 0) {
                  const purchaseIds = ticketsData.map(t => t.purchase_id);
                  query = query.in('id', purchaseIds);
              } else {
                  // Fallback: search by CPF or Name just in case it's a numeric name/cpf
                  query = query.or(`buyer_cpf.ilike.%${term}%,buyer_name.ilike.%${term}%`);
              }
          } else {
              // Search by CPF or Name
              query = query.or(`buyer_cpf.ilike.%${term}%,buyer_name.ilike.%${term}%`);
          }
          
          const { data, error } = await query.order('created_at', { ascending: false }).limit(20);
          
          if (error) throw error;
          
          // Fetch tickets for each purchase
          const resultsWithTickets = await Promise.all((data || []).map(async (purchase) => {
              const { data: ticketsData } = await supabase
                  .from('raffle_ticket_pool')
                  .select('ticket_number')
                  .eq('purchase_id', purchase.id);
              return {
                  ...purchase,
                  tickets: ticketsData?.map(t => t.ticket_number) || []
              };
          }));
          
          setUniversalSearchResults(resultsWithTickets);
          setSearchedUniversal(true);
      } catch (err: any) {
          alert('Erro na busca: ' + err.message);
      } finally {
          setIsSearchingUniversal(false);
      }
  };

  const handleUpdateUniversalPurchaseDate = async (purchaseId: string) => {
      if (!newPurchaseDateValue) return;
      if (!actionPassword) {
          alert('Digite a Senha Mestra para confirmar a ação.');
          return;
      }
      if (!confirm('Tem certeza que deseja alterar a data desta compra?')) return;
      
      try {
          const isPasswordValid = await raffleService.verifyMasterPassword(actionPassword);
          if (!isPasswordValid) {
              alert('Senha mestra incorreta.');
              return;
          }

          await raffleService.adminUpdatePurchase(purchaseId, {
              purchase_date: new Date(newPurchaseDateValue).toISOString()
          });
          
          const adminEmail = session?.user?.email || 'admin';
          await raffleService.logAuditAction(
              adminEmail,
              'EDIÇÃO DE DATA',
              `Alterou a data da compra ID: ${purchaseId} para ${new Date(newPurchaseDateValue).toLocaleString()}`
          );

          alert('Data da compra atualizada com sucesso!');
          setEditingPurchaseDate(null);
          setNewPurchaseDateValue('');
          setActionPassword('');
          
          // Refresh search
          const e = { preventDefault: () => {} } as React.FormEvent;
          handleUniversalSearch(e);
      } catch (e: any) {
          alert('Erro ao atualizar data: ' + e.message);
      }
  };

  const handleRevealWinner = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!revelationRaffleId) return alert('Por favor, selecione uma rifa.');
      if (!revelationTicketNumber) return alert('Por favor, preencha o número do bilhete.');
      
      setIsRevealing(true);
      setHasRevealed(false);
      setRevelationResult(null);
      
      try {
          const ticketNum = parseInt(revelationTicketNumber);
          const { data, error } = await raffleService.getTicketOwner(revelationRaffleId, ticketNum);
          
          if (error || !data) {
              setRevelationResult({
                  found: false,
                  message: 'Nenhum participante encontrado para este número.'
              });
          } else {
              // Fetch all tickets for this purchase to display
              const { data: allTicketsData } = await supabase
                  .from('raffle_ticket_pool')
                  .select('ticket_number')
                  .eq('purchase_id', data.purchase_id);
                  
              setRevelationResult({
                  found: true,
                  buyerId: data.userId || null,
                  buyerName: data.name || 'Desconhecido',
                  buyerCpf: data.cpf || '',
                  buyerPhone: data.phone || '',
                  purchaseDate: data.purchaseDate || new Date().toISOString(),
                  winningTicket: ticketNum,
                  allTickets: allTicketsData?.map(t => t.ticket_number).sort((a, b) => a - b) || []
              });
          }
          setHasRevealed(true);
      } catch (err: any) {
          alert('Erro ao buscar ganhador: ' + err.message);
      } finally {
          setIsRevealing(false);
      }
  };

  const handleRegisterWinnerSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!revelationResult) return;

      if (!registerWinnerForm.prizeDescription) return alert('Por favor, informe a descrição do prêmio.');
      
      const isManual = !revelationResult.found;
      if (isManual && !registerWinnerForm.winnerName) {
          return alert('Por favor, informe o nome do ganhador.');
      }

      setIsRegisteringWinner(true);
      try {
          // Upload Image (Optional)
          let imageUrl = '';
          if (registerWinnerForm.imageFile) {
              imageUrl = await storageService.uploadImage(registerWinnerForm.imageFile, 'winners' as any);
          }
          
          await raffleService.adminRegisterWinner({
              raffleId: revelationRaffleId,
              userId: revelationResult.buyerId, // Will be undefined if not found
              ticketNumber: isManual ? parseInt(revelationTicketNumber) : revelationResult.winningTicket,
              prizeDescription: registerWinnerForm.prizeDescription,
              prizeType: registerWinnerForm.prizeType,
              prizeValue: registerWinnerForm.prizeValue ? parseFloat(registerWinnerForm.prizeValue.replace(/\D/g, '')) / 100 : null,
              imageUrl: imageUrl || null,
              drawDate: new Date().toISOString(),
              winnerName: isManual ? registerWinnerForm.winnerName : revelationResult.buyerName,
              winnerPhone: isManual ? registerWinnerForm.winnerPhone : revelationResult.buyerPhone,
              isManual: isManual
          });
          
          alert('Ganhador registrado com sucesso!');
          setShowRegisterWinnerForm(false);
          setRegisterWinnerForm({ prizeType: 'rifa', prizeDescription: '', prizeValue: '', imageFile: null, imageUrl: '', winnerName: '', winnerPhone: '' });
      } catch (err: any) {
          alert('Erro ao registrar ganhador: ' + err.message);
      } finally {
          setIsRegisteringWinner(false);
      }
  };

  const handleApprovePurchase = async (purchaseId: string) => {
      if (!confirm('Confirmar aprovação manual deste pagamento? Isso irá gerar os bilhetes.')) return;
      
      try {
          await raffleService.approvePurchase(purchaseId);
          alert('Pagamento aprovado e bilhetes gerados com sucesso!');
          loadPurchases(); // Reload list
      } catch (e: any) {
          alert('Erro ao aprovar: ' + e.message);
      }
  };

  const handleUpdatePurchase = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!editPurchase) return;
      try {
          await raffleService.adminUpdatePurchase(editPurchase.id, { 
              name: editPurchase.name,
              phone: editPurchase.phone, 
              cpf: editPurchase.cpf,
              purchase_date: editPurchase.purchase_date ? new Date(editPurchase.purchase_date).toISOString() : undefined
          });
          setEditPurchase(null);
          loadPurchases();
          alert('Dados da compra atualizados.');
      } catch(e: any) {
          alert('Erro ao atualizar compra: ' + e.message);
      }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newBannerUrl) return;
      try {
          await raffleService.adminCreateBanner(newBannerUrl);
          setNewBannerUrl('');
          loadBanners();
      } catch(e: any) {
          alert('Erro ao adicionar banner: ' + e.message);
      }
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsUploadingBanner(true);
      try {
          const url = await storageService.uploadImage(file, 'banners');
          await raffleService.adminCreateBanner(url);
          loadBanners();
      } catch (err: any) {
          alert(err.message);
      } finally {
          setIsUploadingBanner(false);
          if (e.target) e.target.value = ''; // Reset input
      }
  };

  const handleSaveSiteSettings = async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      
      if (notificationMax < notificationMin) {
          return alert('A quantidade máxima não pode ser menor que a mínima nas notificações de compras.');
      }
      if (notificationMin < 0 || notificationMax < 0) {
          return alert('As quantidades devem ser números positivos.');
      }
      
      setSavingSiteSettings(true);
      try {
          await raffleService.updateSiteSettings({
              siteTitle,
              siteDescription,
              siteFavicon,
              siteOgImage,
                          brandPrimary,
            brandSecondary,
            siteTheme,
              siteMode,
              notificationEnabled,
              notificationMin,
              notificationMax
          });
          raffleService.applySiteSettingsToDom({
              siteTitle,
              siteDescription,
              siteFavicon,
              siteOgImage
          });
          await refreshTheme();
          alert('Configurações do site salvas com sucesso!');
      } catch(err: any) {
          alert('Erro ao salvar configurações do site: ' + (err?.message || err));
      } finally {
          setSavingSiteSettings(false);
      }
  };

  const handleFaviconFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingFavicon(true);
      try {
          const publicUrl = await storageService.uploadImage(file, 'banners');
          setSiteFavicon(publicUrl);
          await raffleService.updateSiteSettings({ siteFavicon: publicUrl });
          raffleService.applySiteSettingsToDom({ siteFavicon: publicUrl });
          alert('Favicon enviado e atualizado com sucesso!');
      } catch (err: any) {
          alert('Erro ao enviar Favicon: ' + (err?.message || err));
      } finally {
          setIsUploadingFavicon(false);
          if (e.target) e.target.value = '';
      }
  };

  const handleOgImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploadingOgImage(true);
      try {
          const publicUrl = await storageService.uploadImage(file, 'banners');
          setSiteOgImage(publicUrl);
          await raffleService.updateSiteSettings({ siteOgImage: publicUrl });
          raffleService.applySiteSettingsToDom({ siteOgImage: publicUrl });
          alert('Imagem de capa do WhatsApp atualizada com sucesso!');
      } catch (err: any) {
          alert('Erro ao enviar imagem de capa: ' + (err?.message || err));
      } finally {
          setIsUploadingOgImage(false);
          if (e.target) e.target.value = '';
      }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      setIsUploadingImage(true);
      try {
          const url = await storageService.uploadImage(file, 'raffles');
          setFormData({ ...formData, imageUrl: url });
      } catch (err: any) {
          alert(err.message);
      } finally {
          setIsUploadingImage(false);
          if (e.target) e.target.value = ''; // Reset input
      }
  };

  const handleSaveFeeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFeeSettings(true);
    try {
      await raffleService.updateSimplifyFeeSettings({
        depositFeePercent: parseFloat(feeDepositPercent) || 0,
        depositFeeMin: parseFloat(feeDepositMin) || 0,
        withdrawalFeePercent: parseFloat(feeWithdrawalPercent) || 0,
        withdrawalFeeMin: parseFloat(feeWithdrawalMin) || 0,
      });
      alert('Taxas do Simplify Pay atualizadas com sucesso!');
      await loadDashboardWithFilters();
    } catch (err: any) {
      alert('Erro ao salvar taxas do Simplify: ' + (err?.message || err));
    } finally {
      setSavingFeeSettings(false);
    }
  };

  const handleDeleteBanner = async (banner: any) => {
      if(!confirm('Remover banner?')) return;
      try {
          // O arquivo no Storage é removido junto, no servidor.
          await raffleService.adminDeleteBanner(banner.id);
          loadBanners();
      } catch(e: any) {
          alert('Erro ao remover banner: ' + e.message);
      }
  };

  const handleViewTickets = async (purchase: any) => {
      try {
          const numbers = await raffleService.adminGetTicketsByPurchase(purchase.id);
          setViewingPurchaseTickets({
              numbers,
              info: purchase
          });
      } catch(e: any) {
          alert('Erro ao buscar bilhetes: ' + e.message);
      }
  };


  const handleCleanExpired = async () => {
      if(!confirm('Isso irá cancelar todas as compras PENDENTES há mais de 30 minutos e liberar os bilhetes para novos compradores. Deseja continuar?')) return;
      try {
          await raffleService.cancelExpiredPurchases();
          alert('Limpeza concluída! Compras expiradas foram canceladas.');
          loadDashboardWithFilters(); // Reload dashboard stats
      } catch(e: any) {
          alert('Erro ao limpar: ' + e.message);
      }
  };

  const handleUpdateWinnerDeliveryStatus = async (winnerId: string, status: string) => {
    try {
        await adminService.adminUpdateWinnerDeliveryStatus(winnerId, status);
        setWinners(winners.map(w => w.id === winnerId ? { ...w, delivery_status: status } : w));
    } catch (e: any) {
        alert('Erro ao atualizar status: ' + e.message);
    }
  };

  const viewWinnerTickets = async (raffleId: string, ticketNumber: number) => {
      try {
          const data = await adminService.adminGetPurchaseByTicket(raffleId, ticketNumber);
          setViewingPurchaseTickets(data);
      } catch (e: any) {
          alert('Erro ao carregar bilhetes: ' + e.message);
      }
  };

  // --- VIEW ---

  if (loadingSession) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-white"><Loader2 className="animate-spin" /></div>;

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
        <form noValidate onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 w-full max-w-md shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-900/20 rounded-full"><Lock className="w-8 h-8 text-brand-primary" /></div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 text-center">Admin Pro</h2>
          {loginError && <div className="bg-red-900/30 border border-red-800 text-red-200 p-3 rounded mb-4 text-sm text-center">{loginError}</div>}
          <div className="space-y-4">
            <input type="email" placeholder="admin@example.com" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-brand-primary-dark outline-none" />
            <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black border border-zinc-700 rounded-lg p-3 text-white focus:border-brand-primary-dark outline-none" />
          </div>
          <button 
            type="submit"
            disabled={loggingIn} 
            className="w-full bg-brand-primary-dark hover:bg-brand-primary text-black font-bold py-3 rounded-lg mt-6 flex justify-center items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {loggingIn ? <Loader2 className="animate-spin" /> : 'Entrar no Painel'}
          </button>
          <button type="button" onClick={onExit} className="w-full mt-4 text-zinc-500 text-sm">Voltar ao site</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row text-white font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col z-20 shadow-2xl">
        <div className="p-6 border-b border-zinc-800 bg-zinc-900/50">
            <h1 className="text-xl font-bold text-brand-primary tracking-wider drop-shadow-sm">{globalBrandPrimary} CMS</h1>
            <p className="text-xs text-zinc-500">v2.0 Ultimate</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Faturamento' },
            { id: 'raffles', icon: Ticket, label: 'Gerenciar Rifas' },
            { id: 'sales', icon: ShoppingBag, label: 'Vendas' },
            { id: 'users', icon: Users, label: 'Base de Leads' },
            { id: 'winners', icon: Trophy, label: 'Ganhadores' },
            { id: 'tickets', icon: Edit, label: 'Editar Bilhetes' },
            { id: 'search', icon: Search, label: 'Pesquisar Compra' },
            { id: 'revelation', icon: Sparkles, label: 'Revelar Ganhador' },
            { id: 'simulation', icon: AlertTriangle, label: 'Simular Expirado' },
            { id: 'suporte', icon: MessageCircle, label: 'Mensagens Suporte' },
            { id: 'site', icon: ImageIcon, label: 'Configurar Site' },
            { id: 'pixels', icon: Code, label: 'Meta Pixels' },
          ].map((item) => (
             <button 
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === item.id ? 'bg-gradient-to-r from-brand-primary-dark to-brand-primary text-black font-bold shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'}`}
              >
                <item.icon size={18} /> {item.label}
              </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold border border-zinc-700 shadow-inner">AD</div>
                <div className="overflow-hidden">
                    <p className="text-sm font-bold truncate">Admin</p>
                    <p className="text-xs text-zinc-500 truncate">{session.user.email}</p>
                </div>
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); onExit(); }} className="w-full flex items-center gap-2 text-red-400 hover:bg-red-900/20 px-4 py-2 rounded-lg transition-colors border border-transparent hover:border-red-900/30">
                <LogOut size={16} /> Sair do Sistema
            </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen bg-zinc-950 relative">
        {/* Subtle background pattern for admin */}
        <div className="absolute inset-0 bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>

        <header className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-6 sticky top-0 z-10 flex justify-between items-center shadow-sm">
            <h2 className="text-2xl font-bold text-white capitalize drop-shadow-md">{getTabTitle(activeTab)}</h2>
            <div className="flex gap-2">
                {activeTab === 'dashboard' && (
                    <button onClick={handleCleanExpired} title="Liberar bilhetes de compras não pagas (+15min)" className="px-3 py-2 text-red-400 hover:text-white bg-red-900/10 border border-red-900/30 rounded-lg hover:bg-red-900/50 transition-colors flex items-center gap-2">
                        <Trash2 size={16} /> <span className="hidden md:inline text-xs font-bold uppercase">Limpar Pendentes</span>
                    </button>
                )}
                <button onClick={() => window.location.reload()} className="p-2 text-zinc-400 hover:text-white bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"><RefreshCw size={20} /></button>
            </div>
        </header>

        <div className="p-6 md:p-8 max-w-7xl mx-auto relative z-0">
            
            {/* DASHBOARD TAB (FATURAMENTO) */}
            {activeTab === 'dashboard' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    
                    {/* Filter Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-lg">
                        <div className="flex items-center gap-2 text-zinc-400">
                             <Filter size={18} />
                             <span className="text-sm font-bold">Filtrar Período:</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {[
                                { id: 'today', label: 'Hoje' },
                                { id: 'yesterday', label: 'Ontem' },
                                { id: '7days', label: '7 Dias' },
                                { id: '30days', label: '30 Dias' },
                                { id: 'all', label: 'Todo Período' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    onClick={() => setDateFilter(opt.id as DateFilter)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                        dateFilter === opt.id 
                                        ? 'bg-brand-primary-dark text-black shadow-lg shadow-blue-900/20' 
                                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-transparent hover:border-zinc-600'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                            <button
                                onClick={() => setDateFilter('custom')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                                    dateFilter === 'custom'
                                    ? 'bg-brand-primary-dark text-black' 
                                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-transparent hover:border-zinc-600'
                                }`}
                            >
                                Personalizado
                            </button>
                        </div>
                    </div>

                    {/* Custom Range Inputs */}
                    {dateFilter === 'custom' && (
                         <div className="flex flex-wrap items-end gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                             <div>
                                 <label className="text-xs text-zinc-500 font-bold block mb-1">Data Início</label>
                                 <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white text-sm" />
                             </div>
                             <div>
                                 <label className="text-xs text-zinc-500 font-bold block mb-1">Data Fim</label>
                                 <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-zinc-950 border border-zinc-700 rounded-lg p-2 text-white text-sm" />
                             </div>
                             <div className="pb-1 text-xs text-zinc-500 italic">Selecione ambas as datas para atualizar.</div>
                         </div>
                    )}

                    {loadingData ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="animate-spin text-brand-primary w-8 h-8" />
                        </div>
                    ) : (
                        <>
                            {/* Key Metrics */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                                {/* Faturamento Líquido Card - DESTAQUE */}
                                <div className="bg-gradient-to-br from-blue-950/80 to-zinc-900 border border-brand-primary/40 p-5 rounded-2xl flex flex-col justify-between shadow-xl shadow-blue-950/30 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 bg-brand-primary text-black text-[10px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">
                                        Simplify Pay
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-brand-primary-light text-xs font-bold uppercase tracking-wider">Faturamento Líquido</p>
                                        </div>
                                        <p className="text-3xl font-black text-brand-primary-light drop-shadow-sm">R$ {Number(stats.netRevenue || 0).toFixed(2)}</p>
                                        <p className="text-[11px] text-zinc-400 mt-1 font-medium">
                                            Líquido real já descontado taxas
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setShowFeeDetailsModal(true)}
                                        className="mt-3 text-xs text-blue-300 hover:text-white bg-blue-900/40 hover:bg-blue-900/80 border border-blue-700/50 py-1.5 px-3 rounded-lg flex items-center justify-between transition-all"
                                    >
                                        <span>Detalhamento Taxas</span>
                                        <span>→</span>
                                    </button>
                                </div>

                                {/* Faturamento Bruto */}
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                                    <div>
                                        <p className="text-zinc-400 text-xs font-bold uppercase mb-1">Faturamento Bruto</p>
                                        <p className="text-2xl font-black text-white">R$ {Number(stats.totalRevenue || 0).toFixed(2)}</p>
                                        <p className="text-[11px] text-zinc-500 mt-1">{stats.salesCount} vendas aprovadas</p>
                                    </div>
                                    <div className="mt-2 text-xs text-zinc-400">
                                        Ticket Médio: <span className="text-white font-bold">R$ {Number(stats.avgTicket || 0).toFixed(2)}</span>
                                    </div>
                                </div>

                                {/* Total em Taxas Simplify */}
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                                    <div>
                                        <p className="text-amber-500/90 text-xs font-bold uppercase mb-1">Taxas Simplify Pay</p>
                                        <p className="text-2xl font-black text-amber-400">-R$ {Number(stats.totalSimplifyFees || 0).toFixed(2)}</p>
                                        <p className="text-[10px] text-zinc-500 mt-1">
                                            Entrada: R$ {Number(stats.totalDepositFees || 0).toFixed(2)} | Saque: R$ {Number(stats.totalWithdrawalFees || 0).toFixed(2)}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => setShowFeeDetailsModal(true)}
                                        className="mt-2 text-[11px] text-amber-400 hover:underline text-left font-medium"
                                    >
                                        Ver cálculo detalhado
                                    </button>
                                </div>

                                {/* Total Pendente */}
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                                    <div>
                                        <p className="text-zinc-400 text-xs font-bold uppercase mb-1">Total Pendente</p>
                                        <p className="text-2xl font-black text-white">R$ {Number(stats.pendingValue || 0).toFixed(2)}</p>
                                        <p className="text-[11px] text-amber-500/90 mt-1">{stats.pendingCount} pedidos aguardando PIX</p>
                                    </div>
                                </div>

                                {/* Conversão */}
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg">
                                    <div>
                                        <p className="text-zinc-400 text-xs font-bold uppercase mb-1">Taxa de Conversão</p>
                                        <p className="text-2xl font-black text-white">
                                            {stats.salesCount + stats.pendingCount > 0 
                                                ? ((stats.salesCount / (stats.salesCount + stats.pendingCount)) * 100).toFixed(1) 
                                                : 0}%
                                        </p>
                                        <p className="text-[11px] text-zinc-500 mt-1">
                                            Tíquete Líquido: <span className="text-brand-primary-light font-bold">R$ {Number(stats.netAvgTicket || 0).toFixed(2)}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Rifas Ativas */}
                                <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between shadow-lg opacity-90">
                                    <div>
                                        <p className="text-zinc-400 text-xs font-bold uppercase mb-1">Rifas Ativas</p>
                                        <p className="text-2xl font-black text-purple-400">{stats.activeRaffles}</p>
                                        <p className="text-[11px] text-zinc-500 mt-1">Campanhas no ar</p>
                                    </div>
                                </div>
                            </div>

                            {/* Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-brand-primary rounded-lg text-black"><TrendingUp size={20}/></div>
                                            <div>
                                                <h3 className="text-lg font-bold text-white">Receita no Tempo (Bruta vs Líquida)</h3>
                                                <p className="text-xs text-zinc-500">Comparativo de faturamento bruto e líquido real com Simplify Pay.</p>
                                            </div>
                                        </div>

                                        <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto">
                                            <button
                                                onClick={() => setChartViewMode('both')}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartViewMode === 'both' ? 'bg-brand-primary text-black shadow' : 'text-zinc-400 hover:text-white'}`}
                                            >
                                                Ambos
                                            </button>
                                            <button
                                                onClick={() => setChartViewMode('gross')}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartViewMode === 'gross' ? 'bg-brand-primary-dark text-[#fff] shadow' : 'text-zinc-400 hover:text-white'}`}
                                            >
                                                Apenas Bruto
                                            </button>
                                            <button
                                                onClick={() => setChartViewMode('net')}
                                                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${chartViewMode === 'net' ? 'bg-brand-primary-dark text-[#fff] shadow' : 'text-zinc-400 hover:text-white'}`}
                                            >
                                                Apenas Líquido
                                            </button>
                                        </div>
                                    </div>

                                    <div className="h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={chartData}>
                                                <defs>
                                                    <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                                                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                                                    </linearGradient>
                                                    <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                                <XAxis 
                                                    dataKey="date" 
                                                    stroke="#71717a" 
                                                    fontSize={12} 
                                                    tickLine={false} 
                                                    axisLine={false} 
                                                    dy={10}
                                                />
                                                <YAxis 
                                                    stroke="#71717a" 
                                                    fontSize={12} 
                                                    tickLine={false} 
                                                    axisLine={false} 
                                                    tickFormatter={(val) => `R$${val}`} 
                                                    dx={-10}
                                                />
                                                <RechartsTooltip 
                                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px', color: '#fff', padding: '12px' }} 
                                                    formatter={(value: number, name: string) => [
                                                        `R$ ${Number(value).toFixed(2)}`,
                                                        name === 'value' ? 'Faturamento Bruto' : name === 'netValue' ? 'Faturamento Líquido' : 'Taxas Simplify'
                                                    ]}
                                                />
                                                {(chartViewMode === 'both' || chartViewMode === 'gross') && (
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="value" 
                                                        name="value"
                                                        stroke="#2563eb" 
                                                        strokeWidth={2} 
                                                        fillOpacity={1} 
                                                        fill="url(#colorGross)" 
                                                    />
                                                )}
                                                {(chartViewMode === 'both' || chartViewMode === 'net') && (
                                                    <Area 
                                                        type="monotone" 
                                                        dataKey="netValue" 
                                                        name="netValue"
                                                        stroke="#10b981" 
                                                        strokeWidth={3} 
                                                        fillOpacity={1} 
                                                        fill="url(#colorNet)" 
                                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                                                    />
                                                )}
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>

                                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-brand-primary-dark rounded-lg text-black"><ShoppingBag size={20}/></div>
                                        <div>
                                            <h3 className="text-lg font-bold text-white">Vendas por Rifa</h3>
                                            <p className="text-xs text-zinc-500">Top 5 rifas com maior faturamento.</p>
                                        </div>
                                    </div>
                                    <div className="h-80 w-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart layout="vertical" data={stats.salesByRaffle.slice(0, 5)}>
                                                <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                                                <XAxis type="number" hide />
                                                <YAxis 
                                                    dataKey="name" 
                                                    type="category" 
                                                    width={100} 
                                                    tick={{fill: '#9ca3af', fontSize: 12}} 
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <RechartsTooltip 
                                                    cursor={{fill: 'transparent'}}
                                                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                                                    itemStyle={{ color: '#fff' }}
                                                    formatter={(value: number) => [`R$ ${Number(value || 0).toFixed(2)}`, 'Vendas']}
                                                />
                                                <Bar dataKey="value" fill="#22c55e" radius={[0, 4, 4, 0]} barSize={20}>
                                                    {stats.salesByRaffle.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* RAFFLES TAB */}
            {activeTab === 'raffles' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-end">
                        <button onClick={handleOpenCreate} className="bg-brand-primary-dark hover:bg-brand-primary text-[#fff] px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-blue-900/20">
                            <Plus size={20} /> Criar Nova Rifa
                        </button>
                    </div>

                    {(isEditing || isCreating) && (
                        <div className="bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl relative">
                            <button onClick={() => { setIsCreating(false); setIsEditing(null); }} className="absolute top-4 right-4 text-zinc-500 hover:text-white"><X /></button>
                            <h3 className="text-2xl font-bold text-white mb-6">{isCreating ? 'Cadastrar Rifa' : 'Editar Rifa Completa'}</h3>
                            
                            <div className="flex flex-col gap-8">
                                <form noValidate onSubmit={handleSaveRaffle} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="label-admin">Nome da Campanha</label>
                                        <input  className="input-admin" value={formData.name || ''} onChange={e => setFormData({...formData, name: e.target.value})} />
                                    </div>
                                    <div className="col-span-2 md:col-span-1">
                                        <label className="label-admin">Subtítulo (Curto)</label>
                                        <input  className="input-admin" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="label-admin">Descrição Detalhada (Regras, Prêmios)</label>
                                        <textarea  className="input-admin h-32" value={formData.fullDescription || ''} onChange={e => setFormData({...formData, fullDescription: e.target.value})} />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="label-admin">Imagem de Capa <span className="text-zinc-500 text-[10px] ml-1 normal-case font-normal">(Ideal: 1350x1080px, Máx: 5MB)</span></label>
                                        <div className="flex gap-4 items-center">
                                            {formData.imageUrl && (
                                                <div className="relative group">
                                                    <img src={imageSrc(formData.imageUrl)} onError={handleImageError} className="w-24 h-24 rounded-xl object-cover border-2 border-zinc-700 group-hover:border-brand-primary transition-colors" alt="Preview" />
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setFormData({...formData, imageUrl: ''})}
                                                        className="absolute -top-2 -right-2 bg-red-500 text-[#fff] p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            )}
                                            
                                            <div className="flex-1">
                                                <input 
                                                    type="file" 
                                                    id="raffle-image-upload"
                                                    accept="image/*"
                                                    onChange={handleImageFileChange}
                                                    disabled={isUploadingImage}
                                                    className="hidden"
                                                />
                                                <label 
                                                    htmlFor="raffle-image-upload"
                                                    className={`
                                                        flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors
                                                        ${isUploadingImage ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-700 hover:border-brand-primary hover:bg-zinc-800/50'}
                                                    `}
                                                >
                                                    {isUploadingImage ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <Loader2 className="w-6 h-6 text-brand-primary animate-spin" />
                                                            <span className="text-sm font-bold text-brand-primary">Enviando Imagem...</span>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-zinc-400 hover:text-brand-primary transition-colors">
                                                            <ImageIcon size={24} />
                                                            <span className="text-sm font-bold">Clique para Selecionar ou Arraste</span>
                                                        </div>
                                                    )}
                                                </label>
                                                {!formData.imageUrl && !isUploadingImage && (
                                                    <p className="text-xs text-red-500 mt-2 font-bold">⚠️ É obrigatório enviar uma imagem para a rifa.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-admin">Preço por Cota (R$)</label>
                                        <input type="number" step="0.01"  className="input-admin" value={formData.pricePerNumber ?? ''} onChange={e => setFormData({...formData, pricePerNumber: parseFloat(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin text-brand-primary">Compra Mínima de Cotas</label>
                                        <input type="number"  className="input-admin" value={formData.minPurchase ?? 1} onChange={e => setFormData({...formData, minPurchase: parseInt(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Total de Números</label>
                                        <input type="number" disabled={!!isEditing}  className="input-admin disabled:opacity-50" value={formData.totalNumbers ?? ''} onChange={e => setFormData({...formData, totalNumbers: parseInt(e.target.value)})} />
                                    </div>

                                    <div>
                                        <label className="label-admin">Data do Sorteio (Opcional)</label>
                                        <input 
                                            type="datetime-local" 
                                            className="input-admin" 
                                            value={formatIsoToLocalDatetime(formData.drawDate)}
                                            onChange={e => setFormData({...formData, drawDate: formatLocalDatetimeToIso(e.target.value)})}
                                        />
                                    </div>

                                    <div>
                                        <label className="label-admin text-orange-500">Margem de Segurança (%) - Overselling</label>
                                        <input 
                                            type="number" 
                                            min="0" 
                                            max="100" 
                                            className="input-admin border-orange-900/50 focus:border-orange-500" 
                                            value={formData.securityMarginPercent || 0} 
                                            onChange={e => setFormData({...formData, securityMarginPercent: parseInt(e.target.value)})} 
                                            title="Permite vender X% a mais do que o total de números para cobrir pagamentos pendentes."
                                        />
                                        <p className="text-[10px] text-zinc-500 mt-1">Ex: 20% em 1000 cotas = Vende até 1200.</p>
                                    </div>
                                    
                                    <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 col-span-2">
                                        <label className="label-admin text-brand-primary-light">⚡ Progresso Manual (%)</label>
                                        <p className="text-zinc-500 text-xs mb-2">Defina quanto da barra de progresso deve aparecer preenchida, independente das vendas reais.</p>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="number" 
                                                min="0" 
                                                max="100" 
                                                className="input-admin w-32 border-blue-900/50 focus:border-brand-primary" 
                                                placeholder="Ex: 90" 
                                                value={manualProgressPercent} 
                                                onChange={e => setManualProgressPercent(e.target.value)} 
                                            />
                                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-brand-primary-dark" style={{ width: `${Math.min(100, parseFloat(manualProgressPercent.toString()) || 0)}%` }}></div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* New Features: Featured & Scratch Cards */}
                                    <div className="col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-950 p-6 rounded-xl border border-zinc-800">
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                id="isFeatured"
                                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-brand-primary-dark focus:ring-brand-primary"
                                                checked={formData.isFeatured || false}
                                                onChange={e => setFormData({...formData, isFeatured: e.target.checked})}
                                            />
                                            <label htmlFor="isFeatured" className="text-sm font-bold text-white cursor-pointer select-none">
                                                Campanha em Destaque (Banner Grande na Home)
                                            </label>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="checkbox" 
                                                id="showRanking"
                                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-brand-primary-dark focus:ring-brand-primary"
                                                checked={formData.showRanking !== false}
                                                onChange={e => setFormData({...formData, showRanking: e.target.checked})}
                                            />
                                            <label htmlFor="showRanking" className="text-sm font-bold text-white cursor-pointer select-none">
                                                Exibir Ranking de Top Compradores
                                            </label>
                                        </div>
                                    </div>

                                    {/* Banner Verde Promocional Settings */}
                                    <div className="col-span-2 bg-zinc-950 p-6 rounded-xl border border-zinc-800 space-y-4">
                                        <div className="flex items-center gap-3 pb-2 border-b border-zinc-800">
                                            <input 
                                                type="checkbox" 
                                                id="showPromoBanner"
                                                className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-brand-primary-dark focus:ring-brand-primary"
                                                checked={formData.showPromoBanner !== false}
                                                onChange={e => setFormData({...formData, showPromoBanner: e.target.checked})}
                                            />
                                            <label htmlFor="showPromoBanner" className="text-sm font-bold text-white cursor-pointer select-none flex items-center gap-2">
                                                🍀 Exibir Modal / Banner Verde Promocional
                                            </label>
                                        </div>

                                        {formData.showPromoBanner !== false && (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="label-admin">Título do Banner Verde (Opcional)</label>
                                                    <input 
                                                        type="text" 
                                                        className="input-admin"
                                                        placeholder="Ex: Rifa de Teste 🍀" 
                                                        value={formData.promoBannerTitle || ''} 
                                                        onChange={e => setFormData({...formData, promoBannerTitle: e.target.value})} 
                                                    />
                                                    <span className="text-[10px] text-zinc-500">Se deixado em branco, usará o nome da rifa + 🍀</span>
                                                </div>
                                                <div>
                                                    <label className="label-admin">Texto Secundário do Banner (Opcional)</label>
                                                    <input 
                                                        type="text" 
                                                        className="input-admin"
                                                        placeholder="Ex: Para compras acima de 5 cotas! 🚨" 
                                                        value={formData.promoBannerSubtitle || ''} 
                                                        onChange={e => setFormData({...formData, promoBannerSubtitle: e.target.value})} 
                                                    />
                                                    <span className="text-[10px] text-zinc-500">Texto em destaque na caixa verde</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Regulamento / Termos da Rifa */}
                                    <div className="col-span-2 bg-zinc-950 p-6 rounded-xl border border-zinc-800">
                                        <label className="label-admin text-white flex items-center gap-2">
                                            📜 Regulamento Oficial da Rifa (Opcional)
                                        </label>
                                        <textarea 
                                            rows={4}
                                            className="input-admin"
                                            placeholder="Escreva aqui as regras, critérios do sorteio ou termos específicos desta campanha..."
                                            value={formData.termsAndRules || ''}
                                            onChange={e => setFormData({...formData, termsAndRules: e.target.value})}
                                        />
                                        <span className="text-[10px] text-zinc-500 mt-1 block">Aparece na aba 'Regulamento da Rifa' da página da campanha.</span>
                                    </div>
                                        

                                    {isEditing && (
                                        <div className="col-span-2 grid grid-cols-1 md:grid-cols-1 gap-6 bg-zinc-950 p-6 rounded-xl border border-zinc-800 mt-4">
                                            <div>
                                                <label className="label-admin text-brand-primary">Status da Rifa</label>
                                                <select className="input-admin border-blue-900/50 focus:border-brand-primary" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                                    <option value="ACTIVE">⚡ ATIVA (Vendendo)</option>
                                                    <option value="FINISHED">🏁 FINALIZADA (Encerrada)</option>
                                                </select>
                                                {formData.status === 'FINISHED' && (
                                                    <p className="text-zinc-500 text-xs mt-2 font-bold bg-blue-900/10 border border-blue-900/30 p-3 rounded-lg">
                                                        ⚠️ Para definir o ganhador e o número sorteado desta rifa, utilize a aba "Revelar Ganhador" (ícone ✨) no topo da tela. 
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* RANKING CONFIGURATION SECTION */}
                                    <div className="col-span-2 bg-zinc-950 p-6 rounded-xl border border-zinc-800 mt-4">
                                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Trophy size={16} className="text-brand-primary" /> 
                                            Configuração de Top Compradores
                                        </h3>
                                        <p className="text-zinc-500 text-xs mb-4">Defina prêmios para quem comprar mais cotas. Ex: 1º Lugar ganha iPhone.</p>
                                        
                                        {/* Ranking Period Config */}
                                        <div className="grid grid-cols-2 gap-4 mb-6 border-b border-zinc-800 pb-6 bg-zinc-900/50 p-4 rounded-lg">
                                            <div>
                                                <label className="label-admin">Início do Ranking</label>
                                                <input 
                                                    type="datetime-local" 
                                                    className="input-admin" 
                                                    value={formatIsoToLocalDatetime(formData.rankingStartDate)}
                                                    onChange={e => setFormData({...formData, rankingStartDate: formatLocalDatetimeToIso(e.target.value)})}
                                                />
                                                <p className="text-[10px] text-zinc-500 mt-1">Apenas compras após esta data contarão.</p>
                                            </div>
                                            <div>
                                                <label className="label-admin">Fim do Ranking (Opcional)</label>
                                                <input 
                                                    type="datetime-local" 
                                                    className="input-admin" 
                                                    value={formatIsoToLocalDatetime(formData.rankingEndDate)}
                                                    onChange={e => setFormData({...formData, rankingEndDate: formatLocalDatetimeToIso(e.target.value)})}
                                                />
                                                <p className="text-[10px] text-zinc-500 mt-1">O ranking congela após esta data.</p>
                                            </div>
                                            <div className="col-span-2 flex items-center justify-between">
                                                <p className="text-xs text-zinc-400 italic">
                                                    Use isso para criar rankings diários ou semanais.
                                                </p>
                                                <button 
                                                    type="button"
                                                    onClick={handleInitiateFinalizeRanking}
                                                    className="text-xs bg-blue-900/30 hover:bg-blue-900/50 text-blue-200 px-3 py-2 rounded border border-blue-900/50 flex items-center gap-2 transition-colors"
                                                >
                                                    <Trophy size={12} /> Finalizar Ciclo Atual (Salvar Ganhador)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Ranking Minimum Value Config */}
                                        <div className="mb-6 border-b border-zinc-800 pb-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <input 
                                                    type="checkbox" 
                                                    id="enableRankingMin"
                                                    className="w-5 h-5 rounded border-zinc-700 bg-zinc-900 text-brand-primary-dark focus:ring-brand-primary"
                                                    checked={!!formData.rankingMinValue}
                                                    onChange={e => {
                                                        if (e.target.checked) {
                                                            setFormData({...formData, rankingMinValue: 50});
                                                        } else {
                                                            setFormData({...formData, rankingMinValue: null});
                                                        }
                                                    }}
                                                />
                                                <label htmlFor="enableRankingMin" className="text-sm font-bold text-white cursor-pointer select-none">
                                                    Ativar Valor Mínimo para Top Comprador
                                                </label>
                                            </div>
                                            
                                            {!!formData.rankingMinValue && (
                                                <div className="bg-zinc-900/50 p-4 rounded-lg">
                                                    <label className="label-admin">VALOR MÍNIMO PARA PARTICIPAR DO TOP COMPRADOR (R$)</label>
                                                    <div className="relative max-w-xs">
                                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 font-bold">R$</span>
                                                        <input 
                                                            type="number"
                                                            min="1"
                                                            step="0.01"
                                                            className="input-admin pl-10"
                                                            value={formData.rankingMinValue}
                                                            onChange={e => setFormData({...formData, rankingMinValue: parseFloat(e.target.value) || 0})}
                                                        />
                                                    </div>
                                                    <p className="text-[10px] text-zinc-500 mt-2">Somente compradores com valor total acumulado igual ou superior a este valor aparecerão no ranking.</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-wrap gap-2 mb-4 items-end">
                                            <div>
                                                <label className="label-admin">Posição</label>
                                                <input 
                                                    type="number" 
                                                    placeholder="Ex: 1" 
                                                    value={newRankingItem.position}
                                                    onChange={e => setNewRankingItem({...newRankingItem, position: e.target.value})}
                                                    className="w-24 bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm h-[42px]"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-[200px]">
                                                <label className="label-admin">Prêmio</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ex: iPhone 15 Pro Max" 
                                                    value={newRankingItem.prize}
                                                    onChange={e => setNewRankingItem({...newRankingItem, prize: e.target.value})}
                                                    className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm h-[42px]"
                                                />
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={handleAddRankingItem}
                                                className="bg-brand-primary-dark hover:bg-brand-primary text-[#fff] px-4 py-2 rounded-lg h-[42px] flex items-center gap-2 font-bold text-sm"
                                            >
                                                <Plus size={16} /> Adicionar
                                            </button>
                                        </div>

                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                            {rankingConfig.length === 0 && <p className="text-zinc-600 text-xs italic p-2 border border-dashed border-zinc-800 rounded">Nenhum prêmio de ranking configurado.</p>}
                                            {rankingConfig.map((item) => (
                                                <div key={item.position} className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-inner ${item.position === 1 ? 'bg-brand-primary text-black' : item.position === 2 ? 'bg-zinc-400 text-black' : item.position === 3 ? 'bg-orange-700 text-[#fff]' : 'bg-zinc-800 text-zinc-400'}`}>
                                                            {item.position}º
                                                        </div>
                                                        <span className="text-sm text-white font-medium">{item.prize}</span>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRemoveRankingItem(item.position)}
                                                        className="text-zinc-500 hover:text-red-500 p-2 hover:bg-zinc-800 rounded transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* MANUAL RANKING SECTION */}
                                    <div className="col-span-2 bg-zinc-950 p-6 rounded-xl border border-zinc-800 mt-4">
                                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Users size={16} className="text-purple-500" /> 
                                            Compradores Fictícios (Ranking Manual)
                                        </h3>
                                        <p className="text-zinc-500 text-xs mb-4">Adicione compradores falsos para aparecerem no ranking. Eles serão misturados com os reais e ordenados por quantidade de cotas.</p>
                                        
                                        <div className="flex flex-wrap gap-2 mb-4 items-end">
                                            <div className="flex-1 min-w-[150px]">
                                                <label className="label-admin">Nome</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ex: Maria Souza" 
                                                    value={newManualBuyer.name}
                                                    onChange={e => setNewManualBuyer({...newManualBuyer, name: e.target.value})}
                                                    className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm h-[42px]"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <label className="label-admin">Telefone (Opcional)</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="(11) 9..." 
                                                    value={newManualBuyer.phone}
                                                    onChange={e => setNewManualBuyer({...newManualBuyer, phone: e.target.value})}
                                                    className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm h-[42px]"
                                                />
                                            </div>
                                            <div className="w-24">
                                                <label className="label-admin">Cotas</label>
                                                <input 
                                                    type="number" 
                                                    placeholder="100" 
                                                    value={newManualBuyer.totalTickets}
                                                    onChange={e => setNewManualBuyer({...newManualBuyer, totalTickets: e.target.value})}
                                                    className="w-full bg-black border border-zinc-700 rounded-lg p-2 text-white text-sm h-[42px]"
                                                />
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={handleAddManualBuyer}
                                                className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg h-[42px] flex items-center gap-2 font-bold text-sm"
                                            >
                                                <Plus size={16} /> Adicionar
                                            </button>
                                        </div>

                                        <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                                            {manualRanking.length === 0 && <p className="text-zinc-600 text-xs italic p-2 border border-dashed border-zinc-800 rounded">Nenhum comprador fictício adicionado.</p>}
                                            {manualRanking.map((item, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-zinc-900 p-3 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-purple-900/30 flex items-center justify-center text-xs font-bold text-purple-400 border border-purple-900/50">
                                                            FK
                                                        </div>
                                                        <div>
                                                            <p className="text-sm text-white font-medium">{item.name}</p>
                                                            <p className="text-xs text-zinc-500">{item.totalTickets} cotas • {item.phone || 'Sem tel'}</p>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        type="button"
                                                        onClick={() => handleRemoveManualBuyer(idx)}
                                                        className="text-zinc-500 hover:text-red-500 p-2 hover:bg-zinc-800 rounded transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="col-span-2 pt-4">
                                        <button disabled={savingRaffle} className="w-full bg-brand-primary-dark hover:bg-brand-primary disabled:bg-zinc-700 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                                            {savingRaffle ? <Loader2 className="animate-spin" /> : <><Save size={20} /> Salvar Alterações</>}
                                        </button>
                                    </div>
                                </form>

                                {/* WINNING TICKETS SECTION */}
                                <div className="border-t border-zinc-800 pt-8 mt-8 animate-in fade-in">
                                    <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Gift className="text-purple-500" /> Bilhetes Premiados (Prêmios Instantâneos)</h4>
                                    <p className="text-zinc-400 text-sm mb-6">Defina números que valem prêmios extras. Se o cadeado estiver FECHADO, o número não sai no sorteio aleatório. Se ABERTO, ele pode ser comprado por qualquer um.</p>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                <label className="label-admin">Número Premiado</label>
                                                <input type="number" className="input-admin" placeholder="Ex: 500" value={newWinningTicket.number} onChange={e => setNewWinningTicket({...newWinningTicket, number: e.target.value})} />
                                            </div>
                                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                                <label className="label-admin">Prêmio (Descrição)</label>
                                                <input type="text" className="input-admin" placeholder="Ex: R$ 500 no Pix" value={newWinningTicket.prize} onChange={e => setNewWinningTicket({...newWinningTicket, prize: e.target.value})} />
                                            </div>
                                            <div className="flex items-end">
                                                <button type="button" onClick={handleAddWinningTicket} className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold h-[48px] rounded-lg flex items-center justify-center gap-2">
                                                    <Plus size={18} /> Adicionar Bilhete
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            {winningTickets.length === 0 && <p className="text-zinc-600 text-center italic py-4">Nenhum bilhete premiado cadastrado.</p>}
                                            {winningTickets.map(ticket => (
                                                <div key={ticket.id} className="bg-zinc-950 p-4 rounded-lg border border-zinc-800 flex items-center justify-between group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${ticket.won ? 'bg-blue-900/20 text-brand-primary' : 'bg-zinc-800 text-white'}`}>
                                                            {ticket.ticketNumber}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white">{ticket.prizeDescription}</p>
                                                            <div className="flex gap-2 text-xs mt-1">
                                                                {ticket.won ? (
                                                                    <span className="text-brand-primary font-bold flex items-center gap-1"><Trophy size={12}/> VENDIDO ({ticket.winnerName})</span>
                                                                ) : (
                                                                    <span className="text-zinc-500">Disponível</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        {!ticket.won && (
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleOpenAssignWinner(ticket)}
                                                                title="Definir Ganhador Manualmente"
                                                                className="px-4 py-2 rounded-lg font-bold text-xs bg-brand-primary-dark/20 text-brand-primary-light hover:bg-brand-primary-dark/30 flex items-center gap-2"
                                                            >
                                                                <UserPlus size={14} /> GANHADOR
                                                            </button>
                                                        )}

                                                        <button 
                                                            type="button"
                                                            onClick={() => handleToggleWinningTicket(ticket.id, ticket.isActive)}
                                                            disabled={ticket.won}
                                                            title={ticket.isActive ? "Bloquear (Ninguém pode ganhar)" : "Liberar (Pode sair no sorteio)"}
                                                            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
                                                                ticket.isActive 
                                                                    ? 'bg-brand-primary-dark/20 text-brand-primary-light hover:bg-brand-primary-dark/30' 
                                                                    : 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                                                            } disabled:opacity-30 disabled:cursor-not-allowed`}
                                                        >
                                                            {ticket.isActive ? <Unlock size={14} /> : <Lock size={14} />}
                                                            {ticket.isActive ? 'LIBERADO' : 'TRAVADO'}
                                                        </button>
                                                        <button type="button" onClick={() => handleDeleteWinningTicket(ticket.id)} className="p-2 text-zinc-500 hover:text-red-500 hover:bg-zinc-800 rounded">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                            </div>
                        </div>
                    )}

                    {/* MANUAL WINNER ASSIGN MODAL (Inside Raffle) */}
                    {assigningWinner && (
                         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                                <h3 className="text-xl font-bold text-white mb-2">Definir Ganhador Manual</h3>
                                <p className="text-zinc-400 text-sm mb-4">
                                    Atribuir o bilhete premiado <strong className="text-white">#{assigningWinner.ticketNumber}</strong> a uma pessoa (Não cria uma venda falsa).
                                </p>
                                <form noValidate onSubmit={handleSubmitAssignWinner} className="space-y-4">
                                    <div>
                                        <label className="label-admin">CPF (Opcional - para buscar usuário)</label>
                                        <div className="flex gap-2">
                                            <input  className="input-admin flex-1" placeholder="Apenas números" value={assignForm.cpf} onChange={e => setAssignForm({...assignForm, cpf: formatCPF(e.target.value)})} maxLength={14} />
                                            <button type="button" onClick={handleCheckAssignCpf} className="bg-zinc-700 hover:bg-zinc-600 text-[#fff] font-bold px-4 rounded-lg">Buscar</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-admin">Nome Completo *</label>
                                        <input  className="input-admin" readOnly={!!assignForm.name} value={assignForm.name} onChange={e => setAssignForm({...assignForm, name: formatName(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Telefone (Opcional)</label>
                                        <input  className="input-admin" readOnly={!!assignForm.phone} value={assignForm.phone} onChange={e => setAssignForm({...assignForm, phone: formatPhone(e.target.value)})} maxLength={15} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Foto do Ganhador (Opcional)</label>
                                        <input 
                                            type="file" 
                                            accept="image/*"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setAssignForm({...assignForm, imageFile: e.target.files[0]});
                                                }
                                            }}
                                            className="input-admin w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-primary file:text-[#fff] hover:file:bg-brand-primary-dark"
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <button type="button" onClick={() => setAssigningWinner(null)} className="flex-1 bg-zinc-800 py-3 rounded-lg text-white hover:bg-zinc-700">Cancelar</button>
                                        <button className="flex-1 bg-brand-primary-dark py-3 rounded-lg text-[#fff] font-bold hover:bg-brand-primary">Confirmar</button>
                                    </div>
                                </form>
                            </div>
                         </div>
                    )}
                    
                    {/* Raffle List - Unchanged */}
                    <div className="grid gap-4">
                        {raffles.map(raffle => {
                             const displaySold = Math.max(raffle.soldNumbers, raffle.fakeSoldNumbers || 0);
                             const percentage = Math.floor((displaySold / raffle.totalNumbers) * 100);
                             
                             return (
                                <div key={raffle.id} className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 flex flex-col md:flex-row items-center gap-6 hover:border-zinc-600 transition-colors">
                                    <img src={imageSrc(raffle.imageUrl)} onError={handleImageError} className="w-24 h-24 rounded-xl object-cover shadow-lg" alt="" />
                                    <div className="flex-1 text-center md:text-left">
                                        <h3 className="text-xl font-bold text-white mb-1">{raffle.name}</h3>
                                        <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${raffle.status === 'ACTIVE' ? 'bg-blue-900/30 text-brand-primary-light' : 'bg-red-900/30 text-red-400'}`}>
                                                {raffle.status === 'ACTIVE' ? 'EM ANDAMENTO' : 'FINALIZADA'}
                                            </span>
                                            <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-500 uppercase">Visível</span>
                                                {displaySold} / {raffle.totalNumbers}
                                            </span>
                                            <span className="bg-blue-900/30 text-brand-primary-light px-3 py-1 rounded-full text-xs font-bold flex flex-col items-center">
                                                <span className="text-[10px] text-blue-300/50 uppercase">Progresso</span>
                                                {percentage}%
                                            </span>
                                            <span className="bg-purple-900/20 text-purple-400 px-3 py-1 rounded-full text-xs font-bold border border-purple-900/30 flex flex-col items-center">
                                                <span className="text-[10px] text-purple-300/50 uppercase">Real (Admin)</span>
                                                {raffle.soldNumbers} vendidos
                                            </span>
                                            <span className="bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs flex flex-col items-center">
                                                <span className="text-[10px] text-zinc-500 uppercase">Preço</span>
                                                R$ {raffle.pricePerNumber}
                                            </span>
                                        </div>
                                        {raffle.winnerName && (
                                            <div className="mt-2 text-sm text-brand-primary font-bold flex items-center gap-2 justify-center md:justify-start">
                                                <Trophy size={14} /> Ganhador: {raffle.winnerName} (Nº {raffle.winnerNumber})
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {raffle.status === 'FINISHED' && (
                                            <button onClick={() => handleClearTickets(raffle)} title="Limpar Bilhetes (Libera espaço no banco)" className="btn-icon bg-zinc-800 hover:bg-orange-600 hover:text-white"><Eraser size={18} /></button>
                                        )}
                                        <button onClick={() => handleOpenEdit(raffle)} className="btn-icon bg-zinc-800 hover:bg-brand-primary-dark hover:text-white"><Edit size={18} /></button>
                                        <button onClick={() => handleDeleteRaffle(raffle.id)} className="btn-icon bg-zinc-800 hover:bg-red-600 hover:text-white"><Trash2 size={18} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
            
            {/* ... rest of the component unchanged ... */}
            {activeTab === 'tickets' && (
                 <div className="space-y-6 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Editor de Bilhetes (Troca de Titularidade)</h3>
                        <p className="text-zinc-400 text-sm mb-6">Use esta ferramenta para corrigir erros de cadastro. Você pode buscar um número específico e transferi-lo para outro CPF.</p>
                        
                        <form noValidate onSubmit={handleSearchTicket} className="flex flex-col md:flex-row gap-4 items-end bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                             <div className="flex-1 w-full">
                                <label className="label-admin">Rifa</label>
                                <select className="input-admin" value={searchTicket.raffleId} onChange={e => setSearchTicket({...searchTicket, raffleId: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {raffles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                                </select>
                            </div>
                            <div className="flex-1 w-full">
                                <label className="label-admin">Número do Bilhete</label>
                                <input type="number" className="input-admin" placeholder="Ex: 5042" value={searchTicket.number} onChange={e => setSearchTicket({...searchTicket, number: e.target.value})} />
                            </div>
                            <button className="bg-brand-primary-dark hover:bg-brand-primary text-black font-bold px-8 py-3 rounded-lg h-[46px]">Buscar</button>
                        </form>

                        {foundTicket && (
                            <div className="mt-8 border-t border-zinc-800 pt-8 animate-in slide-in-from-bottom-2">
                                <div className="bg-zinc-800 rounded-xl p-6 border border-zinc-700">
                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h4 className="text-2xl font-bold text-white flex items-center gap-2">
                                                <Ticket className={foundTicket.error ? "text-zinc-500" : "text-brand-primary"} /> 
                                                Bilhete #{foundTicket.ticket_number || searchTicket.number}
                                            </h4>
                                            {foundTicket.error ? (
                                                <p className="text-brand-primary text-sm mt-1">Este bilhete ainda não foi vendido.</p>
                                            ) : (
                                                <p className="text-zinc-400 text-sm mt-1">Comprado em {new Date(foundTicket.purchases?.purchase_date).toLocaleString()}</p>
                                            )}
                                        </div>
                                        {!foundTicket.error && (
                                            <div className="bg-black px-4 py-2 rounded text-zinc-400 font-mono text-sm">ID: {foundTicket.id}</div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div>
                                            <p className="label-admin">Dono Atual</p>
                                            {foundTicket.error ? (
                                                <div className="text-lg font-bold text-zinc-500 mb-1">Nenhum (Disponível)</div>
                                            ) : (
                                                <>
                                                    <div className="text-lg font-bold text-white mb-1">{foundTicket.owner_cpf}</div>
                                                    <div className="text-sm text-zinc-500">Tel: {foundTicket.purchases?.phone}</div>
                                                </>
                                            )}
                                        </div>

                                        <div className="bg-zinc-900 p-4 rounded-lg border border-blue-900/30">
                                            <label className="label-admin text-brand-primary">Atribuir / Transferir Bilhete</label>
                                            
                                            <div className="space-y-4 mt-2">
                                                <div className="flex gap-2">
                                                    <input 
                                                        type="text" 
                                                        placeholder="CPF do novo dono" 
                                                        className="input-admin flex-1" 
                                                        value={assignCpf}
                                                        onChange={e => {
                                                            setAssignCpf(formatCPF(e.target.value));
                                                            setCpfChecked(false);
                                                        }}
                                                        maxLength={14}
                                                    />
                                                    <button onClick={handleCheckCpf} className="bg-zinc-700 hover:bg-zinc-600 text-[#fff] font-bold px-4 rounded-lg">Verificar</button>
                                                </div>

                                                {cpfChecked && (
                                                    <div className="space-y-3 animate-in fade-in">
                                                        {hasPurchase ? (
                                                            <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg text-sm text-brand-primary-light">
                                                                Este cliente já possui compras nesta rifa. O bilhete será trocado por um dos bilhetes antigos dele.
                                                            </div>
                                                        ) : (
                                                            <div className="bg-blue-900/20 border border-blue-900/50 p-3 rounded-lg text-sm text-brand-primary-light">
                                                                Cliente novo nesta rifa. Preencha os dados para registrar a compra.
                                                            </div>
                                                        )}

                                                        <input 
                                                            type="text" 
                                                            placeholder="Nome Completo" 
                                                            className="input-admin" 
                                                            value={assignName}
                                                            onChange={e => setAssignName(formatName(e.target.value))}
                                                            disabled={hasPurchase && !!assignName}
                                                        />
                                                        
                                                        <input 
                                                            type="text" 
                                                            placeholder="Telefone" 
                                                            className="input-admin" 
                                                            value={assignPhone}
                                                            onChange={e => setAssignPhone(formatPhone(e.target.value))}
                                                            disabled={hasPurchase && !!assignPhone}
                                                            maxLength={15}
                                                        />

                                                        {!hasPurchase && (
                                                            <div>
                                                                <label className="text-xs text-zinc-400 mb-1 block">Data da Compra (Opcional)</label>
                                                                <input 
                                                                    type="datetime-local" 
                                                                    className="input-admin" 
                                                                    value={assignDate}
                                                                    onChange={e => setAssignDate(e.target.value)}
                                                                />
                                                            </div>
                                                        )}

                                                        <button onClick={handleAssignTicket} className="w-full bg-brand-primary-dark hover:bg-brand-primary text-black font-bold py-3 rounded-lg mt-2">
                                                            Confirmar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                 </div>
            )}
            
            {activeTab === 'winners' as any && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex justify-between items-center bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Trophy className="text-brand-primary" /> Gestão de Ganhadores</h3>
                            <p className="text-zinc-400 text-sm mt-1">Acompanhe todos os prêmios (Rifas e Raspadinhas) e gerencie a entrega.</p>
                        </div>
                    </div>

                    <div className="overflow-x-auto bg-zinc-900 rounded-2xl border border-zinc-800">
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-zinc-950 text-xs uppercase font-bold text-zinc-500">
                                <tr>
                                    <th className="p-4">Ganhador</th>
                                    <th className="p-4">Sorteio / Rifa</th>
                                    <th className="p-4">Prêmio (Bilhete)</th>
                                    <th className="p-4">Tipo</th>
                                    <th className="p-4 text-center">Notificado?</th>
                                    <th className="p-4">Entrega</th>
                                    <th className="p-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {winners.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-zinc-500">Nenhum ganhador registrado ainda.</td></tr>
                                ) : winners.map((w, i) => (
                                    <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{w.profiles?.full_name || w.winner_name || 'Desconhecido'}</div>
                                            <div className="text-xs text-zinc-500 font-mono">{(w.profiles?.cpf || 'Não registrado').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</div>
                                            <div className="text-xs text-zinc-500">{(w.profiles?.phone || w.winner_phone || 'Sem telefone').replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-white font-bold">{w.raffles?.name || w.raffle_name || 'Rifa'}</div>
                                            <div className="text-xs text-zinc-500">{new Date(w.created_at).toLocaleString()}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-brand-primary font-bold">{w.prize}</div>
                                            <div className="text-xs font-mono text-zinc-500">Nº {String(w.ticket_number).padStart(5, '0')}</div>
                                        </td>
                                        <td className="p-4">
                                            {w.prize_type === 'bilhete' ? (
                                                <span className="bg-green-900/20 text-green-400 border border-green-900/50 px-2 py-1 rounded text-[10px] font-bold uppercase">Raspadinha</span>
                                            ) : (
                                                <span className="bg-yellow-900/20 text-yellow-400 border border-yellow-900/50 px-2 py-1 rounded text-[10px] font-bold uppercase">Sorteio Final</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-center">
                                            {w.notified_at ? (
                                                <span title={`Visualizado em ${new Date(w.notified_at).toLocaleString()}`} className="text-brand-primary inline-flex bg-brand-primary/10 p-1.5 rounded-full">
                                                    <Check size={16} />
                                                </span>
                                            ) : (
                                                <span title="Aguardando visualização" className="text-zinc-600 inline-flex">
                                                    <AlertTriangle size={16} />
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <select 
                                                value={w.delivery_status || 'PENDING'} 
                                                onChange={(e) => handleUpdateWinnerDeliveryStatus(w.id, e.target.value)}
                                                className={`text-xs font-bold px-2 py-1.5 rounded outline-none border ${
                                                    w.delivery_status === 'DELIVERED' ? 'bg-green-900/20 text-green-400 border-green-900/50' : 
                                                    w.delivery_status === 'IN_CONTACT' ? 'bg-blue-900/20 text-blue-400 border-blue-900/50' : 
                                                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                }`}
                                            >
                                                <option value="PENDING">Pendente</option>
                                                <option value="IN_CONTACT">Em Contato</option>
                                                <option value="DELIVERED">Entregue</option>
                                            </select>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => viewWinnerTickets(w.raffle_id, w.ticket_number)}
                                                    className="btn-icon bg-brand-primary/10 text-brand-primary hover:bg-brand-primary hover:text-black"
                                                    title="Ver Bilhetes"
                                                >
                                                    <Ticket size={16} />
                                                </button>
                                                <a 
                                                    href={`https://wa.me/55${(w.profiles?.phone || w.winner_phone || '').replace(/\D/g, '')}`} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="btn-icon bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white"
                                                    title="Chamar no WhatsApp"
                                                >
                                                    <MessageCircle size={16} />
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="space-y-6 animate-in fade-in">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                        <div>
                            <h3 className="text-xl font-bold text-white">Base de Leads (CRM)</h3>
                            <p className="text-zinc-400 text-sm">Gerencie todos os usuários que já interagiram com o site.</p>
                        </div>
                        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                            <select 
                                value={leadsFilterStatus} 
                                onChange={(e) => setLeadsFilterStatus(e.target.value as any)}
                                className="bg-zinc-950 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                            >
                                <option value="ALL">Todos os Status</option>
                                <option value="VIP">VIP</option>
                                <option value="CLIENTE">Cliente</option>
                                <option value="QUENTE">Quente</option>
                                <option value="FRIO">Frio</option>
                            </select>

                            <select 
                                onChange={(e) => {
                                    const [key, direction] = e.target.value.split('_');
                                    setSortConfig({ key, direction: direction as 'asc' | 'desc' });
                                }}
                                className="bg-zinc-950 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                            >
                                <option value="totalSpent_desc">Maior Gasto (R$)</option>
                                <option value="totalSpent_asc">Menor Gasto (R$)</option>
                                <option value="purchaseCount_desc">Mais Compras</option>
                                <option value="purchaseCount_asc">Menos Compras</option>
                            </select>

                            <div className="relative flex-1 md:w-48">
                                <Search className="absolute left-3 top-2.5 text-zinc-500" size={16} />
                                <input 
                                    placeholder="Buscar..." 
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-white text-sm focus:border-brand-primary outline-none"
                                    value={searchUser}
                                    onChange={e => setSearchUser(e.target.value)}
                                />
                            </div>
                            <button onClick={handleExportUsers} className="bg-brand-primary-dark hover:bg-brand-primary text-[#fff] px-4 py-2 rounded-lg font-bold flex items-center gap-2 text-sm">
                                <DollarSign size={16} /> Exportar
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto bg-zinc-900 rounded-2xl border border-zinc-800">
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-zinc-950 text-xs uppercase font-bold text-zinc-500">
                                <tr>
                                    <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSortUsers('name')}>Cliente</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">CPF</th>
                                    <th className="p-4">Telefone</th>
                                    <th className="p-4">Cidade/UF</th>
                                    <th className="p-4 cursor-pointer hover:text-white" onClick={() => handleSortUsers('totalSpent')}>Total Gasto</th>
                                    <th className="p-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {getFilteredAndSortedUsers().items.map((u, i) => (
                                    <tr key={i} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4">
                                            <div className="font-bold text-white">{u.name || 'Sem nome'}</div>
                                            <div className="text-xs text-zinc-500">{u.purchaseCount} compras • {u.pendingCount} pendentes</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                                u.status === 'VIP' ? 'bg-purple-900/20 text-purple-400 border-purple-900/50' :
                                                u.status === 'CLIENTE' ? 'bg-blue-900/20 text-brand-primary-light border-blue-900/50' :
                                                u.status === 'QUENTE' ? 'bg-orange-900/20 text-orange-400 border-orange-900/50' :
                                                'bg-zinc-800 text-zinc-400 border-zinc-700'
                                            }`}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono">{u.cpf}</td>
                                        <td className="p-4">{u.phone}</td>
                                        <td className="p-4">
                                            <div className="text-white text-xs">{u.city || '-'}</div>
                                            <div className="text-zinc-500 text-[10px]">{u.state || '-'}</div>
                                        </td>
                                        <td className="p-4 text-white font-bold">R$ {Number(u.totalSpent || 0).toFixed(2)}</td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        setActiveTab('sales');
                                                        setSalesSearch(u.cpf || '');
                                                    }}
                                                    className="px-3 py-1.5 bg-brand-primary/10 text-brand-primary border border-brand-primary/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-brand-primary hover:text-black transition-colors flex items-center gap-1"
                                                >
                                                    <Ticket size={14} /> Ver Bilhetes
                                                </button>
                                                <a 
                                                    href={`https://wa.me/55${(u.phone || '').replace(/\D/g, '')}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 text-brand-primary hover:text-brand-primary-light bg-zinc-950 rounded hover:bg-zinc-800 transition-colors inline-flex border border-zinc-800"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
                                                </a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {getFilteredAndSortedUsers().totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4">
                            <button 
                                onClick={() => setLeadsPage(p => Math.max(1, p - 1))}
                                disabled={leadsPage === 1}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white disabled:opacity-50 hover:bg-zinc-800"
                            >
                                Anterior
                            </button>
                            <span className="text-zinc-400">Página {leadsPage} de {getFilteredAndSortedUsers().totalPages}</span>
                            <button 
                                onClick={() => setLeadsPage(p => Math.min(getFilteredAndSortedUsers().totalPages, p + 1))}
                                disabled={leadsPage === getFilteredAndSortedUsers().totalPages}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white disabled:opacity-50 hover:bg-zinc-800"
                            >
                                Próxima
                            </button>
                        </div>
                    )}
                </div>
            )}
            
            {activeTab === 'sales' && (
                <div className="space-y-6 animate-in fade-in relative">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
                        <div>
                            <h3 className="text-xl font-bold text-white">Gerenciador de Vendas</h3>
                            <p className="text-zinc-400 text-sm">Visualize e filtre todas as transações.</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
                                <input 
                                    type="text" 
                                    placeholder="Buscar por nome ou CPF..." 
                                    value={salesSearch}
                                    onChange={(e) => { setSalesSearch(e.target.value); setSalesPage(1); }}
                                    className="bg-zinc-950 border border-zinc-700 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:border-brand-primary outline-none min-w-[250px]"
                                />
                            </div>
                            <select 
                                value={salesFilterStatus} 
                                onChange={(e) => setSalesFilterStatus(e.target.value as any)}
                                className="bg-zinc-950 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                            >
                                <option value="ALL">Todos os Status</option>
                                <option value="PAID">Apenas Pagos</option>
                                <option value="PENDING">Apenas Pendentes</option>
                            </select>

                            <select 
                                value={salesSort} 
                                onChange={(e) => setSalesSort(e.target.value as any)}
                                className="bg-zinc-950 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm focus:border-brand-primary outline-none"
                            >
                                <option value="DATE_DESC">Mais Recentes</option>
                                <option value="QTY_DESC">Maior Quantidade</option>
                                <option value="QTY_ASC">Menor Quantidade</option>
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto bg-zinc-900 rounded-2xl border border-zinc-800">
                        <table className="w-full text-left text-sm text-zinc-400">
                            <thead className="bg-zinc-950 text-xs uppercase font-bold text-zinc-500">
                                <tr>
                                    <th className="p-4">Data</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4">Rifa</th>
                                    <th className="p-4">Cliente (Nome)</th>
                                    <th className="p-4">CPF</th>
                                    <th className="p-4">Telefone</th>
                                    <th className="p-4">Qtd</th>
                                    <th className="p-4">Valor Bruto</th>
                                    <th className="p-4">Líquido Est. (Simplify)</th>
                                    <th className="p-4">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800">
                                {getFilteredAndSortedPurchases().items.map(p => {
                                    const fees = raffleService.calculateSimplifyFees(p.total_value || 0, stats.feeSettings);
                                    return (
                                    <tr key={p.id} className="hover:bg-zinc-800/50 transition-colors">
                                        <td className="p-4 whitespace-nowrap">{new Date(p.purchase_date).toLocaleDateString()} <span className="text-zinc-600">{new Date(p.purchase_date).toLocaleTimeString()}</span></td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                                isPaidStatus(p)
                                                ? 'bg-green-900/20 text-green-400 border-green-900/50'
                                                : isCancelledStatus(p)
                                                ? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                : 'bg-yellow-900/20 text-yellow-400 border-yellow-900/50'
                                            }`}>
                                                {isPaidStatus(p) ? 'PAGO' : isCancelledStatus(p) ? 'CANCELADO' : 'PENDENTE'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-white font-medium">{p.raffles?.name || '---'}</td>
                                        <td className="p-4 text-white font-bold">{p.name || 'Sem nome'}</td>
                                        <td className="p-4 font-mono">{p.cpf}</td>
                                        <td className="p-4">{p.phone}</td>
                                        <td className="p-4 text-white font-bold">{p.quantity}</td>
                                        <td className="p-4 text-white font-bold">R$ {Number(p.total_value || 0).toFixed(2)}</td>
                                        <td className="p-4 font-bold">
                                            {p.status === 'PAID' ? (
                                                <div>
                                                    <span className="text-brand-primary-light">R$ {Number(fees.netRevenue || 0).toFixed(2)}</span>
                                                    <div className="text-[10px] text-zinc-500 font-normal">-R$ {Number(fees.totalFees || 0).toFixed(2)} taxas</div>
                                                </div>
                                            ) : (
                                                <span className="text-zinc-500 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 flex gap-2">
                                            <a 
                                                href={`https://wa.me/55${(p.phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                                                    p.status === 'PENDING' 
                                                    ? `Olá ${p.name}, vi que você gerou um PIX para a rifa ${p.raffles?.name} mas ainda não finalizou. Posso ajudar?`
                                                    : `Parabéns ${p.name}! Seus bilhetes da rifa ${p.raffles?.name} já estão garantidos. Que tal aumentar suas chances?`
                                                )}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title="Enviar WhatsApp"
                                                className="p-2 text-brand-primary hover:text-brand-primary-light bg-zinc-950 rounded hover:bg-zinc-800 transition-colors"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/></svg>
                                            </a>
                                            <button 
                                                onClick={() => handleViewTickets(p)} 
                                                title="Ver bilhetes"
                                                className="p-2 text-zinc-400 hover:text-brand-primary bg-zinc-950 rounded hover:bg-zinc-800 transition-colors"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button 
                                                onClick={() => setEditPurchase(p)} 
                                                className="text-brand-primary-light hover:text-white hover:underline text-xs flex items-center px-2"
                                            >
                                                Editar
                                            </button>
                                        </td>
                                    </tr>
                                ); })}
                            </tbody>
                        </table>
                    </div>
                    
                    {getFilteredAndSortedPurchases().totalPages > 1 && (
                        <div className="flex justify-center items-center gap-2 mt-4">
                            <button 
                                onClick={() => setSalesPage(p => Math.max(1, p - 1))}
                                disabled={salesPage === 1}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white disabled:opacity-50 hover:bg-zinc-800"
                            >
                                Anterior
                            </button>
                            <span className="text-zinc-400">Página {salesPage} de {getFilteredAndSortedPurchases().totalPages}</span>
                            <button 
                                onClick={() => setSalesPage(p => Math.min(getFilteredAndSortedPurchases().totalPages, p + 1))}
                                disabled={salesPage === getFilteredAndSortedPurchases().totalPages}
                                className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white disabled:opacity-50 hover:bg-zinc-800"
                            >
                                Próxima
                            </button>
                        </div>
                    )}

                    {/* VIEW TICKETS MODAL */}
                    {viewingPurchaseTickets && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                            <Ticket className="text-brand-primary"/> Bilhetes da Compra
                                        </h3>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            Cliente: <span className="text-white font-bold">{viewingPurchaseTickets.info.name}</span>
                                        </p>
                                        <p className="text-zinc-500 text-xs">
                                            Rifa: {viewingPurchaseTickets.info.raffles?.name}
                                        </p>
                                    </div>
                                    <button onClick={() => setViewingPurchaseTickets(null)} className="text-zinc-500 hover:text-white">
                                        <X size={24} />
                                    </button>
                                </div>
                                
                                <div className="flex-1 overflow-y-auto bg-black/30 rounded-xl p-4 border border-zinc-800 custom-scrollbar">
                                    {viewingPurchaseTickets.numbers.length === 0 ? (
                                        <p className="text-zinc-500 text-center py-8">Nenhum bilhete encontrado (Erro de dados).</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 justify-center">
                                            {viewingPurchaseTickets.numbers.map(num => (
                                                <span key={num} className="font-mono text-lg font-bold text-brand-primary bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg min-w-[80px] text-center">
                                                    {String(num)}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="mt-4 text-right text-zinc-500 text-xs">
                                    Total de {viewingPurchaseTickets.numbers.length} cotas
                                </div>
                            </div>
                        </div>
                    )}

                     {editPurchase && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                            <div className="bg-zinc-900 border border-zinc-700 p-6 rounded-2xl w-full max-w-md">
                                <h3 className="text-xl font-bold text-white mb-4">Editar Dados da Compra</h3>
                                <form noValidate onSubmit={handleUpdatePurchase} className="space-y-4">
                                    <div>
                                        <label className="label-admin">Nome do Cliente</label>
                                        <input className="input-admin" value={editPurchase.name || ''} onChange={e => setEditPurchase({...editPurchase, name: formatName(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="label-admin">CPF do Cliente</label>
                                        <input className="input-admin" value={editPurchase.cpf} onChange={e => setEditPurchase({...editPurchase, cpf: formatCPF(e.target.value)})} maxLength={14} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Telefone</label>
                                        <input className="input-admin" value={editPurchase.phone} onChange={e => setEditPurchase({...editPurchase, phone: formatPhone(e.target.value)})} maxLength={15} />
                                    </div>
                                    <div>
                                        <label className="label-admin">Data e Hora da Compra</label>
                                        <input 
                                            type="datetime-local" 
                                            className="input-admin" 
                                            value={editPurchase.purchase_date ? new Date(editPurchase.purchase_date).toISOString().slice(0, 16) : ''} 
                                            onChange={e => setEditPurchase({...editPurchase, purchase_date: e.target.value})} 
                                        />
                                    </div>
                                    <div className="flex gap-2 pt-4">
                                        <button type="button" onClick={() => setEditPurchase(null)} className="flex-1 bg-zinc-800 py-3 rounded-lg text-white hover:bg-zinc-700">Cancelar</button>
                                        <button className="flex-1 bg-brand-primary-dark py-3 rounded-lg text-[#fff] font-bold hover:bg-brand-primary">Salvar Dados</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'simulation' && (
                <AdminSimulation raffles={raffles} />
            )}

             {activeTab === 'site' && (
                <div className="space-y-6 animate-in fade-in">
                    
                    {/* WHITE LABEL - IDENTIDADE DA MARCA */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                <ImageIcon size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Identidade Visual da Marca</h3>
                                <p className="text-xs text-zinc-400">Personalize o logotipo de texto (Navbar e Rodapé) e o esquema de cores global (Tema).</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveSiteSettings} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="label-admin">Nome Principal (Cor do Tema) <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={brandPrimary} 
                                        onChange={(e) => setBrandPrimary(e.target.value)}
                                        placeholder="Ex: MARCA" 
                                        className="input-admin"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label-admin">Nome Secundário (Branco) <span className="text-zinc-500">(Opcional)</span></label>
                                    <input 
                                        type="text" 
                                        value={brandSecondary} 
                                        onChange={(e) => setBrandSecondary(e.target.value)}
                                        placeholder="Ex: NOME" 
                                        className="input-admin"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="label-admin">Selecione o Tema de Cores</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                                    {[
                                        { id: 'azure', label: 'Azure', bg: 'bg-brand-primary' },
                                        { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
                                        { id: 'ruby', label: 'Ruby', bg: 'bg-red-500' },
                                        { id: 'amethyst', label: 'Amethyst', bg: 'bg-violet-500' },
                                        { id: 'gold', label: 'Gold', bg: 'bg-yellow-500' },
                                        { id: 'onyx', label: 'Onyx', bg: 'bg-zinc-300' },
                                    ].map(theme => (
                                        <button
                                            type="button"
                                            key={theme.id}
                                            onClick={() => setSiteTheme(theme.id)}
                                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${siteTheme === theme.id ? 'border-white bg-zinc-800' : 'border-zinc-800 bg-zinc-950 hover:border-zinc-600'}`}
                                        >
                                            <div className={`w-6 h-6 rounded-full ${theme.bg} shadow-md`}></div>
                                            <span className="text-xs font-bold text-white uppercase">{theme.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/50">
                                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-3">Preview Visual (Logotipo)</p>
                                <div className="flex items-center">
                                    <span className="font-black text-3xl tracking-tighter" style={{
                                        color: siteTheme === 'azure' ? '#3b82f6' : 
                                               siteTheme === 'emerald' ? '#10b981' : 
                                               siteTheme === 'ruby' ? '#ef4444' : 
                                               siteTheme === 'amethyst' ? '#8b5cf6' : 
                                               siteTheme === 'gold' ? '#eab308' : '#ffffff'
                                    }}>
                                        {brandPrimary || WHITE_LABEL_CONFIG.brandPrimary}
                                    </span>
                                    {brandSecondary && (
                                        <span className="font-black text-3xl tracking-tighter text-white ml-2">
                                            {brandSecondary}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Mode Selection */}
                            <div className="mt-6 border-t border-zinc-800 pt-6">
                                <label className="label-admin mb-3">Estilo do Fundo</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div 
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${siteMode === 'dark' ? 'border-brand-primary bg-brand-primary/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                                        onClick={() => setSiteMode('dark')}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-950 border border-zinc-800 shadow-inner flex items-center justify-center">
                                                {siteMode === 'dark' && <div className="w-3 h-3 rounded-full bg-brand-primary" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">Escuro (Padrão)</div>
                                                <div className="text-xs text-zinc-500">Fundo escuro, alto contraste</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div 
                                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${siteMode === 'light' ? 'border-brand-primary bg-brand-primary/10' : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'}`}
                                        onClick={() => setSiteMode('light')}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white border border-zinc-300 shadow-inner flex items-center justify-center">
                                                {siteMode === 'light' && <div className="w-3 h-3 rounded-full bg-brand-primary" />}
                                            </div>
                                            <div>
                                                <div className="font-bold text-white text-sm">Claro</div>
                                                <div className="text-xs text-zinc-500">Fundo gelo, cards brancos</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <button type="submit" disabled={savingSiteSettings} className="w-full bg-green-600 hover:bg-green-500 text-[#fff] font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 mt-6">
                                {savingSiteSettings ? <><Loader2 size={20} className="animate-spin" /> Salvando...</> : 'Salvar Identidade e Tema'}
                            </button>
                        </form>
                    </div>


                    {/* Configurações Gerais do Site, Favicon e Meta Tags do WhatsApp */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                                <Globe size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Identidade do Site & Compartilhamento (WhatsApp)</h3>
                                <p className="text-xs text-zinc-400">Configure o nome do site, favicon da aba do navegador e o texto/capa do link enviado no WhatsApp.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveSiteSettings} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Site Title */}
                                <div>
                                    <label className="label-admin">Nome do Site <span className="text-red-500">*</span></label>
                                    <input 
                                        type="text" 
                                        value={siteTitle} 
                                        onChange={(e) => setSiteTitle(e.target.value)}
                                        placeholder="Nova Plataforma" 
                                        className="input-admin"
                                        required
                                    />
                                    <p className="text-[11px] text-zinc-500 mt-1">Exibido na aba do navegador e no título do WhatsApp.</p>
                                </div>

                                {/* Favicon Upload */}
                                <div>
                                    <label className="label-admin">Favicon do Site (Ícone do Navegador)</label>
                                    <div className="flex items-center gap-4 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                                        <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                                            {siteFavicon ? (
                                                <img src={siteFavicon} alt="Favicon Preview" className="w-8 h-8 object-contain" />
                                            ) : (
                                                <span className="text-xl font-black text-brand-primary">M</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <input 
                                                type="file" 
                                                id="favicon-upload-input" 
                                                accept="image/*" 
                                                onChange={handleFaviconFileChange}
                                                disabled={isUploadingFavicon}
                                                className="hidden" 
                                            />
                                            <label 
                                                htmlFor="favicon-upload-input" 
                                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer transition-colors"
                                            >
                                                {isUploadingFavicon ? <Loader2 className="w-4 h-4 animate-spin text-brand-primary" /> : <Upload size={14} />}
                                                <span>{isUploadingFavicon ? 'Enviando...' : 'Subir Novo Favicon'}</span>
                                            </label>
                                            <p className="text-[10px] text-zinc-500 mt-1 truncate">{siteFavicon ? 'Favicon personalizado ativo' : 'Suporta PNG, ICO, SVG ou WebP (Formato quadrado)'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Site Description for WhatsApp */}
                            <div>
                                <label className="label-admin">Descrição do Site (Compartilhamento WhatsApp / Redes Sociais)</label>
                                <textarea 
                                    value={siteDescription} 
                                    onChange={(e) => setSiteDescription(e.target.value)} 
                                    rows={3} 
                                    className="input-admin resize-none" 
                                    placeholder="Escreva uma descrição atrativa para o site..."
                                />
                                <p className="text-[11px] text-zinc-500 mt-1">Este texto é exibido logo abaixo do nome do site na prévia do link do WhatsApp.</p>
                            </div>

                            {/* WhatsApp Share Card Image */}
                            <div>
                                <label className="label-admin">Imagem de Capa do WhatsApp (Preview Card)</label>
                                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center bg-zinc-950 p-4 rounded-xl border border-zinc-800">
                                    {siteOgImage && (
                                        <div className="w-32 aspect-video rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 shrink-0">
                                            <img src={siteOgImage} alt="WhatsApp Card Preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <input 
                                            type="file" 
                                            id="og-image-upload-input" 
                                            accept="image/*" 
                                            onChange={handleOgImageFileChange} 
                                            disabled={isUploadingOgImage} 
                                            className="hidden" 
                                        />
                                        <label 
                                            htmlFor="og-image-upload-input" 
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold cursor-pointer transition-colors"
                                        >
                                            {isUploadingOgImage ? <Loader2 className="w-4 h-4 animate-spin text-brand-primary" /> : <ImageIcon size={16} />}
                                            <span>{isUploadingOgImage ? 'Enviando Imagem...' : 'Enviar Imagem de Capa do WhatsApp'}</span>
                                        </label>
                                        <p className="text-[10px] text-zinc-500 mt-1">Formato ideal: 1200x630px em JPG ou PNG para exibir um banner grande no WhatsApp.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Notifications Settings */}
                            <div className="pt-6 border-t border-zinc-800">
                                <div className="mb-4">
                                    <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                        Notificações de Compras (Prova Social)
                                    </h4>
                                    <p className="text-xs text-zinc-400">Configure os balões de "Fulano acabou de comprar X cotas" exibidos no rodapé do site.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1">
                                        <label className="label-admin mb-2 block">Ativar Notificações?</label>
                                        <button
                                            type="button"
                                            onClick={() => setNotificationEnabled(!notificationEnabled)}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationEnabled ? 'bg-brand-primary' : 'bg-zinc-600'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                        <span className="ml-3 text-sm text-zinc-300 font-medium">
                                            {notificationEnabled ? 'Ligado' : 'Desligado'}
                                        </span>
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="label-admin">Quantidade Mínima</label>
                                        <input
                                            type="number"
                                            value={notificationMin}
                                            onChange={(e) => setNotificationMin(parseInt(e.target.value) || 0)}
                                            min="0"
                                            className="input-admin"
                                        />
                                    </div>
                                    <div className="md:col-span-1">
                                        <label className="label-admin">Quantidade Máxima</label>
                                        <input
                                            type="number"
                                            value={notificationMax}
                                            onChange={(e) => setNotificationMax(parseInt(e.target.value) || 0)}
                                            min="0"
                                            className="input-admin"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Submit Settings */}
                            <div className="flex justify-end pt-2 border-t border-zinc-800">
                                <button 
                                    type="submit" 
                                    disabled={savingSiteSettings}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-brand-primary hover:bg-brand-primary-light text-black font-black text-sm uppercase tracking-wider transition-colors shadow-lg shadow-brand-primary/20"
                                >
                                    {savingSiteSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                                    <span>{savingSiteSettings ? 'Salvando...' : 'Salvar Configurações do Site'}</span>
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Section 2: Banners da Home */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <h3 className="text-xl font-bold text-white mb-6">Banners Carrossel da Home</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                            {banners.length === 0 ? (
                                <div className="col-span-full p-8 text-center bg-zinc-950/50 border border-zinc-800 rounded-xl text-zinc-500 font-bold text-sm">
                                    Nenhum banner cadastrado no momento. Envie um novo banner abaixo.
                                </div>
                            ) : (
                                banners.map(b => (
                                    <div key={b.id} className="group relative aspect-video rounded-xl overflow-hidden border border-zinc-700 bg-zinc-950">
                                        <img src={imageSrc(b.image_url)} onError={handleImageError} className="w-full h-full object-cover" alt="Banner" />
                                        <button onClick={() => handleDeleteBanner(b)} className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 p-2 rounded-full text-[#fff] opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" title="Remover Banner">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="bg-zinc-950 p-6 rounded-xl border border-zinc-800 flex flex-col md:flex-row gap-4 items-center">
                            <div className="flex-1 w-full">
                                <label className="label-admin">Adicionar Banner <span className="text-zinc-500 text-[10px] ml-1 normal-case font-normal">(Ideal: 1920x600px, Máx: 5MB)</span></label>
                                
                                <input 
                                    type="file" 
                                    id="banner-image-upload"
                                    accept="image/*"
                                    onChange={handleBannerFileChange}
                                    disabled={isUploadingBanner}
                                    className="hidden"
                                />
                                <label 
                                    htmlFor="banner-image-upload"
                                    className={`
                                        flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl cursor-pointer transition-colors w-full
                                        ${isUploadingBanner ? 'border-zinc-700 bg-zinc-900' : 'border-zinc-700 hover:border-brand-primary hover:bg-zinc-800/50'}
                                    `}
                                >
                                    {isUploadingBanner ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                                            <span className="text-sm font-bold text-brand-primary">Enviando Banner...</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 text-zinc-400 hover:text-brand-primary transition-colors">
                                            <ImageIcon size={32} />
                                            <span className="font-bold">Clique para Enviar Novo Banner</span>
                                            <span className="text-xs">JPG, PNG ou WebP</span>
                                        </div>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Taxas de Operação Simplify Pay */}
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-zinc-800">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Taxas da Gateway Simplify Pay</h3>
                                <p className="text-xs text-zinc-400">Configure as taxas cobradas pelo intermediador de pagamento para cálculo exato do Faturamento Líquido.</p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveFeeSettings} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Depósito Fee */}
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">1. Taxa de Depósito / Venda (PIX)</h4>
                                    <div>
                                        <label className="label-admin">Taxa Percentual (%)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={feeDepositPercent} 
                                            onChange={(e) => setFeeDepositPercent(e.target.value)}
                                            className="input-admin"
                                            placeholder="2.50"
                                            required
                                        />
                                        <p className="text-[11px] text-zinc-500 mt-1">Exemplo: 2.50% por transação</p>
                                    </div>
                                    <div>
                                        <label className="label-admin">Taxa Mínima Por Venda (R$)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={feeDepositMin} 
                                            onChange={(e) => setFeeDepositMin(e.target.value)}
                                            className="input-admin"
                                            placeholder="0.50"
                                            required
                                        />
                                        <p className="text-[11px] text-zinc-500 mt-1">Aplica-se caso a porcentagem resulte em menos de R$ 0,50 (ex: compras menores de R$ 20,00)</p>
                                    </div>
                                </div>

                                {/* Saque Fee */}
                                <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
                                    <h4 className="text-sm font-bold text-amber-400 uppercase tracking-wider">2. Taxa de Saque / Liquidação</h4>
                                    <div>
                                        <label className="label-admin">Taxa Percentual de Saque (%)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={feeWithdrawalPercent} 
                                            onChange={(e) => setFeeWithdrawalPercent(e.target.value)}
                                            className="input-admin"
                                            placeholder="2.00"
                                            required
                                        />
                                        <p className="text-[11px] text-zinc-500 mt-1">Exemplo: 2.00% sobre o saldo a ser transferido</p>
                                    </div>
                                    <div>
                                        <label className="label-admin">Taxa Mínima de Saque (R$)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={feeWithdrawalMin} 
                                            onChange={(e) => setFeeWithdrawalMin(e.target.value)}
                                            className="input-admin"
                                            placeholder="0.50"
                                            required
                                        />
                                        <p className="text-[11px] text-zinc-500 mt-1">Taxa mínima cobrada por solicitação de saque</p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-zinc-800">
                                <button 
                                    type="submit" 
                                    disabled={savingFeeSettings}
                                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-sm uppercase tracking-wider transition-colors shadow-lg shadow-amber-500/20"
                                >
                                    {savingFeeSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={18} />}
                                    <span>{savingFeeSettings ? 'Salvando...' : 'Salvar Taxas do Gateway'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SEARCH TAB */}
            {activeTab === 'search' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                            <Search className="text-brand-primary" /> Pesquisa Universal de Compras
                        </h3>
                        
                        <form noValidate onSubmit={handleUniversalSearch} className="flex gap-4 relative z-10">
                            <input
                                type="text"
                                value={universalSearchTerm}
                                onChange={(e) => {
                                    setUniversalSearchTerm(e.target.value);
                                    setSearchedUniversal(false);
                                }}
                                placeholder="Digite CPF, Nome ou Número do Bilhete..."
                                className="flex-1 bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-brand-primary outline-none transition-colors"
                            />
                            <button 
                                type="submit"
                                disabled={isSearchingUniversal}
                                className="bg-brand-primary-dark hover:bg-brand-primary text-black font-bold px-8 py-4 rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSearchingUniversal ? <Loader2 className="animate-spin" /> : <Search />}
                                Pesquisar
                            </button>
                        </form>
                    </div>

                    {universalSearchResults.length > 0 && (
                        <div className="space-y-4">
                            {universalSearchResults.map((purchase) => (
                                <div key={purchase.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-lg">
                                    <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
                                        <div>
                                            <h4 className="text-lg font-bold text-white">{purchase.buyer_name}</h4>
                                            <p className="text-zinc-400 text-sm">{purchase.buyer_cpf} • {purchase.buyer_phone}</p>
                                            <p className="text-brand-primary-light text-sm font-bold mt-1">{purchase.raffles?.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                purchase.status === 'PAID' ? 'bg-green-900/30 text-green-400 border border-green-900/50' :
                                                purchase.status === 'PENDING' ? 'bg-blue-900/30 text-brand-primary-light border border-blue-900/50' :
                                                'bg-red-900/30 text-red-400 border border-red-900/50'
                                            }`}>
                                                {purchase.status}
                                            </span>
                                            <p className="text-zinc-500 text-xs mt-2">
                                                {new Date(purchase.purchase_date || purchase.created_at).toLocaleString('pt-BR')}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="bg-black/50 rounded-lg p-4 border border-zinc-800 mb-4">
                                        <p className="text-xs text-zinc-500 font-bold uppercase mb-2">Bilhetes ({purchase.quantity})</p>
                                        <div className="flex flex-wrap gap-2">
                                            {purchase.tickets?.map((t: number) => (
                                                <span key={t} className="bg-zinc-800 text-zinc-300 px-2 py-1 rounded text-xs font-mono">
                                                    {String(t).padStart(5, '0')}
                                                </span>
                                            ))}
                                            {(!purchase.tickets || purchase.tickets.length === 0) && (
                                                <span className="text-zinc-500 text-sm italic">Nenhum bilhete gerado.</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 border-t border-zinc-800 pt-4">
                                        {editingPurchaseDate === purchase.id ? (
                                            <div className="flex items-center gap-2 w-full bg-zinc-950 p-3 rounded-lg border border-zinc-800">
                                                <input 
                                                    type="datetime-local" 
                                                    value={newPurchaseDateValue}
                                                    onChange={(e) => setNewPurchaseDateValue(e.target.value)}
                                                    className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none focus:border-brand-primary flex-1"
                                                />
                                                <input 
                                                    type="password" 
                                                    placeholder="Senha Mestra"
                                                    value={actionPassword}
                                                    onChange={(e) => setActionPassword(e.target.value)}
                                                    className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none focus:border-brand-primary w-32"
                                                />
                                                <button 
                                                    onClick={() => handleUpdateUniversalPurchaseDate(purchase.id)}
                                                    className="bg-brand-primary-dark hover:bg-brand-primary text-black font-bold px-4 py-2 rounded text-sm transition-colors"
                                                >
                                                    Salvar
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        setEditingPurchaseDate(null);
                                                        setNewPurchaseDateValue('');
                                                        setActionPassword('');
                                                    }}
                                                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded text-sm transition-colors"
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        ) : (
                                            <button 
                                                onClick={() => {
                                                    setEditingPurchaseDate(purchase.id);
                                                    // Formata a data atual para o input datetime-local (YYYY-MM-DDThh:mm)
                                                    const dateObj = new Date(purchase.purchase_date || purchase.created_at);
                                                    // Ajuste para timezone local
                                                    const tzOffset = dateObj.getTimezoneOffset() * 60000;
                                                    const localISOTime = (new Date(dateObj.getTime() - tzOffset)).toISOString().slice(0, 16);
                                                    setNewPurchaseDateValue(localISOTime);
                                                }}
                                                className="flex items-center gap-2 text-brand-primary-light hover:text-blue-300 bg-blue-900/10 hover:bg-blue-900/30 px-4 py-2 rounded-lg transition-colors text-sm font-bold"
                                            >
                                                <Calendar size={16} /> Editar Data/Hora
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {universalSearchResults.length === 0 && searchedUniversal && !isSearchingUniversal && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                            <Search className="w-12 h-12 text-zinc-600 mx-auto mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-white mb-2">Nenhuma compra encontrada</h3>
                            <p className="text-zinc-500">Tente pesquisar por outro CPF, nome ou número de bilhete.</p>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'revelation' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-10 -mt-10"></div>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2 relative z-10">
                            <Sparkles className="text-brand-primary" /> Revelar Ganhador
                        </h3>
                        
                        <form noValidate onSubmit={handleRevealWinner} className="flex flex-col md:flex-row gap-4 relative z-10">
                            <select 
                                value={revelationRaffleId}
                                onChange={(e) => setRevelationRaffleId(e.target.value)}
                                className="flex-1 bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-brand-primary outline-none transition-colors"
                                
                            >
                                <option value="">Selecione a Rifa...</option>
                                {raffles.map(r => (
                                    <option key={r.id} value={r.id}>{r.name} ({r.status})</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                value={revelationTicketNumber}
                                onChange={(e) => setRevelationTicketNumber(e.target.value)}
                                placeholder="Número Sorteado (ex: 123456)"
                                className="flex-1 bg-black border border-zinc-700 rounded-xl p-4 text-white focus:border-brand-primary outline-none transition-colors"
                                
                            />
                            <button 
                                type="submit"
                                disabled={isRevealing || !revelationRaffleId || !revelationTicketNumber}
                                className="bg-brand-primary-dark hover:bg-brand-primary text-black font-bold px-8 py-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isRevealing ? <Loader2 className="animate-spin" /> : <Sparkles />}
                                Revelar
                            </button>
                        </form>
                    </div>

                    {hasRevealed && revelationResult && (
                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl animate-in zoom-in-95 text-center relative overflow-hidden">
                            {revelationResult.found ? (
                                <>
                                    <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/10 to-transparent pointer-events-none"></div>
                                    <Trophy className="w-24 h-24 text-brand-primary mx-auto mb-6 animate-bounce" />
                                    <h2 className="text-4xl font-black text-white mb-2 uppercase tracking-tight">Temos um Ganhador!</h2>
                                    <p className="text-brand-primary-light text-xl font-bold mb-8">Bilhete Premiado: {String(revelationResult.winningTicket)}</p>
                                    
                                    <div className="bg-black/50 border border-zinc-800 rounded-xl p-6 max-w-2xl mx-auto text-left space-y-4 relative z-10">
                                        <div>
                                            <p className="text-zinc-500 text-sm font-bold uppercase mb-1">Nome do Ganhador</p>
                                            <p className="text-2xl text-white font-bold">{revelationResult.buyerName}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-zinc-500 text-sm font-bold uppercase mb-1">CPF</p>
                                                <p className="text-lg text-zinc-300 font-mono">
                                                    {(revelationResult.buyerCpf || '').replace(/\D/g, '').replace(/(\d{3})(\d{2})\d(\d{3})(\d{2})/, '$1.$2*.***-**')}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-zinc-500 text-sm font-bold uppercase mb-1">Telefone</p>
                                                <p className="text-lg text-zinc-300 font-mono">
                                                    {(revelationResult.buyerPhone || '').replace(/\D/g, '').replace(/(\d{2})(9\d{2})\d{2}(\d{4})/, '($1) $2**-****')}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-zinc-500 text-sm font-bold uppercase mb-1">Data da Compra</p>
                                            <p className="text-lg text-zinc-300">{new Date(revelationResult.purchaseDate).toLocaleString('pt-BR')}</p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="py-12">
                                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 opacity-80" />
                                    <h3 className="text-2xl font-bold text-white mb-2">Nenhum Comprador Encontrado</h3>
                                    <p className="text-zinc-400 text-lg">{revelationResult.message}</p>
                                    <p className="text-zinc-500 mt-4">Você pode registrar o ganhador manualmente abaixo.</p>
                                </div>
                            )}

                            {/* Register Winner Form */}
                            {!showRegisterWinnerForm ? (
                                <div className="mt-8 text-center">
                                    <button 
                                        onClick={() => setShowRegisterWinnerForm(true)}
                                        className="bg-brand-primary-dark hover:bg-brand-primary text-[#fff] font-bold py-3 px-6 rounded-xl transition-colors"
                                    >
                                        {revelationResult.found ? 'Salvar Ganhador Oficialmente' : 'Definir Ganhador Manualmente'}
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleRegisterWinnerSubmit} className="mt-8 bg-zinc-900 border border-zinc-700 rounded-xl p-6 space-y-4">
                                    <h4 className="text-white font-bold text-lg mb-4">
                                        {revelationResult.found ? 'Dados da Premiação' : 'Dados do Ganhador Manual'}
                                    </h4>
                                    
                                    {!revelationResult.found && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                                            <div>
                                                <label className="label-admin">Nome Completo *</label>
                                                <input 
                                                    type="text"
                                                    className="input-admin w-full"
                                                    value={registerWinnerForm.winnerName}
                                                    onChange={e => setRegisterWinnerForm({...registerWinnerForm, winnerName: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="label-admin">Telefone (Opcional)</label>
                                                <input 
                                                    type="text"
                                                    className="input-admin w-full"
                                                    value={registerWinnerForm.winnerPhone}
                                                    onChange={e => setRegisterWinnerForm({...registerWinnerForm, winnerPhone: formatPhone(e.target.value)})}
                                                />
                                            </div>
                                        </div>
                                    )}
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="label-admin">Tipo do Prêmio</label>
                                                        <select 
                                                            className="input-admin w-full"
                                                            value={registerWinnerForm.prizeType}
                                                            onChange={e => setRegisterWinnerForm({...registerWinnerForm, prizeType: e.target.value})}
                                                        >
                                                            <option value="rifa">Ganhador da Rifa (Prêmio Principal)</option>
                                                            <option value="bilhete">Bilhete Premiado</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="label-admin">Valor do Prêmio (R$)</label>
                                                        <input 
                                                            type="text"
                                                            className="input-admin w-full"
                                                            placeholder="Ex: 1000,00"
                                                            value={registerWinnerForm.prizeValue}
                                                            onChange={e => setRegisterWinnerForm({...registerWinnerForm, prizeValue: e.target.value})}
                                                        />
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="label-admin">Descrição do Prêmio</label>
                                                    <input 
                                                        type="text"
                                                        className="input-admin w-full"
                                                        placeholder="Ex: Rifa R$ 1.000 no PIX"
                                                        value={registerWinnerForm.prizeDescription}
                                                        onChange={e => setRegisterWinnerForm({...registerWinnerForm, prizeDescription: e.target.value})}
                                                    />
                                                </div>

                                                <div>
                                                    <label className="label-admin">Foto do Ganhador (Opcional, Max 2MB)</label>
                                                    <input 
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/jpg"
                                                        className="w-full text-white bg-black border border-zinc-700 rounded-lg p-2"
                                                        onChange={e => {
                                                            const file = e.target.files?.[0];
                                                            if (file) setRegisterWinnerForm({...registerWinnerForm, imageFile: file});
                                                        }}
                                                    />
                                                    <p className="text-xs text-zinc-500 mt-1">A imagem será cortada em formato quadrado (1:1) automaticamente e mostrada na aba de Ganhadores.</p>
                                                </div>

                                                <div className="flex gap-4 pt-4">
                                                    <button 
                                                        type="button"
                                                        onClick={() => setShowRegisterWinnerForm(false)}
                                                        className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 rounded-xl transition-colors"
                                                    >
                                                        Cancelar
                                                    </button>
                                                    <button 
                                                        type="submit"
                                                        disabled={isRegisteringWinner}
                                                        className="flex-1 bg-brand-primary-dark hover:bg-brand-primary text-[#fff] font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
                                                    >
                                                        {isRegisteringWinner ? 'Salvando...' : 'Salvar Ganhador'}
                                                    </button>
                                                </div>
                                            </form>
                                        )}
                        </div>
                    )}
                </div>
            )}

            {/* PIXELS TAB */}
            {activeTab === 'pixels' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Code size={100} />
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-2">META PIXEL</h3>
                        <p className="text-zinc-400 mb-8 max-w-2xl">Adicione seus Pixels da Meta para rastrear as ações do site (PageView, CompleteRegistration, ViewContent, InitiateCheckout, Purchase). <strong>Funciona automaticamente para múltiplos pixels.</strong></p>
                        
                        <div className="flex flex-col sm:flex-row gap-4 mb-10 max-w-xl">
                            <input 
                                type="text"
                                id="new-pixel-id"
                                placeholder="ID DO PIXEL (Ex: 123456789012345)"
                                className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary font-mono text-sm"
                            />
                            <button 
                                onClick={async () => {
                                    const input = document.getElementById('new-pixel-id') as HTMLInputElement;
                                    const val = input.value.trim();
                                    if (!val) return;
                                    if (!/^\d+$/.test(val)) {
                                        alert('O ID do Pixel deve conter apenas números.');
                                        return;
                                    }
                                    try {
                                        await adminService.adminCreateMetaPixel(val);
                                        input.value = '';
                                        alert('Pixel cadastrado com sucesso!');
                                        loadPixels();
                                    } catch (e:any) {
                                        alert('Erro ao salvar Pixel: ' + e.message);
                                    }
                                }}
                                className="bg-brand-primary-dark hover:bg-brand-primary text-[#fff] font-bold py-3 px-6 rounded-xl transition-colors whitespace-nowrap"
                            >
                                + ADICIONAR PIXEL
                            </button>
                        </div>

                        <h4 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">PIXELS ATIVOS</h4>
                        
                        <div className="space-y-4 max-w-xl" id="pixels-list">
                            {pixelsList.length === 0 ? (
                                <div className="text-zinc-600 italic">Nenhum pixel cadastrado.</div>
                            ) : (
                                pixelsList.map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-950 rounded-xl border border-zinc-800">
                                        <div className="flex items-center gap-4">
                                            <div className={`w-3 h-3 rounded-full ${p.is_active ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-red-500'}`}></div>
                                            <div>
                                                <div className="text-lg font-mono font-bold text-white">{p.pixel_id}</div>
                                                <div className="text-xs text-zinc-500 uppercase tracking-wider">{p.is_active ? 'Ativo' : 'Desativado'}</div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={async () => {
                                                    try {
                                                        await adminService.adminToggleMetaPixel(p.id, !p.is_active);
                                                        loadPixels();
                                                    } catch (e:any) { alert(e.message); }
                                                }}
                                                className="px-3 py-1.5 text-xs font-bold uppercase rounded border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors"
                                            >
                                                {p.is_active ? 'Desativar' : 'Ativar'}
                                            </button>
                                            <button 
                                                onClick={async () => {
                                                    if(confirm('Tem certeza que deseja excluir este pixel?')) {
                                                        try {
                                                            await adminService.adminDeleteMetaPixel(p.id);
                                                            loadPixels();
                                                        } catch (e:any) { alert(e.message); }
                                                    }
                                                }}
                                                className="px-3 py-1.5 text-xs font-bold uppercase rounded border border-red-900/50 hover:border-red-500/50 text-red-500 hover:text-red-400 bg-red-500/10 transition-colors"
                                            >
                                                Excluir
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}


            {/* SUPPORT TAB */}
            {activeTab === 'suporte' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-xl">
                  <div>
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                      <MessageCircle className="text-brand-primary" /> Mensagens de Suporte Recebidas
                    </h3>
                    <p className="text-zinc-400 text-sm mt-1">
                      Mensagens enviadas pelos clientes na página de Suporte. Clique para abrir a conversa diretamente no WhatsApp.
                    </p>
                  </div>
                  <button 
                    onClick={() => {
                      setLoadingSupport(true);
                      raffleService.getSupportMessages().then(msgs => {
                        setSupportMessages(msgs);
                        setLoadingSupport(false);
                      }).catch(err => {
                        console.error("Error reloading support messages:", err);
                        setSupportMessages([]);
                        setLoadingSupport(false);
                      });
                    }}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-bold flex items-center gap-2 transition-colors self-start sm:self-auto"
                  >
                    <RefreshCw size={16} className={loadingSupport ? "animate-spin" : ""} /> Atualizar
                  </button>
                </div>

                {loadingSupport ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-brand-primary animate-spin mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">Carregando mensagens...</p>
                  </div>
                ) : supportMessages.length === 0 ? (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-12 text-center">
                    <MessageCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                    <h4 className="text-lg font-bold text-white mb-1">Nenhuma mensagem enviada ainda</h4>
                    <p className="text-zinc-500 text-sm">Quando os clientes enviarem dúvidas pelo formulário de contato, as mensagens ficarão disponíveis aqui.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {supportMessages.map((msg, idx) => {
                      const cleanPhone = (msg.phone || '').replace(/\D/g, '');
                      const whatsappUrl = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1%20${encodeURIComponent(msg.name || 'Cliente')}%2C%20sou%20da%20equipe%20de%20suporte%20da%20plataforma!%20Recebi%20sua%20mensagem%3A%20${encodeURIComponent(msg.message || '')}`;

                      return (
                        <div key={msg.id || idx} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl space-y-4 hover:border-zinc-700 transition-all flex flex-col justify-between">
                          <div className="space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <h4 className="font-bold text-white text-lg">{msg.name || 'Cliente'}</h4>
                                <p className="text-xs text-zinc-400 font-mono mt-0.5">{msg.email || 'Sem e-mail informado'}</p>
                              </div>
                              <span className="px-3 py-1 bg-blue-900/30 text-brand-primary-light border border-blue-800/40 rounded-full text-xs font-bold uppercase">
                                {msg.subject || 'Dúvida'}
                              </span>
                            </div>

                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
                              {msg.message}
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-4 border-t border-zinc-800/60 text-xs text-zinc-500">
                            <span>{msg.created_at ? new Date(msg.created_at).toLocaleString('pt-BR') : 'Data recente'}</span>
                            {cleanPhone ? (
                              <a
                                href={whatsappUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-2.5 bg-brand-primary hover:bg-brand-primary-light text-black font-black rounded-xl flex items-center gap-2 transition-all shadow-md shadow-blue-900/20 text-xs uppercase"
                              >
                                <MessageSquare size={16} fill="currentColor" />
                                Atender no WhatsApp
                              </a>
                            ) : (
                              <span className="text-zinc-600 font-bold">Sem telefone</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* FINALIZE RANKING MODAL */}
            {showFinalizeRanking && currentTopBuyer && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Trophy className="text-brand-primary" /> Finalizar Ciclo de Ranking
                        </h3>
                        
                        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-6 text-center">
                            <p className="text-zinc-400 text-xs uppercase font-bold mb-2">Ganhador Atual (Top 1)</p>
                            <h2 className="text-2xl font-bold text-white mb-1">{currentTopBuyer.name}</h2>
                            <p className="text-zinc-400 text-sm mb-4">{currentTopBuyer.totalTickets} cotas compradas</p>
                            
                            <div className="bg-zinc-900 p-3 rounded-lg border border-zinc-800 text-left">
                                <label className="label-admin">Prêmio Conquistado</label>
                                <input 
                                    className="input-admin text-center font-bold text-brand-primary" 
                                    value={currentTopBuyer.prize} 
                                    onChange={e => setCurrentTopBuyer({...currentTopBuyer, prize: e.target.value})}
                                />
                                <p className="text-[10px] text-zinc-500 mt-2 text-center">
                                    Você pode editar o prêmio antes de salvar no histórico.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowFinalizeRanking(false)}
                                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl font-bold transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={handleConfirmFinalizeRanking}
                                className="flex-1 bg-brand-primary-dark hover:bg-brand-primary text-[#fff] py-3 rounded-xl font-bold shadow-lg shadow-blue-900/20 transition-colors"
                            >
                                Confirmar e Reiniciar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Detalhamento de Taxas Simplify Pay */}
            {showFeeDetailsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
                    <div className="bg-zinc-900 border border-zinc-700 p-6 md:p-8 rounded-2xl w-full max-w-xl shadow-2xl relative">
                        <button 
                            onClick={() => setShowFeeDetailsModal(false)}
                            className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-white bg-zinc-800 rounded-full hover:bg-zinc-700"
                        >
                            ✕
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-brand-primary/10 border border-brand-primary/30 text-brand-primary-light rounded-xl">
                                <DollarSign size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-white">Detalhamento Faturamento Líquido</h3>
                                <p className="text-xs text-zinc-400">Simplify Pay • Transparência de Taxas de Operação</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-zinc-400 uppercase block">1. Faturamento Bruto</span>
                                    <span className="text-xs text-zinc-500">{stats.salesCount} vendas aprovadas</span>
                                </div>
                                <span className="text-xl font-black text-white">R$ {Number(stats.totalRevenue || 0).toFixed(2)}</span>
                            </div>

                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-2">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <span className="text-xs font-bold text-amber-400 uppercase block">2. Taxas de Depósito / PIX ({stats.feeSettings.depositFeePercent}% min R$ {Number(stats.feeSettings?.depositFeeMin || 0).toFixed(2)})</span>
                                        <span className="text-[11px] text-zinc-500">Aplicado em cada compra paga</span>
                                    </div>
                                    <span className="text-lg font-bold text-amber-400">-R$ {Number(stats.totalDepositFees || 0).toFixed(2)}</span>
                                </div>
                                <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-center text-xs">
                                    <span className="text-zinc-400">Saldo Restante para Saque:</span>
                                    <span className="font-bold text-zinc-200">R$ {Math.max(0, stats.totalRevenue - stats.totalDepositFees).toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex justify-between items-center">
                                <div>
                                    <span className="text-xs font-bold text-amber-400 uppercase block">3. Taxa de Saque / Transferência ({stats.feeSettings.withdrawalFeePercent}% min R$ {Number(stats.feeSettings?.withdrawalFeeMin || 0).toFixed(2)})</span>
                                    <span className="text-[11px] text-zinc-500">Aplicada sobre a transferência para sua conta bancária</span>
                                </div>
                                <span className="text-lg font-bold text-amber-400">-R$ {Number(stats.totalWithdrawalFees || 0).toFixed(2)}</span>
                            </div>

                            <div className="bg-gradient-to-r from-blue-950 to-zinc-950 p-5 rounded-xl border border-brand-primary/40 flex justify-between items-center shadow-lg">
                                <div>
                                    <span className="text-xs font-black text-brand-primary-light uppercase tracking-wider block">Faturamento Líquido Final</span>
                                    <span className="text-[11px] text-zinc-400">Valor disponível para resgate no seu bolso</span>
                                </div>
                                <span className="text-2xl font-black text-brand-primary-light">R$ {Number(stats.netRevenue || 0).toFixed(2)}</span>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={() => setShowFeeDetailsModal(false)}
                                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl transition-colors"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </main>
       <style>{`
        .label-admin { display: block; font-size: 0.75rem; color: #a1a1aa; font-weight: 700; text-transform: uppercase; margin-bottom: 0.25rem; }
        .input-admin { width: 100%; background-color: #09090b; border: 1px solid #27272a; border-radius: 0.5rem; padding: 0.75rem; color: white; outline: none; transition: border-color 0.2s; }
        .input-admin:focus { border-color: #2563eb; }
        .btn-icon { padding: 0.5rem; border-radius: 0.5rem; color: #a1a1aa; transition: all; }
      `}</style>
    </div>
  );
};