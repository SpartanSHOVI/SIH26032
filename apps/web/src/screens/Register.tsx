import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { locationApi } from '../services/api';
import { Loader2, ArrowLeft, UserPlus, CheckCircle2, Building2 } from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import toast from 'react-hot-toast';
import {
  COMMODITY_GROUPS,
  ALL_COMMODITIES,
  POPULAR_MSP_CROPS,
  getCommodityGroup,
  getGroupBadgeStyle,
} from '../utils/commodityUtils';

const toStateName = (value: unknown) =>
  typeof value === 'string' ? value : String((value as { state?: unknown })?.state ?? '');

const toDistrictName = (value: unknown) =>
  typeof value === 'string' ? value : String((value as { district?: unknown })?.district ?? '');

export default function Register() {
  const navigate = useNavigate();
  const { register: registerFarmer } = useAuth();

  // Dynamic location states
  const [states, setStates] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [centers, setCenters] = useState<Array<{ id: string; name: string; classification?: string }>>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    aadhaar: '',
    state: '',
    district: '',
    preferred_center_id: '',
    crop: 'Wheat',
    quantity: '35',
    bank_account: '',
    ifsc: '',
    password: '',
    language: 'English',
  });

  const [cropFilterGroup, setCropFilterGroup] = useState<string>('All');

  // 1. Fetch Indian States on Mount
  useEffect(() => {
    locationApi.getStates()
      .then((res: any) => {
        const raw = Array.isArray(res?.data) ? res.data : (res?.data?.data || res || []);
        const stateList = (Array.isArray(raw) ? raw : []).map(toStateName).filter(Boolean);
        setStates(stateList);
      })
      .catch(() => {
        // Fallback standard procurement states
        setStates(['Punjab', 'Haryana', 'Madhya Pradesh', 'Uttar Pradesh', 'Rajasthan', 'Bihar', 'Odisha']);
      });
  }, []);

  // 2. Fetch Districts when State changes
  useEffect(() => {
    if (!formData.state) {
      setDistricts([]);
      setCenters([]);
      return;
    }
    setLoadingLocations(true);
    locationApi.getDistricts(formData.state)
      .then((res: any) => {
        const raw = Array.isArray(res?.data) ? res.data : (res?.data?.data || res || []);
        const districtList = (Array.isArray(raw) ? raw : []).map(toDistrictName).filter(Boolean);
        setDistricts(districtList);
        setFormData(prev => ({ ...prev, district: '', preferred_center_id: '' }));
      })
      .catch(() => {
        setDistricts([]);
      })
      .finally(() => setLoadingLocations(false));
  }, [formData.state]);

  // 3. Fetch Mandi Procurement Centers when District changes
  useEffect(() => {
    if (!formData.state || !formData.district) {
      setCenters([]);
      return;
    }
    setLoadingLocations(true);
    locationApi.getCenters(formData.state, formData.district)
      .then((res) => {
        const raw = res.data?.data || res.data || [];
        setCenters(Array.isArray(raw) ? raw : []);
        setFormData(prev => ({ ...prev, preferred_center_id: '' }));
      })
      .catch(() => {
        setCenters([]);
      })
      .finally(() => setLoadingLocations(false));
  }, [formData.state, formData.district]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const cleanMobile = formData.mobile.replace(/[^0-9]/g, '');
    if (cleanMobile.length !== 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('Please enter your full name');
      return;
    }

    setSubmitting(true);
    try {
      await registerFarmer({
        ...formData,
        mobile: cleanMobile,
        quantity: parseFloat(formData.quantity) || 30.0,
      });

      toast.success(`Welcome to AnnSetu, ${formData.name}! Your account is ready.`);
      navigate('/farmer/dashboard');
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error;
      if (error.response?.status === 409 || msg?.toLowerCase().includes('already registered')) {
        toast.error('This mobile number is already registered! Redirecting to login...', { duration: 4000 });
        setTimeout(() => navigate('/login'), 2000);
      } else {
        toast.error(msg || 'Registration failed. Please verify your details.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const detectedGroup = getCommodityGroup(formData.crop);
  const groupTheme = getGroupBadgeStyle(detectedGroup);

  return (
    <div className="min-h-screen gov-page py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation back and language selector */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-semibold text-gov-blue hover:text-gov-navy transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Farmer Login
          </Link>
          <LanguageSelector theme="light" />
        </div>

        {/* Header */}
        <div className="bg-gov-navy border border-slate-300 rounded-lg p-6 shadow-sm backdrop-blur-md text-white flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              National APMC Integration • 4,129 Mandis
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Register as a farmer</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Create your personalized account to book procurement slots and track dynamic mandi queues.
            </p>
          </div>
          <div className="gov-emblem shrink-0">
            अ
          </div>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Personal & Contact Info */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800 border-b border-emerald-100 pb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">1</span>
                Personal & Contact Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-name" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Balwinder Singh"
                    required
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-mobile" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Mobile Number (10 Digits) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="reg-mobile"
                    type="tel"
                    name="mobile"
                    maxLength={10}
                    value={formData.mobile}
                    onChange={handleChange}
                    placeholder="e.g. 9811223344"
                    required
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-aadhaar" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Aadhaar Number (Optional)
                  </label>
                  <input
                    id="reg-aadhaar"
                    type="text"
                    name="aadhaar"
                    maxLength={12}
                    value={formData.aadhaar}
                    onChange={handleChange}
                    placeholder="12-digit Aadhaar for instant verification"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Account Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Create account password or 6-digit PIN"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 2. Geographic Location & Mandi Selection */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800 border-b border-emerald-100 pb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">2</span>
                Mandi Location & Preferred APMC
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="reg-state" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="reg-state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  >
                    {states.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="reg-district" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    District <span className="text-red-500">*</span> {loadingLocations && <span className="text-[10px] text-emerald-600 font-normal ">(Loading...)</span>}
                  </label>
                  <select
                    id="reg-district"
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    required
                    disabled={districts.length === 0}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {districts.map((dst) => (
                      <option key={dst} value={dst}>{dst}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="reg-center" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    Preferred APMC Procurement Center
                  </label>
                  <select
                    id="reg-center"
                    name="preferred_center_id"
                    value={formData.preferred_center_id}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  >
                    {centers.length > 0 ? (
                      centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.classification ? `(${c.classification})` : ''}
                        </option>
                      ))
                    ) : (
                      <option value="">No registered centers found for this district</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Crop & Banking for Direct Benefit Transfer */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800 border-b border-emerald-100 pb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">3</span>
                Produce & Direct Benefit Transfer (DBT)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="reg-crop" className="block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Primary Produce / Crop
                    </label>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${groupTheme.bg} ${groupTheme.text} ${groupTheme.border}`}>
                      <span>{groupTheme.icon}</span>
                      <span>Category: {detectedGroup}</span>
                    </span>
                  </div>

                  {/* Popular MSP Quick Select Chips */}
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Top Mandi Produce (Click to Quick Select):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {POPULAR_MSP_CROPS.map((crop) => (
                        <button
                          key={crop.name}
                          type="button"
                          onClick={() => setFormData((prev) => ({ ...prev, crop: crop.name }))}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                            formData.crop === crop.name
                              ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-500 ring-offset-1 font-bold'
                              : 'bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200'
                          }`}
                        >
                          {crop.name} {crop.hindi ? `(${crop.hindi})` : ''} · ₹{crop.msp}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* Category Filter */}
                    <div>
                      <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Filter by Category
                      </label>
                      <select
                        value={cropFilterGroup}
                        onChange={(e) => setCropFilterGroup(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500"
                        title="Filter by Agricultural Category"
                      >
                        <option value="All">All Categories (605+ Commodities)</option>
                        {COMMODITY_GROUPS.map((g) => (
                          <option key={g.name} value={g.name}>
                            {g.icon} {g.name} ({g.count})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Specific Crop Dropdown */}
                    <div className="sm:col-span-2">
                      <label htmlFor="reg-crop" className="block text-[11px] font-semibold text-gray-600 mb-1">
                        Select Commodity ({cropFilterGroup === 'All' ? '605+ Varieties' : `${cropFilterGroup}`})
                      </label>
                      <select
                        id="reg-crop"
                        name="crop"
                        value={formData.crop}
                        onChange={handleChange}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                      >
                        {cropFilterGroup === 'All' ? (
                          COMMODITY_GROUPS.map((group) => {
                            const groupCrops = ALL_COMMODITIES.filter((c) => c.group_name === group.name);
                            return (
                              <optgroup key={group.name} label={`${group.icon} ${group.name} (${groupCrops.length})`}>
                                {groupCrops.map((c) => (
                                  <option key={c.id} value={c.cmdt_name}>
                                    {c.cmdt_name}
                                  </option>
                                ))}
                              </optgroup>
                            );
                          })
                        ) : (
                          ALL_COMMODITIES.filter((c) => c.group_name === cropFilterGroup).map((c) => (
                            <option key={c.id} value={c.cmdt_name}>
                              {c.cmdt_name}
                            </option>
                          ))
                        )}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-quantity" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Estimated Quantity (Quintals)
                  </label>
                  <input
                    id="reg-quantity"
                    type="number"
                    name="quantity"
                    min="1"
                    step="0.5"
                    value={formData.quantity}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="reg-bank-account" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Bank Account Number (PFMS DBT)
                  </label>
                  <input
                    id="reg-bank-account"
                    type="text"
                    name="bank_account"
                    value={formData.bank_account}
                    onChange={handleChange}
                    placeholder="e.g. 30129847192"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="reg-ifsc" className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Bank IFSC Code
                  </label>
                  <input
                    id="reg-ifsc"
                    type="text"
                    name="ifsc"
                    value={formData.ifsc}
                    onChange={handleChange}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors font-mono uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Consent & Submit */}
            <div className="pt-4 border-t border-gray-100 space-y-4">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-900">
                  By registering, I consent to digital slot allocation, SMS/WhatsApp queue notifications, and PFMS Direct Benefit Transfer under the Digital Personal Data Protection (DPDP) Act 2023.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-lg transition-all shadow-sm shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Creating your unique farmer account...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    <span>Complete Registration & Launch Portal</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
