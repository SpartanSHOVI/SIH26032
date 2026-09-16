import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ShieldCheck,
  Search,
  ArrowRight,
  Sparkles,
  MapPin,
  Tag,
  KeyRound,
  ArrowLeft
} from 'lucide-react';
import { locationApi, bookingApi } from '../services/api';
import { useCenterAuth } from '../context/CenterAuthContext';

// 6 Featured Real Mandis with diverse verified classifications
const FEATURED_CENTERS = [
  {
    code: 'PUN001',
    name: 'Khanna Grain Market',
    classification: 'Grain Market',
    state: 'Punjab',
    district: 'Ludhiana',
    location: 'GT Road, Khanna',
    operatorName: 'Gurpreet Singh',
    operatorId: 'OP-PUN01',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    icon: '🌾',
  },
  {
    code: 'CTA',
    name: 'Center A - Wardha Road Mandi',
    classification: 'APMC (Regulated)',
    state: 'Maharashtra',
    district: 'Nagpur',
    location: 'Wardha Road, Nagpur',
    operatorName: 'Vikas Deshmukh',
    operatorId: 'OP-CTA01',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    icon: '🏛️',
  },
  {
    code: 'AGM00550',
    name: 'AGRICULTURE PRODUCE MARKET COMITEE CHANDWAD',
    classification: 'Principal Yard',
    state: 'Maharashtra',
    district: 'Nashik',
    location: 'Chandwad Yard, Nashik',
    operatorName: 'Nitin Patil',
    operatorId: 'OP-NSK02',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    icon: '⚖️',
  },
  {
    code: 'AGM04909',
    name: 'Guramkonda Sub-yard of AMC Valmikipuram',
    classification: 'Sub Yard',
    state: 'Andhra Pradesh',
    district: 'Annamayya',
    location: 'Valmikipuram Road, Annamayya',
    operatorName: 'S. Reddy',
    operatorId: 'OP-ANM01',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    icon: '🏢',
  },
  {
    code: 'AGM03365',
    name: 'Perka Vegetable Market',
    classification: 'Fruit & Vegetable',
    state: 'Andaman and Nicobar',
    district: 'Nicobar',
    location: 'Car Nicobar, A&N',
    operatorName: 'Anil Minz',
    operatorId: 'OP-NIC01',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    icon: '🥦',
  },
  {
    code: 'AGM02593',
    name: 'Kadi(Kadi cotton Yard) APMC',
    classification: 'Cotton Market',
    state: 'Gujarat',
    district: 'Mehsana',
    location: 'Cotton Yard, Kadi',
    operatorName: 'Paresh Patel',
    operatorId: 'OP-MSN01',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    icon: '🧵',
  },
];

export default function CenterLogin() {
  const navigate = useNavigate();
  const { loginAsCenter } = useCenterAuth();

  // Filters state
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Center for customized login modal / form
  const [activeCenter, setActiveCenter] = useState<any>(null);
  const [operatorId, setOperatorId] = useState('OP-APMC01');
  const [operatorPin, setOperatorPin] = useState('123456');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Classifications from DB
  const { data: classifications = [] } = useQuery({
    queryKey: ['locationClassifications'],
    queryFn: async () => {
      const res = await locationApi.getClassifications();
      return res.data;
    },
  });

  // Fetch States
  const { data: states = [] } = useQuery({
    queryKey: ['locationStates'],
    queryFn: async () => {
      const res = await locationApi.getStates();
      return res.data;
    },
  });

  // Fetch Districts
  const { data: districts = [] } = useQuery({
    queryKey: ['locationDistricts', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const res = await locationApi.getDistricts(selectedState);
      return res.data;
    },
    enabled: !!selectedState,
  });

  // Search Mandis / Procurement Centres
  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['classifiedCenters', selectedClassification, selectedState, selectedDistrict, searchQuery],
    queryFn: async () => {
      const res = await bookingApi.getCenters({
        classification: selectedClassification || undefined,
        state: selectedState || undefined,
        district: selectedDistrict || undefined,
        search: searchQuery || undefined,
        limit: 30,
      });
      return res.data;
    },
  });

  // Quick 1-Click Login Handler
  const handleQuickLogin = async (featured: typeof FEATURED_CENTERS[0]) => {
    setIsSubmitting(true);
    try {
      await loginAsCenter({
        center_code: featured.code,
        operator_id: featured.operatorId,
        operator_name: featured.operatorName,
        pin: '123456',
      });
      navigate('/center');
    } catch (e) {
      // Toast already handled in context
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom Mandi Login Handler
  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCenter) return;
    setIsSubmitting(true);
    try {
      await loginAsCenter({
        center_id: activeCenter.id,
        center_code: activeCenter.code,
        operator_id: operatorId || `OP-${activeCenter.code}`,
        pin: operatorPin,
      });
      navigate('/center');
    } catch (e) {
      // Handled
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter featured cards by current classification filter
  const filteredFeatured = selectedClassification
    ? FEATURED_CENTERS.filter((c) => c.classification === selectedClassification)
    : FEATURED_CENTERS;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-950 via-amber-950 to-stone-900 text-white flex flex-col font-sans">
      {/* Header Bar */}
      <header className="px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-amber-800/40">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-amber-900/40 hover:bg-amber-800/60 rounded-xl text-amber-300 border border-amber-700/40 transition-colors"
            title="Return to Portal Gateway"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-gradient-to-tr from-amber-500 to-amber-300 rounded-xl flex items-center justify-center shadow-lg shadow-amber-950/50">
            <Building2 className="w-5 h-5 text-stone-950" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight flex items-center gap-2">
              AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">Mandi Operator Gateway</span>
            </span>
            <span className="text-xs text-amber-300/80 block -mt-0.5 font-medium">
              National Agricultural Procurement Network • Official APMC Terminal Sign-In
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-white/10 px-3 py-1.5 rounded-full border border-white/15 text-amber-200">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
          <span>Classified Mandi Operator Terminal</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8 flex-1">
        {/* Title & Classification Selector Banner */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400 bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/30 inline-flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Select Mandi Classification
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Procurement Centre Staff Authentication
          </h1>
          <p className="text-sm text-stone-300">
            Access your designated Mandi Terminal by selecting its Classification or searching across 4,129 national APMC procurement yards.
          </p>
        </div>

        {/* Classification Option Filter Pills */}
        <div className="bg-stone-900/80 border border-amber-800/40 rounded-2xl p-3 shadow-xl backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setSelectedClassification('')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedClassification === ''
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700'
              }`}
            >
              <span>🌐 All Classifications</span>
              <span className="text-[10px] bg-black/20 px-1.5 py-0.5 rounded-full">4,129</span>
            </button>

            {classifications.map((cls: string) => {
              const active = selectedClassification === cls;
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClassification(active ? '' : cls)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                      : 'bg-stone-800/80 text-stone-300 hover:bg-stone-700 hover:text-white border border-stone-700'
                  }`}
                >
                  <Tag className="w-3 h-3 text-amber-400" />
                  <span>{cls}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 1: 1-Click Mandi Operator Profiles */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <h2 className="text-base font-bold text-white tracking-wide">
                Quick 1-Click Mandi Operator Logins
              </h2>
              {selectedClassification && (
                <span className="text-xs text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800">
                  Filtered by: {selectedClassification}
                </span>
              )}
            </div>
            <span className="text-xs text-stone-400 font-mono">Instant Session Deployment</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredFeatured.map((item) => (
              <div
                key={item.code}
                onClick={() => handleQuickLogin(item)}
                className="group bg-stone-900/90 hover:bg-amber-950/40 rounded-xl p-4 border border-amber-800/50 hover:border-amber-400 transition-all cursor-pointer shadow-lg flex flex-col justify-between relative overflow-hidden"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="text-xs font-mono font-bold text-amber-400 tracking-wider">
                          CODE: {item.code}
                        </div>
                        <h3 className="text-sm font-bold text-white group-hover:text-amber-200 transition-colors line-clamp-1">
                          {item.name}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                      {item.classification}
                    </span>
                    <span className="text-[11px] text-stone-400 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-stone-500" /> {item.district}, {item.state}
                    </span>
                  </div>

                  <div className="bg-black/30 rounded-lg p-2 text-xs text-stone-300 font-mono flex items-center justify-between border border-white/5">
                    <span className="text-stone-400">Operator:</span>
                    <span className="font-semibold text-amber-300">{item.operatorName} ({item.operatorId})</span>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300">
                  <span>Sign In to Mandi Terminal</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: Interactive Search Across All 4,129 Classified Mandis */}
        <div className="bg-stone-900/90 border border-amber-800/40 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="border-b border-white/10 pb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Search className="w-5 h-5 text-amber-400" />
              <span>Search & Log In to Any Unique Mandi (4,129 Centres)</span>
            </h2>
            <p className="text-xs text-stone-400 mt-0.5">
              Filter by State, District, and Mandi Classification to log in as any procurement centre operator in India.
            </p>
          </div>

          {/* Search & Location Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">State / UT</label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict('');
                }}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-xs font-medium text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">All States (National)</option>
                {states.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">District</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                disabled={!selectedState}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-xs font-medium text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 disabled:opacity-50"
              >
                <option value="">All Districts in {selectedState || 'State'}</option>
                {districts.map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Classification</label>
              <select
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
                className="w-full px-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-xs font-medium text-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              >
                <option value="">All Classifications</option>
                {classifications.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-300 mb-1">Mandi Name or Code</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. Khanna, CTA, AGM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-stone-800 border border-stone-700 rounded-lg text-xs font-medium text-white placeholder-stone-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Center Results List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {searchLoading ? (
              <div className="text-center py-8 text-xs text-stone-400">Searching procurement centres...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-500 bg-stone-950/50 rounded-xl border border-white/5">
                No procurement centres found matching the selected filters.
              </div>
            ) : (
              searchResults.map((c: any) => {
                const isChosen = activeCenter?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCenter(c)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isChosen
                        ? 'bg-amber-950/70 border-amber-400 shadow-md'
                        : 'bg-stone-800/60 hover:bg-stone-800 border-stone-700/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-stone-700/60 text-amber-400 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {c.code.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{c.name}</span>
                          <span className="text-[10px] font-mono text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-700/40">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-xs text-stone-400 flex items-center gap-2 mt-0.5">
                          <span>{c.district || c.location}, {c.state}</span>
                          <span>•</span>
                          <span className="text-amber-300/90 font-medium">{c.classification || 'APMC (Regulated)'}</span>
                          <span>•</span>
                          <span>Cap: {c.capacity_per_hour || 25}/hr</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 ${
                        isChosen
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-stone-700 text-stone-200 hover:bg-amber-600 hover:text-white'
                      }`}
                    >
                      {isChosen ? 'Selected Mandi' : 'Select Mandi'}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Active Mandi Login Form (Appears when a center is selected) */}
          {activeCenter && (
            <form
              onSubmit={handleCustomLogin}
              className="bg-amber-950/40 border-2 border-amber-500/50 rounded-xl p-5 space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Ready to Log In</span>
                  <h3 className="text-base font-bold text-white">
                    {activeCenter.name} ({activeCenter.code})
                  </h3>
                  <div className="text-xs text-amber-200/80">
                    Classification: <strong>{activeCenter.classification || 'APMC Yard'}</strong> | {activeCenter.district}, {activeCenter.state}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCenter(null)}
                  className="text-xs text-stone-400 hover:text-white underline"
                >
                  Clear Selection
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Staff Operator ID
                  </label>
                  <input
                    type="text"
                    required
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    placeholder="e.g. OP-4129"
                    className="w-full px-3 py-2 bg-stone-900 border border-amber-700/50 rounded-lg text-xs font-mono text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Terminal PIN / Access Key
                  </label>
                  <input
                    type="password"
                    required
                    value={operatorPin}
                    onChange={(e) => setOperatorPin(e.target.value)}
                    placeholder="PIN (Demo: 123456)"
                    className="w-full px-3 py-2 bg-stone-900 border border-amber-700/50 rounded-lg text-xs font-mono text-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold rounded-lg text-sm shadow-md flex items-center gap-2 transition-transform hover:scale-[1.02] disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{isSubmitting ? 'Authenticating...' : `Authorize & Open ${activeCenter.name} Terminal`}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-stone-950 border-t border-amber-900/40 py-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 AnnSetu • Classified APMC Procurement Terminal Network</div>
          <div className="font-mono text-stone-400">
            Node: /center/login • 4,129 Total Verified Mandis
          </div>
        </div>
      </footer>
    </div>
  );
}
