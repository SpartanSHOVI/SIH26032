import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  MapPin,
  CheckCircle,
  Truck,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter
} from 'lucide-react';
import { bookingApi, locationApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';
import { getLocalDateString } from '../utils/dateUtils';

export default function Booking() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { farmer } = useAuth();

  const [selectedState, setSelectedState] = useState<string>(farmer?.state || '');
  const [selectedDistrict, setSelectedDistrict] = useState<string>(farmer?.district || '');
  const [selectedClassification, setSelectedClassification] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCenterId, setSelectedCenterId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);

  // Success Token Modal state
  const [bookingSuccessToken, setBookingSuccessToken] = useState<any>(null);

  // Sync state & district with logged-in farmer profile
  useEffect(() => {
    if (farmer?.state && !selectedState) {
      setSelectedState(farmer.state);
    }
    if (farmer?.district && !selectedDistrict) {
      setSelectedDistrict(farmer.district);
    }
  }, [farmer?.state, farmer?.district]);

  // 1. Fetch States (All 36 States/UTs from Agmarknet)
  const { data: states = [] } = useQuery({
    queryKey: ['locationStates'],
    queryFn: async () => {
      const res = await locationApi.getStates();
      return res.data;
    },
  });

  // Set default state if not selected
  useEffect(() => {
    if (states.length > 0 && !selectedState) {
      const defaultState = farmer?.state && states.includes(farmer.state)
        ? farmer.state
        : (states.includes('Punjab') ? 'Punjab' : states[0]);
      setSelectedState(defaultState);
    }
  }, [states, selectedState, farmer?.state]);

  // 2. Fetch Districts for State
  const { data: districts = [] } = useQuery({
    queryKey: ['locationDistricts', selectedState],
    queryFn: async () => {
      if (!selectedState) return [];
      const res = await locationApi.getDistricts(selectedState);
      return res.data;
    },
    enabled: !!selectedState,
  });

  // Set default district if available
  useEffect(() => {
    if (districts.length > 0 && !districts.includes(selectedDistrict)) {
      setSelectedDistrict(districts[0]);
    }
  }, [districts, selectedDistrict]);

  // 3. Fetch Mandi Classifications (APMC, Grain Market, F&V, etc.)
  const { data: classifications = [] } = useQuery({
    queryKey: ['locationClassifications'],
    queryFn: async () => {
      const res = await locationApi.getClassifications();
      return res.data;
    },
  });

  // 4. Fetch Centers for State & District with optional classification & search
  const { data: centers = [], isLoading: centersLoading } = useQuery({
    queryKey: ['locationCenters', selectedState, selectedDistrict, selectedClassification, searchQuery],
    queryFn: async () => {
      if (!selectedState || !selectedDistrict) return [];
      const res = await locationApi.getCenters(selectedState, selectedDistrict, selectedClassification || undefined, searchQuery || undefined);
      return res.data;
    },
    enabled: !!selectedState && !!selectedDistrict,
  });

  // Default select first center
  useEffect(() => {
    if (centers.length > 0) {
      const exists = centers.find((c: any) => c.id === selectedCenterId);
      if (!exists) {
        setSelectedCenterId(centers[0].id);
      }
    }
  }, [centers, selectedCenterId]);

  // 4. Fetch Slots for Selected Center and Date
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['bookingSlots', selectedCenterId, selectedDate],
    queryFn: async () => {
      if (!selectedCenterId) return [];
      const res = await bookingApi.getSlots(selectedCenterId, selectedDate);
      return res.data;
    },
    enabled: !!selectedCenterId,
  });

  // Reset slot if slots change
  useEffect(() => {
    if (slots.length > 0) {
      const firstAvail = slots.find((s: any) => !s.full);
      if (firstAvail) setSelectedSlotId(firstAvail.id);
    } else {
      setSelectedSlotId(null);
    }
  }, [slots]);

  // Book Slot Mutation
  const bookMutation = useMutation({
    mutationFn: (data: any) => bookingApi.bookToken(data),
    onSuccess: (res: any) => {
      setBookingSuccessToken(res.data);
      toast.success(`Token ${res.data.token_number} confirmed!`);
      queryClient.invalidateQueries({ queryKey: ['bookingSlots'] });
      queryClient.invalidateQueries({ queryKey: ['centerQueue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to book slot');
    },
  });

  const handleBooking = () => {
    if (!farmer?.id) {
      toast.error('Please log in to book a slot');
      return;
    }
    if (!selectedCenterId) {
      toast.error('Please select a procurement center');
      return;
    }
    if (!selectedSlotId) {
      toast.error('Please choose an available time window');
      return;
    }

    bookMutation.mutate({
      farmer_id: farmer.id,
      center_id: selectedCenterId,
      slot_id: selectedSlotId,
      booked_via: 'app',
    });
  };

  const selectedCenter = centers.find((c: any) => c.id === selectedCenterId);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="bg-white rounded-xl shadow-sm border border-primary-100 p-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <span>📅</span> Book Procurement Slot
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Select your nearest state procurement center, choose an arrival time window, and receive your digital queue token.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Center and Slot Selection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Location Filter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 text-xs font-bold flex items-center justify-center">
                1
              </span>
              Select State & District
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">State</label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedDistrict('');
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                >
                  {states.map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">District</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                >
                  {districts.map((d: string) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Classification Filter Pills & Search Box */}
            <div className="pt-2 space-y-2 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary-600" />
                  Mandi Classification & Search
                </label>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search mandi name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>

              {/* Classification Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedClassification('')}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                    selectedClassification === ''
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  All ({centers.length})
                </button>
                {classifications.map((cat: string) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedClassification(cat === selectedClassification ? '' : cat)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
                      selectedClassification === cat
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2: Choose Center Card */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-gray-700 mb-2">
                Available Mandis in {selectedDistrict || selectedState} ({centers.length} found)
              </label>

              {centersLoading ? (
                <div className="text-xs text-gray-500 py-6 text-center">Loading classified mandis from Agmarknet...</div>
              ) : centers.length === 0 ? (
                <div className="p-4 bg-amber-50 rounded-lg text-xs text-amber-800 border border-amber-200">
                  No mandis match your classification filter in {selectedDistrict}. Try selecting 'All' or another district.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                  {centers.map((c: any) => {
                    const isSelected = selectedCenterId === c.id;
                    const badgeColor =
                      c.classification === 'Grain Market'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : c.classification === 'Fruit & Vegetable'
                        ? 'bg-orange-100 text-orange-800 border-orange-200'
                        : c.classification === 'Sub Yard'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : c.classification === 'Principal Yard'
                        ? 'bg-blue-100 text-blue-800 border-blue-200'
                        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCenterId(c.id)}
                        className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50/70 shadow-sm'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-gray-900">{c.name}</div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              <span className="text-[10px] font-mono text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                                {c.code}
                              </span>
                              {c.classification && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                  {c.classification}
                                </span>
                              )}
                              {c.market_id && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  ID: {c.market_id}
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              c.status === 'Available'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {c.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mt-3 text-xs text-gray-600">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-primary-600" />
                            <span>{c.distance_km || 5} km</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Truck className="w-3.5 h-3.5 text-primary-600" />
                            <span>{c.waiting || 0} waiting</span>
                          </div>
                          <div>Cap: {c.capacity_per_hour * 4}/day</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Step 3: Choose Date & Time Window */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 text-xs font-bold flex items-center justify-center">
                2
              </span>
              Select Date & Hourly Slot Window
            </h2>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Procurement Date</label>
              <input
                type="date"
                value={selectedDate}
                min={getLocalDateString()}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full sm:w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-2">Available Hourly Time Slots</label>
              {slotsLoading ? (
                <div className="text-xs text-gray-500 py-4 text-center">Loading time windows...</div>
              ) : slots.length === 0 ? (
                <div className="text-xs text-gray-500 py-4 text-center">No slots available for this date.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {slots.map((s: any) => {
                    const isSelected = selectedSlotId === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={s.full}
                        onClick={() => setSelectedSlotId(s.id)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          isSelected
                            ? 'border-primary-600 bg-primary-50 text-primary-900 font-bold ring-2 ring-primary-500 shadow-sm'
                            : s.full
                            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-xs font-bold">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            {s.start_time} - {s.end_time}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          {s.full ? 'Slot Full' : `${s.remaining} left of ${s.total_slots}`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right 1 Column: Booking Summary & Confirm */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 sticky top-24">
            <h3 className="text-base font-bold text-gray-900 border-b border-gray-100 pb-3">Booking Summary</h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Farmer:</span>
                <span className="font-semibold text-gray-900">{farmer?.name || 'Farmer'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Mobile:</span>
                <span className="font-semibold text-gray-900">{farmer?.mobile || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Crop & Qty:</span>
                <span className="font-semibold text-gray-900">
                  {farmer?.crop || 'Produce'} ({farmer?.quantity ? `${farmer.quantity} Qtl` : '—'})
                </span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between">
                <span className="text-gray-500">Selected Mandi:</span>
                <span className="font-bold text-primary-900 text-right">{selectedCenter?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span className="font-semibold text-gray-900">{selectedDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time Window:</span>
                <span className="font-semibold text-primary-800">
                  {slots.find((s: any) => s.id === selectedSlotId)
                    ? `${slots.find((s: any) => s.id === selectedSlotId).start_time} - ${
                        slots.find((s: any) => s.id === selectedSlotId).end_time
                      }`
                    : '—'}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-lg text-[11px] text-emerald-800 flex items-start gap-2 border border-emerald-200">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <span>
                Tokens are issued under the MSP Procurement Guarantee. You will receive an SMS confirmation and live queue tracking.
              </span>
            </div>

            <button
              onClick={handleBooking}
              disabled={bookMutation.isPending || !selectedSlotId}
              className="w-full py-3 bg-gradient-to-r from-primary-700 to-emerald-700 hover:from-primary-800 hover:to-emerald-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>{bookMutation.isPending ? 'Issuing Token...' : 'Confirm Slot & Get Token'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      {bookingSuccessToken && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5 text-center">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>

            <div>
              <h3 className="text-xl font-black text-gray-900">Procurement Token Issued!</h3>
              <p className="text-xs text-gray-500 mt-1">SMS & WhatsApp confirmation sent to {bookingSuccessToken.farmer_mobile}</p>
            </div>

            <div className="p-4 bg-primary-50 rounded-xl border border-primary-200 text-left space-y-2">
              <div className="text-xs text-gray-500">Your Unique Token Number</div>
              <div className="text-3xl font-black font-mono text-primary-900 tracking-wider">
                {bookingSuccessToken.token_number}
              </div>
              <div className="text-xs font-semibold text-gray-700 pt-1">
                📍 {bookingSuccessToken.center}
              </div>
              <div className="text-xs text-gray-600">
                🕒 {bookingSuccessToken.date} ({bookingSuccessToken.time})
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setBookingSuccessToken(null)}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setBookingSuccessToken(null);
                  navigate('/farmer/queue');
                }}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
              >
                <Truck className="w-4 h-4" />
                <span>Track Live Queue</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}