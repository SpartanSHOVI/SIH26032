import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2,
  ShieldCheck,
  Search,
  MapPin,
  Tag,
  KeyRound,
  ArrowLeft,
  AlertTriangle
} from 'lucide-react';
import { locationApi, bookingApi } from '../services/api';
import { useCenterAuth } from '../context/CenterAuthContext';

export default function CenterLogin() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';
  const { loginAsCenter } = useCenterAuth();

  // Filters state
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [selectedState, setSelectedState] = useState<string>('');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Center for customized login modal / form
  const [activeCenter, setActiveCenter] = useState<any>(null);
  const [operatorId, setOperatorId] = useState('');
  const [operatorPin, setOperatorPin] = useState('');
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

  return (
    <div className="min-h-screen gov-page text-slate-800 flex flex-col font-sans">
      {/* Header Bar */}
      <header className="px-6 py-5 max-w-7xl mx-auto w-full flex items-center justify-between border-b border-slate-300">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-2 bg-white hover:bg-slate-100 rounded-lg text-gov-navy border border-slate-300 transition-colors"
            title="Return to Portal Gateway"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center shadow-sm ">
            <Building2 className="w-5 h-5 text-stone-950" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight flex items-center gap-2">
              AnnSetu <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-gov-navy font-bold border border-slate-300">Mandi Operator Gateway</span>
            </span>
            <span className="text-xs text-gov-navy block -mt-0.5 font-medium">
              AnnSetu procurement center services
            </span>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs font-mono bg-white/10 px-3 py-1.5 rounded-full border border-slate-200 text-gov-navy">
          <ShieldCheck className="w-3.5 h-3.5 text-gov-navy" />
          <span>Center operator portal</span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-8 flex-1">
        {isExpired && (
          <div className="max-w-3xl mx-auto p-4 bg-amber-50/90 border border-amber-300 rounded-lg text-amber-900 text-sm flex items-center gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-semibold">Operator Session Expired</p>
              <p className="text-xs text-amber-800">Your session timed out. Please select your center and authenticate with your operator PIN again.</p>
            </div>
          </div>
        )}
        {/* Title & Classification Selector Banner */}
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="text-xs font-bold uppercase tracking-widest text-gov-navy bg-white px-3 py-1 rounded-full border border-slate-300 inline-flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Select Mandi Classification
          </span>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">
            Select your procurement center
          </h1>
          <p className="text-sm text-slate-600">
            Access your designated Mandi Terminal by selecting its Classification or searching across 4,129 national APMC procurement yards.
          </p>
        </div>

        {/* Classification Option Filter Pills */}
        <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-sm ">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setSelectedClassification('')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedClassification === ''
                  ? 'bg-amber-500 text-stone-950 shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-300'
              }`}
            >
              <span>All classifications</span>
              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full">4,129</span>
            </button>

            {classifications.map((cls: string) => {
              const active = selectedClassification === cls;
              return (
                <button
                  key={cls}
                  onClick={() => setSelectedClassification(active ? '' : cls)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    active
                      ? 'bg-amber-500 text-stone-950 shadow-md font-bold'
                      : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-300'
                  }`}
                >
                  <Tag className="w-3 h-3 text-gov-navy" />
                  <span>{cls}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Search Across All 4,129 Classified Mandis */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-gov-navy" />
              <span>Search & Authorize Procurement Centre Terminal (4,129 Mandis)</span>
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Filter by State, District, and Mandi Classification to select and log in to your authorized procurement centre terminal.
            </p>
          </div>

          {/* Search & Location Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">State / UT</label>
              <select
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict('');
                }}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-slate-300"
              >
                <option value="">All States (National)</option>
                {states.map((s: string) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">District</label>
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                disabled={!selectedState}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-slate-300 disabled:opacity-50"
              >
                <option value="">All Districts in {selectedState || 'State'}</option>
                {districts.map((d: string) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Classification</label>
              <select
                value={selectedClassification}
                onChange={(e) => setSelectedClassification(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:ring-2 focus:ring-amber-500 focus:border-slate-300"
              >
                <option value="">All Classifications</option>
                {classifications.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Mandi Name or Code</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-600 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. Khanna, CTA, AGM..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder-stone-500 focus:ring-2 focus:ring-amber-500 focus:border-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Center Results List */}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {searchLoading ? (
              <div className="text-center py-8 text-xs text-slate-600">Searching procurement centres...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-500 bg-white rounded-lg border border-slate-200">
                No procurement centres found matching the selected filters.
              </div>
            ) : (
              searchResults.map((c: any) => {
                const isChosen = activeCenter?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveCenter(c)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isChosen
                        ? 'bg-white border-amber-400 shadow-md'
                        : 'bg-white hover:bg-slate-100 border-slate-300/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white text-gov-navy flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {c.code.substring(0, 3)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{c.name}</span>
                          <span className="text-[10px] font-mono text-gov-navy bg-white px-1.5 py-0.5 rounded border border-slate-300">
                            {c.code}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-2 mt-0.5">
                          <span>{c.district || c.location}, {c.state}</span>
                          <span>•</span>
                          <span className="text-gov-navy/90 font-medium">{c.classification || 'APMC (Regulated)'}</span>
                          <span>•</span>
                          <span>Cap: {c.capacity_per_hour || 25}/hr</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveCenter(c)}
                      aria-pressed={isChosen}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 ${
                        isChosen
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-white text-slate-600 hover:bg-amber-600 hover:text-slate-900'
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
              className="bg-white border-2 border-slate-300 rounded-lg p-5 space-y-4 animate-in fade-in"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gov-navy">Ready to Log In</span>
                  <h3 className="text-base font-bold text-slate-900">
                    {activeCenter.name} ({activeCenter.code})
                  </h3>
                  <div className="text-xs text-gov-navy">
                    Classification: <strong>{activeCenter.classification || 'APMC Yard'}</strong> | {activeCenter.district}, {activeCenter.state}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCenter(null)}
                  className="text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Clear Selection
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Staff Operator ID
                  </label>
                  <input
                    type="text"
                    required
                    value={operatorId}
                    onChange={(e) => setOperatorId(e.target.value)}
                    placeholder="e.g. OP-4129"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Terminal PIN / Access Key
                  </label>
                  <input
                    type="password"
                    required
                    value={operatorPin}
                    onChange={(e) => setOperatorPin(e.target.value)}
                    placeholder="Enter Terminal PIN / Key"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
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
      <footer className="bg-white border-t border-amber-900/40 py-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>© 2026 AnnSetu • Classified APMC Procurement Terminal Network</div>
          <div className="font-mono text-slate-600">
            Node: /center/login • 4,129 Total Verified Mandis
          </div>
        </div>
      </footer>
    </div>
  );
}
