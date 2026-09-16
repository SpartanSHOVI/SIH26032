import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  Search,
  RefreshCw,
  BarChart3,
  Cpu,
  Zap,
  Activity,
  ArrowRight,
  Scale,
  DollarSign,
  Share2,
  ArrowUpRight,
  Volume2,
  Globe,
  Edit3,
  PlusCircle,
  ShieldCheck,
  History,
  Tag,
  X,
  ExternalLink,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { adminApi, bookingApi, locationApi, mspApi, MspRateItem, MspAuditItem } from '../services/api';
import {
  computeBookingsVsCapacity,
  computeWaitTimeTrends,
  computeCompletionRates,
  formatZeroStateCenter,
} from '../services/adminAnalytics';
import toast from 'react-hot-toast';
import { getLocalDateString } from '../utils/dateUtils';
import { useTranslation } from '../context/TranslationContext';
import { SUPPORTED_LANGUAGES, languageByCode, speakText } from '../utils/i18n';
import {
  COMMODITY_GROUPS,
  ALL_COMMODITIES,
  getCommodityGroup,
} from '../utils/commodityUtils';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { language, setLanguage, translating, languageInfo } = useTranslation();
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [activeTab, setActiveTab] = useState<'kpi' | 'prediction' | 'slot_allocation' | 'registry' | 'data_engineering' | 'msp_control'>('kpi');
  const [searchQuery, setSearchQuery] = useState('');

  const handleLangChange = (code: string) => {
    setLanguage(code);
    const selected = languageByCode(code);
    toast.success(`Nodal Command language set to ${selected?.nativeName || code}`);
    speakText(`Nodal portal language set to ${selected?.name || code}`, selected.speechCode);
  };

  // Location and classification filter state for Admin
  const [filterState, setFilterState] = useState<string>('');
  const [filterDistrict, setFilterDistrict] = useState<string>('');
  const [filterClassification, setFilterClassification] = useState<string>('');
  const [mandiSearch, setMandiSearch] = useState<string>('');

  // Demand prediction state
  const [predictionCenterId, setPredictionCenterId] = useState<string>('');

  // Slot generation state
  const [genState, setGenState] = useState<string>('');
  const [genDistrict, setGenDistrict] = useState<string>('');
  const [genCenterId, setGenCenterId] = useState<string>('');
  const [genDate, setGenDate] = useState<string>(getLocalDateString());
  const [genDemand, setGenDemand] = useState<number>(100);

  // Statutory MSP Rates and Audit State
  const [mspCategoryFilter, setMspCategoryFilter] = useState<string>('all');
  const [mspSeasonFilter, setMspSeasonFilter] = useState<string>('all');
  const [mspSearchQuery, setMspSearchQuery] = useState<string>('');
  const [editingMspRate, setEditingMspRate] = useState<MspRateItem | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editBonus, setEditBonus] = useState<number>(0);
  const [editMarket, setEditMarket] = useState<number>(0);
  const [editSeason, setEditSeason] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isAddMspModalOpen, setIsAddMspModalOpen] = useState<boolean>(false);
  const [showAuditDrawer, setShowAuditDrawer] = useState<boolean>(false);
  const [newCropName, setNewCropName] = useState<string>('');
  const [newCropCategory, setNewCropCategory] = useState<string>('Cereals');
  const [newCropSeason, setNewCropSeason] = useState<string>('Rabi 2025-26');
  const [newCropPrice, setNewCropPrice] = useState<number>(2275);
  const [newCropBonus, setNewCropBonus] = useState<number>(0);
  const [newCropMarket, setNewCropMarket] = useState<number>(2150);
  const [newCropNotes, setNewCropNotes] = useState<string>('');

  // Fetch MSP rates
  const { data: mspRates = [], isLoading: mspRatesLoading, refetch: refetchMspRates } = useQuery({
    queryKey: ['mspRates'],
    queryFn: async () => {
      const res = await mspApi.getAllRates();
      return res.data;
    },
  });

  // Fetch MSP audit logs
  const { data: mspAuditLogs = [], isLoading: mspAuditLoading, refetch: refetchMspAudit } = useQuery({
    queryKey: ['mspAuditLogs'],
    queryFn: async () => {
      const res = await mspApi.getAuditLogs({ limit: 100 });
      return res.data;
    },
    enabled: activeTab === 'msp_control' || showAuditDrawer,
  });

  // Update MSP Rate Mutation
  const updateMspMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await mspApi.updateRate(id, data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Updated MSP for ${data.crop} to ₹${data.effective_price}/Qtl!`);
      queryClient.invalidateQueries({ queryKey: ['mspRates'] });
      queryClient.invalidateQueries({ queryKey: ['mspAuditLogs'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      setEditingMspRate(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update MSP rate');
    },
  });

  // Create MSP Rate Mutation
  const createMspMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await mspApi.createRate(data);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Inscribed ${data.crop} at ₹${data.effective_price}/Qtl!`);
      queryClient.invalidateQueries({ queryKey: ['mspRates'] });
      queryClient.invalidateQueries({ queryKey: ['mspAuditLogs'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
      setIsAddMspModalOpen(false);
      setNewCropName('');
      setNewCropNotes('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to inscribe crop floor');
    },
  });

  // Sync Official CCEA / CACP Benchmarks Mutation
  const syncMspMutation = useMutation({
    mutationFn: async () => {
      const res = await mspApi.syncOfficialBenchmarks();
      return res.data;
    },
    onSuccess: (res) => {
      toast.success(`Synced statutory CCEA/CACP benchmarks! (${res.synced_count} commodities updated)`);
      queryClient.invalidateQueries({ queryKey: ['mspRates'] });
      queryClient.invalidateQueries({ queryKey: ['mspAuditLogs'] });
      queryClient.invalidateQueries({ queryKey: ['adminOverview'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to sync official benchmarks');
    },
  });

  // Fetch States for filter
  const { data: states = [] } = useQuery({
    queryKey: ['locationStates'],
    queryFn: async () => {
      const res = await locationApi.getStates();
      return res.data;
    },
  });

  // Fetch Districts when filterState changes
  const { data: districts = [] } = useQuery({
    queryKey: ['locationDistricts', filterState],
    queryFn: async () => {
      if (!filterState) return [];
      const res = await locationApi.getDistricts(filterState);
      return res.data;
    },
    enabled: !!filterState,
  });

  // Fetch Mandi Classifications
  const { data: classifications = [] } = useQuery({
    queryKey: ['locationClassifications'],
    queryFn: async () => {
      const res = await locationApi.getClassifications();
      return res.data;
    },
  });

  // Fetch Districts for Slot Allocation when genState changes
  const { data: slotGenDistricts = [], isLoading: slotGenDistrictsLoading } = useQuery({
    queryKey: ['slotGenDistricts', genState],
    queryFn: async () => {
      if (!genState) return [];
      const res = await locationApi.getDistricts(genState);
      return res.data;
    },
    enabled: !!genState,
  });

  // Fetch Centers for Slot Allocation filtered by selected genState and genDistrict
  const { data: slotGenCenters = [], isLoading: slotGenCentersLoading } = useQuery({
    queryKey: ['slotGenCenters', genState, genDistrict],
    queryFn: async () => {
      if (!genState) return [];
      const res = await bookingApi.getCenters({
        state: genState,
        district: genDistrict || undefined,
        limit: 100,
      });
      return res.data;
    },
    enabled: !!genState,
  });

  // Fetch all centers (first 200 for selector)
  const { data: centers = [] } = useQuery({
    queryKey: ['allCentersAdmin'],
    queryFn: async () => {
      const res = await bookingApi.getCenters({ limit: 200 });
      return res.data;
    },
  });

  // Fetch KPI Overview
  const { data: overview = {}, refetch: refetchOverview } = useQuery({
    queryKey: ['adminOverview', selectedDate],
    queryFn: async () => {
      const res = await adminApi.getOverview(selectedDate);
      return res.data;
    },
  });

  // Fetch Centers Congestion Table with filters
  const { data: centerStats = [] } = useQuery({
    queryKey: ['adminCenters', selectedDate, filterState, filterDistrict, filterClassification, mandiSearch],
    queryFn: async () => {
      const res = await adminApi.getCenters({
        date: selectedDate,
        state: filterState || undefined,
        district: filterDistrict || undefined,
        classification: filterClassification || undefined,
        search: mandiSearch || undefined,
        limit: 100,
      });
      return res.data;
    },
  });

  // Fetch Master Farmers & Tokens
  const { data: allFarmers = [], isLoading: farmersLoading } = useQuery({
    queryKey: ['adminFarmers'],
    queryFn: async () => {
      const res = await adminApi.getFarmers();
      return res.data;
    },
    enabled: activeTab === 'registry',
  });

  // Initialize default state for Slot Allocation
  useEffect(() => {
    if (states.length > 0 && !genState) {
      setGenState(states[0]);
    }
  }, [states, genState]);

  // Set default centers for prediction & generation safely within useEffect
  useEffect(() => {
    if (centers.length > 0 && !predictionCenterId) {
      setPredictionCenterId(centers[0].id);
    }
  }, [centers, predictionCenterId]);

  // Update selected genCenterId when filtered centers change
  useEffect(() => {
    if (slotGenCenters.length > 0) {
      const exists = slotGenCenters.some((c: any) => c.id === genCenterId);
      if (!exists) {
        setGenCenterId(slotGenCenters[0].id);
      }
    } else if (genState && slotGenCenters.length === 0 && !slotGenCentersLoading) {
      setGenCenterId('');
    }
  }, [slotGenCenters, genCenterId, genState, slotGenCentersLoading]);

  // Fetch Demand Prediction for selected center
  const { data: predictionData = null, isLoading: predictionLoading } = useQuery({
    queryKey: ['demandPrediction', predictionCenterId],
    queryFn: async () => {
      if (!predictionCenterId) return null;
      const res = await adminApi.predictDemand(predictionCenterId);
      return res.data;
    },
    enabled: activeTab === 'prediction' && !!predictionCenterId,
  });

  // Generate Slots Mutation
  const generateSlotsMutation = useMutation({
    mutationFn: () => adminApi.generateSlots(genCenterId, genDemand, genDate),
    onSuccess: (res: any) => {
      toast.success(`Generated slots! Hourly allocation: ${res.data.per_hour_allocation} farmers/hr`);
      queryClient.invalidateQueries({ queryKey: ['adminCenters'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Slot allocation failed');
    },
  });

  // Fetch Macro Analytics (Data & Feature Studio)
  const { data: macro = null, refetch: refetchMacro } = useQuery({
    queryKey: ['adminMacroAnalytics', selectedDate, filterState],
    queryFn: async () => {
      const res = await adminApi.getAnalytics({ date: selectedDate, state: filterState || undefined });
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Inter-Mandi Rebalance Mutation
  const rebalanceMutation = useMutation({
    mutationFn: async (payload: { source_center: string; target_center: string; token_count: number }) => {
      const res = await adminApi.rebalanceMandi(payload);
      return res.data;
    },
    onSuccess: (data: any) => {
      toast.success(data.message || 'Inter-mandi load rebalance executed!');
      refetchMacro();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Rebalance failed');
    }
  });

  const filteredFarmers = allFarmers.filter((f: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      f.token_number?.toLowerCase().includes(q) ||
      f.farmer_name?.toLowerCase().includes(q) ||
      f.mobile?.includes(q) ||
      f.crop?.toLowerCase().includes(q) ||
      f.center_name?.toLowerCase().includes(q)
    );
  });

  // Real Analytics computations binding to Backend 2/4 response contracts
  const analyticsCenters = ((macro as any)?.centers && (macro as any).centers.length > 0)
    ? (macro as any).centers
    : centerStats.map(formatZeroStateCenter);

  const bookingsVsCapacity = computeBookingsVsCapacity(analyticsCenters);
  const waitTimeTrends = computeWaitTimeTrends(analyticsCenters, (macro as any)?.hourly_throughput);
  const completionRates = computeCompletionRates(analyticsCenters);

  const handleVoiceBriefing = () => {
    const total = overview.total_farmers || 0;
    const completed = overview.completed || 0;
    const waiting = overview.waiting || 0;
    const congestedCount = centerStats.filter((c: any) => c.status === 'Congested' || Number(c.todays_farmers || 0) >= Number(c.capacity || 100) * 0.9).length;
    const briefing = `Pan-India Mandi Briefing for ${selectedDate}. Total scheduled bookings: ${total}. Completed and settled: ${completed}. In queue: ${waiting}. ${congestedCount} procurement centers require congestion rebalancing.`;
    speakText(briefing, languageInfo?.speechCode || 'hi-IN');
  };

  const filteredMspRates = mspRates.filter((r) => {
    if (mspCategoryFilter !== 'all' && r.category.toLowerCase() !== mspCategoryFilter.toLowerCase()) return false;
    if (mspSeasonFilter !== 'all' && !r.season.toLowerCase().includes(mspSeasonFilter.toLowerCase())) return false;
    if (mspSearchQuery.trim()) {
      const q = mspSearchQuery.toLowerCase();
      return r.crop.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || r.season.toLowerCase().includes(q);
    }
    return true;
  });

  const getCategoryBadgeClass = (category: string) => {
    const cat = category.toLowerCase();
    if (cat.includes('cereal') && !cat.includes('nutri')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cat.includes('pulse')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (cat.includes('oilseed')) return 'bg-amber-50 text-amber-800 border-amber-200';
    if (cat.includes('commercial')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (cat.includes('nutri')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const handleOpenEditModal = (rate: MspRateItem) => {
    setEditingMspRate(rate);
    setEditPrice(rate.price_per_quintal);
    setEditBonus(rate.bonus_per_quintal);
    setEditMarket(rate.market_average || Math.round(rate.price_per_quintal * 0.95));
    setEditSeason(rate.season);
    setEditReason('Statutory CCEA / State cabinet rate revision');
    setEditNotes(rate.notes || '');
  };

  const handleSaveMspRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMspRate) return;
    if (!editReason.trim()) {
      toast.error('Audit justification reason is mandatory for government compliance');
      return;
    }
    updateMspMutation.mutate({
      id: editingMspRate.id,
      data: {
        price_per_quintal: Number(editPrice),
        bonus_per_quintal: Number(editBonus),
        market_average: Number(editMarket),
        season: editSeason,
        reason: editReason.trim(),
        notes: editNotes.trim(),
      },
    });
  };

  const handleCreateNewCrop = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCropName.trim()) {
      toast.error('Crop name is required');
      return;
    }
    createMspMutation.mutate({
      crop: newCropName.trim(),
      category: newCropCategory,
      season: newCropSeason,
      price_per_quintal: Number(newCropPrice),
      bonus_per_quintal: Number(newCropBonus),
      market_average: Number(newCropMarket),
      notes: newCropNotes.trim(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-lg shadow-sm border border-primary-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> Nodal Officer & Admin Command Center
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Procurement Oversight, Congestion Monitoring & Smart Algorithmic Scheduling
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div>
              <label htmlFor="admin-target-date" className="block text-xs font-medium text-gray-500 mb-1">Target Date</label>
              <input
                id="admin-target-date"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              />
            </div>

            {/* Audio Briefing Button */}
            <button
              onClick={handleVoiceBriefing}
              className="mt-5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              title="Play AI audio briefing of procurement status"
            >
              <Volume2 className="w-4 h-4 text-indigo-200" />
              <span className="hidden sm:inline">Audio Briefing</span>
            </button>

            {/* In-page Language Selector */}
            <div className="mt-5 flex items-center gap-1 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
              <Globe className="w-3.5 h-3.5 text-indigo-700" />
              <select
                value={language}
                onChange={(e) => handleLangChange(e.target.value)}
                aria-label="Select Nodal Dashboard Language"
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                {SUPPORTED_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} ({l.name})
                  </option>
                ))}
              </select>
              {translating && <span className="text-[10px] text-indigo-600 animate-pulse font-medium">Translating...</span>}
            </div>

            <button
              onClick={() => refetchOverview()}
              className="mt-5 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              title="Refresh metrics"
              aria-label="Refresh metrics"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* National / State KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <div className="bg-blue-50/80 rounded-lg p-3.5 border border-blue-100">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Total Bookings</div>
            <div className="text-2xl font-black text-blue-900 mt-1">{overview.total_farmers || 0}</div>
            <div className="text-[11px] text-blue-600 mt-0.5">Scheduled for date</div>
          </div>

          <div className="bg-emerald-50/80 rounded-lg p-3.5 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Completed</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{overview.completed || 0}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Procured & Paid</div>
          </div>

          <div className="bg-amber-50/80 rounded-lg p-3.5 border border-amber-100">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">In Queue</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{overview.waiting || 0}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Waiting arrival</div>
          </div>

          <div className="bg-purple-50/80 rounded-lg p-3.5 border border-purple-100">
            <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Verification/QC</div>
            <div className="text-2xl font-black text-purple-900 mt-1">{overview.processing || 0}</div>
            <div className="text-[11px] text-purple-600 mt-0.5">At counters</div>
          </div>

          <div className="bg-rose-50/80 rounded-lg p-3.5 border border-rose-100">
            <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Rejected</div>
            <div className="text-2xl font-black text-rose-900 mt-1">{overview.rejected || 0}</div>
            <div className="text-[11px] text-rose-600 mt-0.5">Quality defects</div>
          </div>

          <div className="bg-teal-50/80 rounded-lg p-3.5 border border-teal-100">
            <div className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Active Mandis</div>
            <div className="text-2xl font-black text-teal-900 mt-1">{overview.active_centers || centers.length}</div>
            <div className="text-[11px] text-teal-600 mt-0.5">Reporting live</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('kpi')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'kpi' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Mandi Congestion Monitor
        </button>
        <button
          onClick={() => setActiveTab('prediction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'prediction' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Smart Demand Prediction
        </button>
        <button
          onClick={() => setActiveTab('slot_allocation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'slot_allocation' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Smart Slot Allocation
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'registry' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Layers className="w-4 h-4" /> Master Registry ({allFarmers.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('data_engineering');
            refetchMacro();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'data_engineering' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Cpu className="w-4 h-4 text-indigo-600" /> Data & Feature Studio
        </button>
        <button
          onClick={() => {
            setActiveTab('msp_control');
            refetchMspRates();
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 ${
            activeTab === 'msp_control' ? 'bg-white shadow text-emerald-900 border-b-2 border-emerald-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Scale className="w-4 h-4 text-emerald-600" /> Statutory MSP Floor ({mspRates.length})
        </button>
      </div>

      {/* Tab 1: Center Congestion Monitoring */}
      {activeTab === 'kpi' && (
        <div className="space-y-6">
          {/* Real-time Analytics Visualizations (Backend 2/4 response contracts) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 1. Bookings vs Capacity View */}
            <div data-testid="analytics-bookings-vs-capacity" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-blue-600" /> Bookings vs Capacity
                  </h4>
                  <p className="text-[11px] text-gray-500">Per-center slot utilization comparison</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                  {bookingsVsCapacity.length} Centers
                </span>
              </div>

              {bookingsVsCapacity.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-gray-400">
                  No booking data available for selected filters.
                </div>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bookingsVsCapacity.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="centerName" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                        formatter={((val: any, name?: any) => [val, name === 'bookings' ? 'Bookings' : 'Capacity']) as any}
                      />
                      <Bar dataKey="capacity" fill="#cbd5e1" name="Capacity" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="bookings" fill="#3b82f6" name="Bookings" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-gray-500 text-[11px]">Total Scheduled:</span>
                  <div className="font-bold text-gray-900">
                    {bookingsVsCapacity.reduce((acc, c) => acc + c.bookings, 0)}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px]">Total Capacity:</span>
                  <div className="font-bold text-gray-900">
                    {bookingsVsCapacity.reduce((acc, c) => acc + c.capacity, 0)}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Wait-Time Trend View */}
            <div data-testid="analytics-wait-time-trends" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-amber-600" /> Wait Time Trends
                  </h4>
                  <p className="text-[11px] text-gray-500">Average holding bay delay in minutes</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200">
                  Live Queue
                </span>
              </div>

              {waitTimeTrends.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-gray-400">
                  No active wait time recorded.
                </div>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waitTimeTrends.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="centerName" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} unit="m" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                        formatter={((val: any) => [`${val} mins`, 'Avg Wait']) as any}
                      />
                      <Bar dataKey="avgWaitMins" fill="#f59e0b" name="Avg Wait (mins)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-gray-500 text-[11px]">Average Delay:</span>
                  <div className="font-bold text-amber-700">
                    {waitTimeTrends.length > 0
                      ? `${Math.round(waitTimeTrends.reduce((acc, c) => acc + c.avgWaitMins, 0) / waitTimeTrends.length)} mins`
                      : '0 mins'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px]">Queue Bottleneck:</span>
                  <div className="font-bold text-gray-900 truncate">
                    {waitTimeTrends.find(w => w.status === 'Congested')?.centerName || 'None'}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Completion Rate View */}
            <div data-testid="analytics-completion-rate" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Completion Rate
                  </h4>
                  <p className="text-[11px] text-gray-500">Tokens completed & paid vs booked</p>
                </div>
                <span className="text-xs font-mono font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                  Throughput
                </span>
              </div>

              {completionRates.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs text-gray-400">
                  No completed procurement lots today.
                </div>
              ) : (
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={completionRates.slice(0, 6)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="centerName" tick={{ fontSize: 10 }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10 }} tickLine={false} unit="%" domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                        formatter={((val: any) => [`${val}%`, 'Completion Rate']) as any}
                      />
                      <Bar dataKey="completionRatePct" fill="#10b981" name="Completion Rate (%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs">
                <div>
                  <span className="text-gray-500 text-[11px]">Mean Clearance:</span>
                  <div className="font-bold text-emerald-700">
                    {completionRates.length > 0
                      ? `${Math.round(completionRates.reduce((acc, c) => acc + c.completionRatePct, 0) / completionRates.length)}%`
                      : '0%'}
                  </div>
                </div>
                <div>
                  <span className="text-gray-500 text-[11px]">Total Settled:</span>
                  <div className="font-bold text-gray-900">
                    {completionRates.reduce((acc, c) => acc + c.completed, 0)} Lots
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Mandi Congestion Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" />
                Procurement Centers Congestion & Throughput Tracker ({centerStats.length} mandis shown)
              </h3>
              <span className="text-xs text-gray-500 font-medium">Auto-refreshed with real-time arrivals</span>
            </div>

            {/* Filters Bar */}
            <div className="p-4 bg-white border-b border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label htmlFor="admin-filter-state" className="block text-[11px] font-semibold text-gray-600 mb-1">Filter by State</label>
                <select
                  id="admin-filter-state"
                  value={filterState}
                  onChange={(e) => {
                    setFilterState(e.target.value);
                    setFilterDistrict('');
                  }}
                  className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  <option value="">All States ({states.length})</option>
                  {states.map((s: string) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="admin-filter-district" className="block text-[11px] font-semibold text-gray-600 mb-1">Filter by District</label>
                <select
                  id="admin-filter-district"
                  value={filterDistrict}
                  onChange={(e) => setFilterDistrict(e.target.value)}
                  disabled={!filterState}
                  className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 focus-visible:ring-2 focus-visible:ring-primary-600 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">All Districts ({districts.length})</option>
                  {districts.map((d: string) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="admin-filter-classification" className="block text-[11px] font-semibold text-gray-600 mb-1">Mandi Classification</label>
                <select
                  id="admin-filter-classification"
                  value={filterClassification}
                  onChange={(e) => setFilterClassification(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 focus-visible:ring-2 focus-visible:ring-primary-600"
                >
                  <option value="">All Classifications ({classifications.length})</option>
                  {classifications.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="admin-mandi-search" className="block text-[11px] font-semibold text-gray-600 mb-1">Search Mandi</label>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    id="admin-mandi-search"
                    type="text"
                    placeholder="Search name or code..."
                    value={mandiSearch}
                    onChange={(e) => setMandiSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 focus-visible:ring-2 focus-visible:ring-primary-600"
                  />
                </div>
              </div>
            </div>

            {/* Empty Zero-Data State or Table View */}
            {centerStats.length === 0 ? (
              <div data-testid="empty-centers-state" className="p-12 text-center text-gray-500">
                <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="font-bold text-gray-700 text-sm">No procurement centers found</p>
                <p className="text-xs text-gray-500 mt-1">
                  Zero bookings and zero capacity recorded for the selected filter and date.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-3 text-left">Center Code & Name</th>
                      <th className="px-4 py-3 text-left">Classification</th>
                      <th className="px-4 py-3 text-left">State & District</th>
                      <th className="px-4 py-3 text-right">Daily Capacity</th>
                      <th className="px-4 py-3 text-right">Booked Today</th>
                      <th className="px-4 py-3 text-right">Utilization</th>
                      <th className="px-4 py-3 text-right">Completed</th>
                      <th className="px-4 py-3 text-right">Completion Rate</th>
                      <th className="px-4 py-3 text-right">Waiting</th>
                      <th className="px-4 py-3 text-right">Avg Wait</th>
                      <th className="px-4 py-3 text-center">Load Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {centerStats.map((c: any) => {
                      const capacity = Number(c.capacity || (c.capacity_per_hour ? c.capacity_per_hour * 4 : 0));
                      const booked = Number(c.todays_farmers || c.total_bookings || 0);
                      const completed = Number(c.completed || 0);
                      const waiting = Number(c.waiting || 0);
                      const utilizationPct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
                      const completionRatePct = booked > 0 ? Math.min(100, Math.round((completed / booked) * 100)) : 0;
                      const avgWait = Number(c.avg_wait_time_mins || (waiting > 0 ? Math.round(waiting * 4.5) : 0));

                      return (
                        <tr key={c.id} className="hover:bg-primary-50/40 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-gray-900">{c.name}</div>
                            <div className="text-xs text-gray-500 font-mono">{c.code}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">
                              {c.classification || 'APMC (Regulated)'}
                            </span>
                            {c.market_id && (
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">Mkt ID: {c.market_id}</div>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-gray-900 font-medium">{c.district}</div>
                            <div className="text-xs text-gray-500">{c.state}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-gray-700">
                            {capacity}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-blue-700">
                            {booked}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                utilizationPct >= 85
                                  ? 'bg-rose-100 text-rose-800'
                                  : utilizationPct >= 50
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {utilizationPct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-700">
                            {completed}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">
                              {completionRatePct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-amber-700">
                            {waiting}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right font-mono text-xs text-gray-600">
                            {avgWait}m
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <span
                              className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                                c.status === 'Congested' || utilizationPct >= 90
                                  ? 'bg-rose-100 text-rose-800'
                                  : utilizationPct >= 60
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {c.status || (utilizationPct >= 90 ? 'Congested' : utilizationPct >= 60 ? 'Moderate' : 'Normal')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Smart Demand Prediction */}
      {activeTab === 'prediction' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary-600" />
              Forecast Parameters
            </h3>
            <p className="text-xs text-gray-500">
              Calculates tomorrow's expected farmer load using a 14-day moving average of same-weekday historical Mandi arrivals.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Procurement Center</label>
              <select
                value={predictionCenterId}
                onChange={(e) => setPredictionCenterId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {centers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name}
                  </option>
                ))}
              </select>
            </div>

            {predictionData && (
              <div className="p-4 bg-slate-50 rounded-lg border border-primary-200 mt-4">
                <div className="text-xs font-bold text-primary-800 uppercase tracking-wide">
                  Predicted Tomorrow's Demand
                </div>
                <div className="text-4xl font-black text-primary-900 mt-2">
                  {predictionData.predicted_tomorrow} <span className="text-sm font-semibold text-primary-600">farmers</span>
                </div>
                <div className="text-xs text-gray-600 mt-2 italic">
                  Algorithm: {predictionData.method}
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary-600" />
              14-Day Historical Mandi Arrivals
            </h3>

            {predictionLoading ? (
              <div className="text-center py-12 text-gray-500">Loading historical data...</div>
            ) : predictionData?.history ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {predictionData.history.map((h: any) => (
                    <div key={h.date} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-[11px] font-medium text-gray-500">{h.date}</div>
                      <div className="text-lg font-bold text-gray-900 mt-0.5">{h.farmer_count} farmers</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">No historical records available for this center.</div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Smart Slot Allocation */}
      {activeTab === 'slot_allocation' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 text-emerald-700 rounded-lg">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Capacity-Aware Smart Slot Generator</h2>
              <p className="text-xs text-gray-500">
                Balances expected demand across operating hours constrained by maximum hourly throughput.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              generateSlotsMutation.mutate();
            }}
            className="space-y-4 pt-2"
          >
            {/* State -> District -> Center Cascading Selectors */}
            <div className="space-y-3 p-4 bg-slate-50/80 rounded-lg border border-slate-200">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Filter & Select Mandi Terminal
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* State Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    1. Select State / UT
                  </label>
                  <select
                    value={genState}
                    onChange={(e) => {
                      setGenState(e.target.value);
                      setGenDistrict('');
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">-- Choose State --</option>
                    {states.map((s: string) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* District Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    2. Select District
                  </label>
                  <select
                    value={genDistrict}
                    onChange={(e) => setGenDistrict(e.target.value)}
                    disabled={!genState || slotGenDistrictsLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:bg-gray-100"
                  >
                    <option value="">
                      {slotGenDistrictsLoading ? 'Loading districts...' : 'All Districts (Statewide)'}
                    </option>
                    {slotGenDistricts.map((d: string) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Center Dropdown */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  3. Procurement Centre
                  {slotGenCenters.length > 0 && (
                    <span className="text-gray-400 font-normal ml-1">
                      ({slotGenCenters.length} centres available)
                    </span>
                  )}
                </label>
                <select
                  value={genCenterId}
                  onChange={(e) => setGenCenterId(e.target.value)}
                  disabled={slotGenCentersLoading || slotGenCenters.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:bg-gray-100 font-medium text-slate-900"
                  required
                >
                  {slotGenCentersLoading ? (
                    <option value="">Loading procurement centres...</option>
                  ) : slotGenCenters.length === 0 ? (
                    <option value="">No procurement centres found for selected location</option>
                  ) : (
                    slotGenCenters.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} {c.district ? `(${c.district})` : ''} [Max: {c.capacity_per_hour || 50}/hr]
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Date to Allocate</label>
                <input
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Expected Demand (Farmers)</label>
                <input
                  type="number"
                  value={genDemand}
                  onChange={(e) => setGenDemand(parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-primary-800"
                />
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-600 space-y-1">
              <div>• 4 Standard Operating Windows: 09:00-10:00, 10:00-11:00, 11:00-12:00, 12:00-13:00</div>
              <div>• Computed Allocation: {Math.round(genDemand / 4)} slots/hour (capped by center hourly limit)</div>
            </div>

            <button
              type="submit"
              disabled={generateSlotsMutation.isPending || !genCenterId}
              className="w-full py-3 bg-gov-navy text-white font-bold rounded-lg shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {generateSlotsMutation.isPending ? 'Allocating Slots...' : 'Generate & Deploy Center Slots'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Master Farmer & Token Registry */}
      {activeTab === 'registry' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search by token, farmer, crop, or center..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white"
              />
            </div>
            <span className="text-xs text-gray-500 font-medium">Total: {filteredFarmers.length} records</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Token #</th>
                  <th className="px-4 py-3 text-left">Farmer</th>
                  <th className="px-4 py-3 text-left">Mandi Center</th>
                  <th className="px-4 py-3 text-left">Crop & Qty</th>
                  <th className="px-4 py-3 text-left">Date & Slot</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredFarmers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {farmersLoading ? 'Loading records...' : 'No records found.'}
                    </td>
                  </tr>
                ) : (
                  filteredFarmers.map((f: any) => (
                    <tr key={f.token_id} className="hover:bg-primary-50/40">
                      <td className="px-4 py-3 font-mono font-bold text-primary-900">{f.token_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{f.farmer_name}</div>
                        <div className="text-xs text-gray-500">{f.mobile}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-800 font-medium">{f.center_name}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {f.crop} ({f.quantity} Qtl)
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">
                        {f.date} {f.start_time}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800 rounded">
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 text-xs font-semibold rounded ${
                            f.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {f.payment_status === 'paid' ? `₹${f.payment_amount || 'Paid'}` : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Data & Feature Studio */}
      {activeTab === 'data_engineering' && (
        <div className="space-y-6">
          {/* Top Macro Telemetry Stream Banner */}
          <div className="bg-gov-navy rounded-lg p-6 text-white shadow-sm border border-indigo-700/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/70 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    National Telemetry Engine • Multi-Mandi Stream
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  {filterState ? `${filterState} State Command Hub` : 'Pan-India Procurement & Feature Engineering Studio'}
                </h2>
                <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
                  Real-time pipeline ingestion telemetry across 4,129 APMC mandis, district congestion index (CPI), ML feature weights, and automated load rebalancing.
                </p>
              </div>

              {/* Real-time Tonnage & DBT Disbursal Metric */}
              <div className="bg-slate-900/90 backdrop-blur-md rounded-lg p-4 border border-indigo-500/30 min-w-[280px]">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-emerald-400" /> Real-Time DBT Stream</span>
                  <span className="font-mono bg-indigo-950 px-2 py-0.5 rounded text-[11px] text-indigo-300 border border-indigo-700/50">PFMS Net</span>
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  ₹{macro?.total_dbt_disbursed_cr != null ? macro.total_dbt_disbursed_cr : '0.00'} <span className="text-xs font-normal text-indigo-300">Cr Disbursed</span>
                </div>
                <div className="text-[11px] text-indigo-300/80 mt-1 flex justify-between">
                  <span>Tonnage: <strong>{macro?.total_tonnage_mt != null ? `${macro.total_tonnage_mt} MT` : '0 MT'}</strong></span>
                  <span>Turnaround: <strong>{macro?.avg_turnaround_mins != null ? `${macro.avg_turnaround_mins} mins` : '0 mins'}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-800/40">
              <div className="bg-indigo-950/40 rounded-lg p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Reporting Mandis</div>
                <div className="text-xl font-bold text-white mt-1">{macro?.total_mandis ?? centers.length ?? 0} <span className="text-xs font-normal text-indigo-300">APMC Yards</span></div>
                <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> 100% Operational Grid
                </div>
              </div>
              <div className="bg-indigo-950/40 rounded-lg p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Daily Scheduled Farmers</div>
                <div className="text-xl font-bold text-white mt-1">{(macro?.total_farmers_today ?? overview.total_farmers ?? 0).toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">e-Tokens Verified</div>
              </div>
              <div className="bg-indigo-950/40 rounded-lg p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Procured & Settled</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{(macro?.total_completed ?? overview.completed ?? 0).toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">PFMS Instant Settlements</div>
              </div>
              <div className="bg-indigo-950/40 rounded-lg p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Active In Queue</div>
                <div className="text-xl font-bold text-amber-400 mt-1">{(macro?.total_waiting ?? overview.waiting ?? 0).toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">Holding bay & verification</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Ingestion Throughput & DBT Cashflow Stream */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Macro Procurement Tonnage vs DBT Cashflow Velocity
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Real-time quintals/MT cleared vs instantaneous PFMS payments (₹ Crores)
                  </p>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">
                  Telemetry Stream
                </span>
              </div>

              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={macro?.hourly_throughput || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="slot" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#10b981' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      formatter={(val: any, name: any) => [
                        name === 'dbt_inr_cr' ? `₹${val} Cr` : `${val} MT`,
                        name === 'tonnage_mt' ? 'Procured Tonnage' : name === 'target_rate_mt' ? 'Target Rate' : 'DBT Disbursal'
                      ]}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Bar yAxisId="left" dataKey="tonnage_mt" name="Procured Tonnage (MT)" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    <Line yAxisId="left" type="monotone" dataKey="target_rate_mt" name="Target Rate (MT)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
                    <Line yAxisId="right" type="monotone" dataKey="dbt_inr_cr" name="DBT Disbursed (₹ Cr)" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Mean Clearance: {macro?.mean_clearance_pct ? `${macro.mean_clearance_pct}%` : (macro?.hourly_throughput?.length ? `${Math.round((macro.hourly_throughput.reduce((acc: number, cur: any) => acc + (cur.target_rate_mt ? (cur.tonnage_mt / cur.target_rate_mt) * 100 : 90), 0) / macro.hourly_throughput.length))}%` : '—')}
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  {macro?.peak_slot ? `Peak Hour: ${macro.peak_slot} (${macro.peak_tonnage || 0} MT)` : (macro?.hourly_throughput?.length ? `Active Hours: ${macro.hourly_throughput.length} slots` : 'Live Telemetry')}
                </span>
              </div>
            </div>

            {/* Chart 2: District Congestion Pressure Index (CPI) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Scale className="w-4 h-4 text-amber-600" />
                    District Congestion Pressure Index (CPI)
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    District load factor (Demand / Capacity * 100) vs Critical Threshold (100%)
                  </p>
                </div>
                <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-100">
                  CPI Formula: (D/C)*100
                </span>
              </div>

              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={macro?.district_cpi || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="district" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      formatter={(val: any, _name: any, item: any) => [
                        `${val}% (Status: ${item.payload.status}, Avg Wait: ${item.payload.wait_hrs} hrs)`,
                        'Congestion Pressure Index'
                      ]}
                    />
                    <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical (100%)', fill: '#ef4444', fontSize: 10 }} />
                    <Bar dataKey="cpi" name="CPI Score" radius={[6, 6, 0, 0]}>
                      {(macro?.district_cpi || []).map((entry: any, index: number) => (
                        <Cell
                          key={`cpi-${index}`}
                          fill={entry.cpi >= 100 ? '#ef4444' : entry.cpi >= 80 ? '#f59e0b' : '#10b981'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-rose-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Critical (&gt;100%)
                  </span>
                  <span className="flex items-center gap-1 text-amber-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Elevated (80-100%)
                  </span>
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Balanced (&lt;80%)
                  </span>
                </div>
                <span className="text-gray-500 font-mono text-[11px]">8 Key Procurement Hubs</span>
              </div>
            </div>
          </div>

          {/* Section 3: Commodity Procurement Tonnage & MSP Disbursal Tracking */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-600" />
                  Crop Procurement Quotas & MSP Floor Value Disbursals
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Statutory MSP guaranteed payments and seasonal target progress across key notified crops
                </p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-100">
                100% MSP Assured
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
              {(macro?.crop_breakdown || []).map((c: any, idx: number) => (
                <div key={idx} className="bg-slate-50 hover:bg-emerald-50/40 rounded-lg p-4 border border-gray-200 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 text-sm">{c.crop}</span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100/70 px-2 py-0.5 rounded">
                        {c.target_pct}%
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mt-1">
                      MSP: <strong className="text-gray-800">₹{c.msp_per_qtl}</strong> / Qtl
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(100, c.target_pct)}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">Procured</span>
                      <span className="font-bold text-gray-800">{c.procured_mt.toLocaleString()} MT</span>
                    </div>
                    <div className="text-right">
                      <span className="text-gray-400 block text-[10px] uppercase font-semibold">DBT Disbursed</span>
                      <span className="font-bold text-emerald-700">₹{c.dbt_disbursed_cr} Cr</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 4: Predictive Machine Learning Feature Importance Studio */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Predictive Arrival Engine • Machine Learning Feature Importance Matrix
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Gradient-boosted decision tree (XGBoost) feature weights determining daily farmer arrival probabilities and congestion forecasts
                </p>
              </div>
              <span className="text-xs bg-amber-50 text-amber-700 font-mono font-bold px-2.5 py-1 rounded border border-amber-200">
                Model: XGBoost-v2.4
              </span>
            </div>

            <div className="space-y-4 mt-6">
              {(macro?.ml_feature_weights || []).map((feat: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-gray-200 hover:border-indigo-300 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                        {feat.code}
                      </span>
                      <h4 className="font-bold text-gray-900 text-sm">{feat.feature}</h4>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {feat.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-bold ${feat.impact.startsWith('Positive') ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {feat.impact}
                      </span>
                      <span className="font-mono font-black text-gray-900 text-sm">
                        {(feat.weight * 100).toFixed(0)}% Weight
                      </span>
                    </div>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden my-2">
                    <div
                      className="bg-gov-navy h-2.5 rounded-full"
                      style={{ width: `${feat.weight * 100 * 2.5}%` }}
                    />
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed mt-1">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Section 5: Dynamic Inter-Mandi Load Rebalancer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-indigo-600" />
                  Intelligent Inter-Mandi Dynamic Load Rebalancer
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Algorithmic load-shedding recommendations to divert incoming farm trolleys from congested yards to nearby underutilized facilities
                </p>
              </div>
              <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded border border-indigo-200">
                Auto-Routing Engine
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {(macro?.rebalancing_recommendations || []).map((rec: any, idx: number) => (
                <div key={idx} className="bg-slate-50 rounded-lg p-4 border border-gray-200 hover:border-indigo-400 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-mono text-xs font-bold text-gray-500">{rec.id}</span>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        {rec.recommended_token_shift} Slots Shift
                      </span>
                    </div>

                    {/* Source Congested Yard */}
                    <div className="bg-rose-50 border border-rose-100 rounded-lg p-2.5 mb-2">
                      <div className="text-[10px] uppercase font-bold text-rose-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Congested Source Mandi
                      </div>
                      <div className="text-xs font-bold text-rose-950 mt-0.5 truncate">{rec.source_center}</div>
                      <div className="text-[11px] text-rose-700 font-semibold mt-0.5">Load: {rec.source_load_pct}% Capacity</div>
                    </div>

                    {/* Arrow Divider */}
                    <div className="flex items-center justify-center my-1 text-gray-400">
                      <ArrowRight className="w-4 h-4" />
                      <span className="text-[10px] font-mono text-gray-500 ml-1">{rec.distance_km} km distance</span>
                    </div>

                    {/* Target Sub-Yard */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-2.5">
                      <div className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Underutilized Target Mandi
                      </div>
                      <div className="text-xs font-bold text-emerald-950 mt-0.5 truncate">{rec.target_center}</div>
                      <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">Load: {rec.target_load_pct}% Capacity</div>
                    </div>

                    <div className="text-xs text-gray-600 mt-3 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Est. queue relief: <strong>-{rec.est_wait_reduction_mins} mins</strong></span>
                    </div>
                  </div>

                  <button
                    onClick={() =>
                      rebalanceMutation.mutate({
                        source_center: rec.source_center,
                        target_center: rec.target_center,
                        token_count: rec.recommended_token_shift,
                      })
                    }
                    disabled={rebalanceMutation.isPending}
                    className="w-full mt-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow transition-all flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>EXECUTE LOAD REBALANCE</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Statutory MSP Floor & Rate Control (Nodal Officer) */}
      {activeTab === 'msp_control' && (
        <div className="space-y-6">
          {/* Top Hero Card */}
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-xl p-6 shadow-md border border-emerald-800">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Statutory Price Support Mechanism
                  </span>
                  <span className="text-xs text-emerald-200/80 bg-black/20 px-2.5 py-1 rounded-full">
                    CACP & CCEA Gazette Regulated
                  </span>
                </div>
                <h2 className="text-2xl font-black text-white mt-2 flex items-center gap-2">
                  Statutory Minimum Support Price (MSP) Floor Suite
                </h2>
                <p className="text-xs text-emerald-100/80 mt-1 max-w-2xl leading-relaxed">
                  Authoritative agricultural floor prices guaranteed to farmers under Government of India CACP/CCEA notifications and State Cabinet procurement bonus overlays. Adjustments inscribe an immutable audit record and immediately propagate across DBT payment calculations, Mandi weighing, and IVR/USSD hotlines.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => syncMspMutation.mutate()}
                  disabled={syncMspMutation.isPending}
                  className="px-4 py-2.5 bg-emerald-700/80 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2 border border-emerald-500/40"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncMspMutation.isPending ? 'animate-spin' : ''}`} />
                  <span>Sync CCEA / CACP Benchmarks</span>
                </button>

                <button
                  onClick={() => setIsAddMspModalOpen(true)}
                  className="px-4 py-2.5 bg-white text-emerald-950 hover:bg-emerald-50 text-xs font-bold rounded-lg shadow-sm transition-all flex items-center gap-2"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Inscribe New Crop</span>
                </button>

                <button
                  onClick={() => setShowAuditDrawer(!showAuditDrawer)}
                  className="px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-emerald-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Audit Trail ({mspAuditLogs.length})</span>
                </button>
              </div>
            </div>

            {/* Macro Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-emerald-800/60">
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[11px] font-semibold text-emerald-300 uppercase">Notified Commodities</div>
                <div className="text-2xl font-black text-white mt-0.5">{mspRates.length} Crops</div>
                <div className="text-[10px] text-emerald-200/70 mt-0.5">{mspRates.filter(r => r.is_active).length} Active for Procurement</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[11px] font-semibold text-emerald-300 uppercase">Highest Guaranteed Floor</div>
                <div className="text-2xl font-black text-emerald-300 mt-0.5">
                  ₹{[...mspRates].sort((a,b) => b.effective_price - a.effective_price)[0]?.effective_price?.toLocaleString() || 8558}
                </div>
                <div className="text-[10px] text-emerald-200/70 mt-0.5">
                  {[...mspRates].sort((a,b) => b.effective_price - a.effective_price)[0]?.crop || 'Moong'} / Quintal
                </div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[11px] font-semibold text-emerald-300 uppercase">Average Floor Base</div>
                <div className="text-2xl font-black text-white mt-0.5">
                  ₹{Math.round(mspRates.reduce((a, b) => a + b.price_per_quintal, 0) / (mspRates.length || 1)).toLocaleString()}
                </div>
                <div className="text-[10px] text-emerald-200/70 mt-0.5">National Weighted Benchmark</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                <div className="text-[11px] font-semibold text-emerald-300 uppercase">State Incentive Overlays</div>
                <div className="text-2xl font-black text-amber-300 mt-0.5">
                  {mspRates.filter(r => r.bonus_per_quintal > 0).length} Crops Active
                </div>
                <div className="text-[10px] text-emerald-200/70 mt-0.5">State Bonus Above Central MSP</div>
              </div>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search crop name, category, or season..."
                  value={mspSearchQuery}
                  onChange={(e) => setMspSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg flex-wrap">
                  {['all', ...Array.from(new Set(mspRates.map((r) => r.category))).filter(Boolean)].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setMspCategoryFilter(cat)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                        mspCategoryFilter === cat
                          ? 'bg-white text-emerald-900 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {cat === 'all' ? 'All Categories' : cat}
                    </button>
                  ))}
                </div>

                <select
                  value={mspSeasonFilter}
                  onChange={(e) => setMspSeasonFilter(e.target.value)}
                  className="text-xs py-1.5 px-3 rounded-lg border border-gray-300 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="all">All Seasons</option>
                  <option value="Rabi">Rabi Season</option>
                  <option value="Kharif">Kharif Season</option>
                </select>
              </div>
            </div>
          </div>

          {/* Commodity Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredMspRates.map((rate) => {
              const marketSpot = rate.market_average || 0;
              const arbitrage = rate.effective_price - marketSpot;
              const hasBonus = rate.bonus_per_quintal > 0;

              return (
                <div
                  key={rate.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 hover:border-emerald-300 hover:shadow transition-all p-5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-base font-black text-gray-900 leading-tight">{rate.crop}</h3>
                        <div className="text-[11px] text-gray-500 mt-0.5">{rate.season}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getCategoryBadgeClass(rate.category)}`}>
                        {rate.category}
                      </span>
                    </div>

                    <div className="mt-4 bg-slate-50 rounded-lg p-3 border border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-gray-500">Effective Floor:</span>
                        <div className="text-right">
                          <span className="text-xl font-black text-emerald-700">₹{rate.effective_price.toLocaleString()}</span>
                          <span className="text-xs text-gray-500 font-normal"> / Qtl</span>
                        </div>
                      </div>

                      <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">Base Statutory MSP:</span>
                        <span className="font-semibold text-gray-800">₹{rate.price_per_quintal.toLocaleString()}</span>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-gray-500">State Incentive Bonus:</span>
                        <span className={`font-semibold ${hasBonus ? 'text-amber-700' : 'text-gray-400'}`}>
                          {hasBonus ? `+ ₹${rate.bonus_per_quintal.toLocaleString()}` : '₹0'}
                        </span>
                      </div>
                    </div>

                    {marketSpot > 0 && (
                      <div className="mt-3 flex items-center justify-between text-xs px-1">
                        <span className="text-gray-500 text-[11px]">APMC Spot Avg:</span>
                        <div className="text-right">
                          <span className="font-semibold text-gray-700">₹{marketSpot.toLocaleString()}</span>
                          {arbitrage > 0 && (
                            <span className="ml-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              +₹{arbitrage} MSP Shield
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="mt-3 text-[10px] text-gray-400 truncate">
                      Source: {rate.source}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-[10px] text-gray-400">
                      Updated: {rate.updated_at.slice(0, 10)}
                    </span>
                    <button
                      onClick={() => handleOpenEditModal(rate)}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg border border-emerald-200 transition-all flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Adjust Rate / Bonus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Master Table View */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-gray-900">National Statutory MSP Commodity Ledger</h3>
                <p className="text-xs text-gray-500 mt-0.5">Authoritative procurement floor benchmarks with real-time DBT linkage</p>
              </div>
              <span className="text-xs font-semibold text-gray-500">Showing {filteredMspRates.length} Commodities</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-3 text-left">Commodity</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Season</th>
                    <th className="px-4 py-3 text-right">Base Floor (₹/Qtl)</th>
                    <th className="px-4 py-3 text-right">State Bonus (₹/Qtl)</th>
                    <th className="px-4 py-3 text-right">Guaranteed Total (₹/Qtl)</th>
                    <th className="px-4 py-3 text-right">APMC Spot Avg</th>
                    <th className="px-4 py-3 text-center">MSP Protection</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredMspRates.map((r) => {
                    const spot = r.market_average || 0;
                    const diff = r.effective_price - spot;
                    return (
                      <tr key={r.id} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-gray-900">
                          {r.crop}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeClass(r.category)}`}>
                            {r.category}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-600">{r.season}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-800">
                          ₹{r.price_per_quintal.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          {r.bonus_per_quintal > 0 ? (
                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              + ₹{r.bonus_per_quintal.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-black text-emerald-700 text-sm">
                          ₹{r.effective_price.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600">
                          {spot > 0 ? `₹${spot.toLocaleString()}` : '—'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {spot > 0 && diff > 0 ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                              +₹{diff} ({(diff / spot * 100).toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-400">At Par</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            r.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {r.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => handleOpenEditModal(r)}
                            className="text-xs text-emerald-700 hover:text-emerald-900 font-bold hover:underline"
                          >
                            Adjust Rate
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Edit MSP Floor & State Bonus Modal */}
      {editingMspRate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                  Nodal Officer Floor Adjustment
                </span>
                <h3 className="text-lg font-black mt-1">Adjust MSP for {editingMspRate.crop}</h3>
              </div>
              <button
                onClick={() => setEditingMspRate(null)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMspRate} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Base Statutory MSP (₹ / Qtl) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="100"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-gray-900"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Previous: ₹{editingMspRate.price_per_quintal}
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    State Incentive Bonus (₹ / Qtl)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={editBonus}
                    onChange={(e) => setEditBonus(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-amber-900"
                  />
                  <span className="text-[10px] text-gray-500 mt-0.5 block">
                    Previous: ₹{editingMspRate.bonus_per_quintal}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    APMC Spot Market Average (₹ / Qtl)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editMarket}
                    onChange={(e) => setEditMarket(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Crop Marketing Season
                  </label>
                  <input
                    type="text"
                    value={editSeason}
                    onChange={(e) => setEditSeason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Dynamic Calculation Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-900 text-xs">New Guaranteed Floor Price:</span>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-800">
                      ₹{(Number(editPrice) + Number(editBonus)).toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-700"> / Quintal</span>
                  </div>
                </div>
                <p className="text-[11px] text-emerald-700 mt-1">
                  Upon confirmation, all subsequent farmer token procurement calculations, DBT disbursements, and USSD/IVR responses will immediately apply this rate.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Mandatory Audit Justification Reason *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., CCEA Gazette notification S.O. 4521(E) revision"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                  {[
                    'CCEA Cabinet Gazette revision',
                    'State Cabinet Bonus Announcement',
                    'Drought Relief Seasonal Incentive',
                    'Annual MSP Floor Upward Revision',
                  ].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setEditReason(quick)}
                      className="text-[10px] bg-gray-100 hover:bg-emerald-100 hover:text-emerald-800 px-2 py-0.5 rounded transition-colors text-gray-600"
                    >
                      + {quick}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Gazette Circular / Administrative Reference Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Circular reference, department order number..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMspRate(null)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMspMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow transition-all flex items-center gap-1.5"
                >
                  {updateMspMutation.isPending ? 'Inscribing...' : 'Save & Inscribe Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Inscribe New Crop Modal */}
      {isAddMspModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-800 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-200 bg-emerald-950/40 px-2.5 py-0.5 rounded-full">
                  Statutory Commodity Inscription
                </span>
                <h3 className="text-lg font-black mt-1">Inscribe New Notified Crop Floor</h3>
              </div>
              <button
                onClick={() => setIsAddMspModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewCrop} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-gray-700">
                      Commodity / Crop Name *
                    </label>
                    <span className="text-[10px] text-gray-500">
                      605+ Agmarknet Master
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    list="admin-commodity-options"
                    placeholder="e.g. Wheat, Mustard, Paddy (Common)..."
                    value={newCropName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewCropName(val);
                      const detected = getCommodityGroup(val);
                      if (detected && detected !== 'Others') {
                        setNewCropCategory(detected);
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold"
                  />
                  <datalist id="admin-commodity-options">
                    {ALL_COMMODITIES.map((c) => (
                      <option key={c.id} value={c.cmdt_name}>
                        {c.group_name}
                      </option>
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Commodity Category / Group *
                  </label>
                  <select
                    value={newCropCategory}
                    onChange={(e) => setNewCropCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white font-medium"
                  >
                    {COMMODITY_GROUPS.map((g) => (
                      <option key={g.name} value={g.name}>
                        {g.icon} {g.name} ({g.count})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Base MSP Rate (₹ / Qtl) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    min="100"
                    value={newCropPrice}
                    onChange={(e) => setNewCropPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    State Incentive Bonus (₹ / Qtl)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newCropBonus}
                    onChange={(e) => setNewCropBonus(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-amber-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Marketing Season *
                  </label>
                  <input
                    type="text"
                    required
                    value={newCropSeason}
                    onChange={(e) => setNewCropSeason(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    APMC Spot Market Average (₹ / Qtl)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newCropMarket}
                    onChange={(e) => setNewCropMarket(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Gazette Circular / Reference Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="CCEA notification details, MSP floor circular..."
                  value={newCropNotes}
                  onChange={(e) => setNewCropNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddMspModalOpen(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMspMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-lg shadow transition-all"
                >
                  {createMspMutation.isPending ? 'Inscribing...' : 'Inscribe Commodity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Audit Trail Log Drawer */}
      {showAuditDrawer && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-full">
                  Government Compliance & Transparency
                </span>
                <h3 className="text-lg font-black mt-1 flex items-center gap-2">
                  <History className="w-5 h-5 text-emerald-400" /> Statutory MSP Modification Audit Ledger
                </h3>
              </div>
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-gray-200 text-xs text-gray-600">
              Immutable ledger of every MSP floor change, state bonus revision, and automated CCEA gazette benchmark synchronization.
            </div>

            <div className="overflow-y-auto flex-1 p-4">
              {mspAuditLogs.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <History className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="font-semibold text-gray-600">No modifications logged yet</p>
                  <p className="text-xs text-gray-400 mt-1">Rates are currently set to original statutory baseline benchmarks.</p>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-xs">
                  <thead className="bg-gray-100 text-gray-600 font-semibold uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Timestamp</th>
                      <th className="px-3 py-2 text-left">Commodity</th>
                      <th className="px-3 py-2 text-right">Price Revision</th>
                      <th className="px-3 py-2 text-right">Bonus Revision</th>
                      <th className="px-3 py-2 text-left">Audit Justification</th>
                      <th className="px-3 py-2 text-left">Officer ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {mspAuditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-500 font-mono text-[11px]">
                          {log.changed_at.slice(0, 19).replace('T', ' ')}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap font-bold text-gray-900">
                          {log.crop}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right">
                          <span className="text-gray-400 line-through mr-1">₹{log.previous_price}</span>
                          <span className="font-black text-emerald-700">₹{log.new_price}</span>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-right">
                          <span className="text-gray-400 line-through mr-1">₹{log.previous_bonus}</span>
                          <span className="font-black text-amber-700">₹{log.new_bonus}</span>
                        </td>
                        <td className="px-3 py-2.5 text-gray-700 max-w-xs truncate" title={log.reason}>
                          {log.reason}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-gray-400 font-mono text-[10px]">
                          {log.updated_by.slice(0, 14)}...
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowAuditDrawer(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-semibold"
              >
                Close Audit Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
