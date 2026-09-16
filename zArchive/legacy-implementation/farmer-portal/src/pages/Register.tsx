import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { locationApi } from '../services/api';
import { Loader2, ArrowLeft, UserPlus, CheckCircle2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

const COMMON_CROPS = [
  'Wheat',
  'Paddy',
  'Mustard',
  'Cotton',
  'Bajra',
  'Maize',
  'Soybean',
  'Gram / Chana',
  'Ragi',
  'Jowar',
  'Sugarcane',
  'Groundnut'
];

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

  // 1. Fetch Indian States on Mount
  useEffect(() => {
    locationApi.getStates()
      .then((res) => {
        const stateList = res.data || [];
        setStates(stateList);
        if (stateList.length > 0) {
          const defaultState = stateList.includes('Punjab') ? 'Punjab' : stateList[0];
          setFormData((prev) => ({ ...prev, state: defaultState }));
        }
      })
      .catch((err) => {
        console.error('Failed to load states:', err);
      });
  }, []);

  // 2. Fetch Districts whenever State changes
  useEffect(() => {
    if (!formData.state) return;
    setLoadingLocations(true);
    locationApi.getDistricts(formData.state)
      .then((res) => {
        const districtList = res.data || [];
        setDistricts(districtList);
        if (districtList.length > 0) {
          setFormData((prev) => ({ ...prev, district: districtList[0] }));
        } else {
          setDistricts([]);
          setCenters([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load districts:', err);
      })
      .finally(() => setLoadingLocations(false));
  }, [formData.state]);

  // 3. Fetch APMC Centers whenever District changes
  useEffect(() => {
    if (!formData.state || !formData.district) return;
    locationApi.getCenters(formData.state, formData.district)
      .then((res) => {
        const centerList = res.data || [];
        setCenters(centerList);
        if (centerList.length > 0) {
          setFormData((prev) => ({ ...prev, preferred_center_id: centerList[0].id }));
        } else {
          setFormData((prev) => ({ ...prev, preferred_center_id: '' }));
        }
      })
      .catch((err) => {
        console.error('Failed to load centers:', err);
      });
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
      toast.error(
        error.response?.data?.error ||
        error.response?.data?.message ||
        'Registration failed. Please check your details or try a different mobile number.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-emerald-950 py-12 px-4 sm:px-6 font-sans">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Navigation back */}
        <Link
          to="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Farmer Login
        </Link>

        {/* Header */}
        <div className="bg-slate-800/90 border border-emerald-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-md text-white flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 font-mono">
              National APMC Integration • 4,129 Mandis
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Register New Unique Farmer</h1>
            <p className="text-xs sm:text-sm text-slate-300">
              Create your personalized account to book procurement slots and track dynamic mandi queues.
            </p>
          </div>
          <div className="hidden sm:flex w-14 h-14 bg-gradient-to-tr from-amber-500 to-emerald-400 rounded-2xl items-center justify-center text-primary-950 font-black text-2xl shadow-lg">
            अ
          </div>
        </div>

        {/* Registration Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Personal & Contact Info */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-800 border-b border-emerald-100 pb-2 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">1</span>
                Personal & Contact Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Mobile Number (10 Digits) <span className="text-red-500">*</span>
                  </label>
                  <input
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Aadhaar Number (Optional)
                  </label>
                  <input
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Account Password (Default: 123456)
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Leave blank for demo OTP (123456)"
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    District <span className="text-red-500">*</span> {loadingLocations && <span className="text-[10px] text-emerald-600 font-normal animate-pulse">(Loading...)</span>}
                  </label>
                  <select
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                    Preferred APMC Procurement Center
                  </label>
                  <select
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
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Primary Produce / Crop
                  </label>
                  <select
                    name="crop"
                    value={formData.crop}
                    onChange={handleChange}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors"
                  >
                    {COMMON_CROPS.map((cr) => (
                      <option key={cr} value={cr}>{cr}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Estimated Quantity (Quintals)
                  </label>
                  <input
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
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Bank Account Number (PFMS DBT)
                  </label>
                  <input
                    type="text"
                    name="bank_account"
                    value={formData.bank_account}
                    onChange={handleChange}
                    placeholder="e.g. 30129847192"
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-emerald-500 focus:bg-white focus:border-emerald-500 transition-colors font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1">
                    Bank IFSC Code
                  </label>
                  <input
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
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-900">
                  By registering, I consent to digital slot allocation, SMS/WhatsApp queue notifications, and PFMS Direct Benefit Transfer under the Digital Personal Data Protection (DPDP) Act 2023.
                </p>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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