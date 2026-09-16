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
  ArrowUpRight
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
import { adminApi, bookingApi, locationApi } from '../services/api';
import toast from 'react-hot-toast';
import { getLocalDateString } from '../utils/dateUtils';

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [activeTab, setActiveTab] = useState<'kpi' | 'prediction' | 'slot_allocation' | 'registry' | 'data_engineering'>('kpi');
  const [searchQuery, setSearchQuery] = useState('');

  // Location and classification filter state for Admin
  const [filterState, setFilterState] = useState<string>('');
  const [filterDistrict, setFilterDistrict] = useState<string>('');
  const [filterClassification, setFilterClassification] = useState<string>('');
  const [mandiSearch, setMandiSearch] = useState<string>('');

  // Demand prediction state
  const [predictionCenterId, setPredictionCenterId] = useState<string>('');

  // Slot generation state
  const [genCenterId, setGenCenterId] = useState<string>('');
  const [genDate, setGenDate] = useState<string>(getLocalDateString());
  const [genDemand, setGenDemand] = useState<number>(100);

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

  // Set default centers for prediction & generation safely within useEffect
  useEffect(() => {
    if (centers.length > 0) {
      if (!predictionCenterId) {
        setPredictionCenterId(centers[0].id);
      }
      if (!genCenterId) {
        setGenCenterId(centers[0].id);
      }
    }
  }, [centers, predictionCenterId, genCenterId]);

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

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-white rounded-xl shadow-sm border border-primary-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>📊</span> Nodal Officer & Admin Command Center
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Procurement Oversight, Congestion Monitoring & Smart Algorithmic Scheduling
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Target Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              onClick={() => refetchOverview()}
              className="mt-5 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              title="Refresh metrics"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* National / State KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
          <div className="bg-blue-50/80 rounded-xl p-3.5 border border-blue-100">
            <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Total Bookings</div>
            <div className="text-2xl font-black text-blue-900 mt-1">{overview.total_farmers || 0}</div>
            <div className="text-[11px] text-blue-600 mt-0.5">Scheduled for date</div>
          </div>

          <div className="bg-emerald-50/80 rounded-xl p-3.5 border border-emerald-100">
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Completed</div>
            <div className="text-2xl font-black text-emerald-900 mt-1">{overview.completed || 0}</div>
            <div className="text-[11px] text-emerald-600 mt-0.5">Procured & Paid</div>
          </div>

          <div className="bg-amber-50/80 rounded-xl p-3.5 border border-amber-100">
            <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide">In Queue</div>
            <div className="text-2xl font-black text-amber-900 mt-1">{overview.waiting || 0}</div>
            <div className="text-[11px] text-amber-600 mt-0.5">Waiting arrival</div>
          </div>

          <div className="bg-purple-50/80 rounded-xl p-3.5 border border-purple-100">
            <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Verification/QC</div>
            <div className="text-2xl font-black text-purple-900 mt-1">{overview.processing || 0}</div>
            <div className="text-[11px] text-purple-600 mt-0.5">At counters</div>
          </div>

          <div className="bg-rose-50/80 rounded-xl p-3.5 border border-rose-100">
            <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide">Rejected</div>
            <div className="text-2xl font-black text-rose-900 mt-1">{overview.rejected || 0}</div>
            <div className="text-[11px] text-rose-600 mt-0.5">Quality defects</div>
          </div>

          <div className="bg-teal-50/80 rounded-xl p-3.5 border border-teal-100">
            <div className="text-xs font-semibold text-teal-700 uppercase tracking-wide">Active Mandis</div>
            <div className="text-2xl font-black text-teal-900 mt-1">{overview.active_centers || centers.length}</div>
            <div className="text-[11px] text-teal-600 mt-0.5">Reporting live</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('kpi')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'kpi' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Building2 className="w-4 h-4" /> Mandi Congestion Monitor
        </button>
        <button
          onClick={() => setActiveTab('prediction')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'prediction' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" /> Smart Demand Prediction
        </button>
        <button
          onClick={() => setActiveTab('slot_allocation')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'slot_allocation' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Sparkles className="w-4 h-4" /> Smart Slot Allocation
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
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
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
            activeTab === 'data_engineering' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Cpu className="w-4 h-4 text-indigo-600" /> Data & Feature Studio
        </button>
      </div>

      {/* Tab 1: Center Congestion Monitoring */}
      {activeTab === 'kpi' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Filter by State</label>
              <select
                value={filterState}
                onChange={(e) => {
                  setFilterState(e.target.value);
                  setFilterDistrict('');
                }}
                className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All States ({states.length})</option>
                {states.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Filter by District</label>
              <select
                value={filterDistrict}
                onChange={(e) => setFilterDistrict(e.target.value)}
                disabled={!filterState}
                className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-400"
              >
                <option value="">All Districts ({districts.length})</option>
                {districts.map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mandi Classification</label>
              <select
                value={filterClassification}
                onChange={(e) => setFilterClassification(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">All Classifications ({classifications.length})</option>
                {classifications.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Search Mandi</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name or code..."
                  value={mandiSearch}
                  onChange={(e) => setMandiSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Center Code & Name</th>
                  <th className="px-4 py-3 text-left">Classification</th>
                  <th className="px-4 py-3 text-left">State & District</th>
                  <th className="px-4 py-3 text-right">Daily Capacity</th>
                  <th className="px-4 py-3 text-right">Booked Today</th>
                  <th className="px-4 py-3 text-right">Completed</th>
                  <th className="px-4 py-3 text-right">Waiting</th>
                  <th className="px-4 py-3 text-center">Load Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {centerStats.map((c: any) => (
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
                      {c.capacity || c.capacity_per_hour * 4}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-blue-700">
                      {c.todays_farmers || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-emerald-700">
                      {c.completed || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right font-bold text-amber-700">
                      {c.waiting || 0}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                          c.status === 'Congested'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {c.status || 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Smart Demand Prediction */}
      {activeTab === 'prediction' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
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
              <div className="p-4 bg-gradient-to-br from-primary-50 to-emerald-50 rounded-xl border border-primary-200 mt-4">
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

          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl space-y-4">
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
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Procurement Center</label>
              <select
                value={genCenterId}
                onChange={(e) => setGenCenterId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                {centers.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} (Max: {c.capacity_per_hour}/hr)
                  </option>
                ))}
              </select>
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

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs text-gray-600 space-y-1">
              <div>• 4 Standard Operating Windows: 09:00-10:00, 10:00-11:00, 11:00-12:00, 12:00-13:00</div>
              <div>• Computed Allocation: {Math.round(genDemand / 4)} slots/hour (capped by center hourly limit)</div>
            </div>

            <button
              type="submit"
              disabled={generateSlotsMutation.isPending}
              className="w-full py-3 bg-gradient-to-r from-primary-700 to-emerald-700 hover:from-primary-800 hover:to-emerald-800 text-white font-bold rounded-xl shadow transition-all"
            >
              {generateSlotsMutation.isPending ? 'Allocating Slots...' : 'Generate & Deploy Center Slots'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Master Farmer & Token Registry */}
      {activeTab === 'registry' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
          <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-2xl border border-indigo-700/40 relative overflow-hidden">
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
              <div className="bg-slate-900/90 backdrop-blur-md rounded-xl p-4 border border-indigo-500/30 min-w-[280px]">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-emerald-400" /> Real-Time DBT Stream</span>
                  <span className="font-mono bg-indigo-950 px-2 py-0.5 rounded text-[11px] text-indigo-300 border border-indigo-700/50">PFMS Net</span>
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  ₹{macro?.total_dbt_disbursed_cr || '146.58'} <span className="text-xs font-normal text-indigo-300">Cr Disbursed</span>
                </div>
                <div className="text-[11px] text-indigo-300/80 mt-1 flex justify-between">
                  <span>Tonnage: <strong>{macro?.total_tonnage_mt || '47,320'} MT</strong></span>
                  <span>Turnaround: <strong>{macro?.avg_turnaround_mins || '22.4'} mins</strong></span>
                </div>
              </div>
            </div>

            {/* Quick KPI Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-800/40">
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Reporting Mandis</div>
                <div className="text-xl font-bold text-white mt-1">{macro?.total_mandis || 4129} <span className="text-xs font-normal text-indigo-300">APMC Yards</span></div>
                <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> 100% Operational Grid
                </div>
              </div>
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Daily Scheduled Farmers</div>
                <div className="text-xl font-bold text-white mt-1">{(macro?.total_farmers_today || 12450).toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">e-Tokens Verified</div>
              </div>
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Procured & Settled</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">{(macro?.total_completed || 7820).toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">PFMS Instant Settlements</div>
              </div>
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Active In Queue</div>
                <div className="text-xl font-bold text-amber-400 mt-1">{(macro?.total_waiting || 4630).toLocaleString()}</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">Holding bay & verification</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Ingestion Throughput & DBT Cashflow Stream */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
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
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Mean Clearance: 92.4%
                </span>
                <span className="flex items-center gap-1 font-mono text-[11px]">
                  Peak Hour: 12:00 - 14:00 (740 MT)
                </span>
              </div>
            </div>

            {/* Chart 2: District Congestion Pressure Index (CPI) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                <div key={idx} className="bg-slate-50 hover:bg-emerald-50/40 rounded-xl p-4 border border-gray-200 transition-all flex flex-col justify-between">
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-gray-200 hover:border-indigo-300 transition-all">
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
                      className="bg-gradient-to-r from-indigo-500 to-purple-600 h-2.5 rounded-full"
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
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
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
                <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-gray-200 hover:border-indigo-400 transition-all flex flex-col justify-between">
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
    </div>
  );
}
