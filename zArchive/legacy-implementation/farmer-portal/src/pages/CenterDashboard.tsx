import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  Megaphone,
  PhoneCall,
  RefreshCw,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  MessageSquare,
  Volume2,
  BarChart3,
  Cpu,
  TrendingUp,
  Layers,
  ArrowRight,
  Gauge,
  Zap,
  ArrowUpRight,
  Droplets
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ReferenceLine,
} from 'recharts';
import { centerApi, bookingApi } from '../services/api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { speakText } from '../utils/i18n';
import { calculateMspPayment, getMspRate } from '../utils/mspUtils';
import { getLocalDateString } from '../utils/dateUtils';
import { useCenterAuth } from '../context/CenterAuthContext';

export default function CenterDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { currentCenter } = useCenterAuth();
  const selectedCenterId = currentCenter?.center_id || '';
  const selectedCenter = currentCenter;
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'queue' | 'callbook' | 'announcement' | 'messages' | 'data_engineering'>('queue');

  // Modal states
  const [acceptModalToken, setAcceptModalToken] = useState<any>(null);
  const [receivedQuantity, setReceivedQuantity] = useState<number>(0);
  const [rejectModalToken, setRejectModalToken] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState<string>('Moisture level exceeds 14% limit');
  const [paymentModalToken, setPaymentModalToken] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<'online' | 'cash'>('online');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [transactionRef, setTransactionRef] = useState<string>('');

  // Call-in booking form state
  const [callName, setCallName] = useState('');
  const [callMobile, setCallMobile] = useState('');
  const [callLocation, setCallLocation] = useState('');
  const [callCrop, setCallCrop] = useState('Wheat');
  const [callQty, setCallQty] = useState('40');
  const [callSlotId, setCallSlotId] = useState<string>('');

  // Announcement state
  const [annReason, setAnnReason] = useState('Heavy Rain Alert');
  const [annMessage, setAnnMessage] = useState('Procurement operations briefly paused. Resuming shortly.');
  const [annNewDate, setAnnNewDate] = useState('');
  const [annNewTime, setAnnNewTime] = useState('');



  // Fetch slots for assisted booking
  const { data: availableSlots = [] } = useQuery({
    queryKey: ['centerSlots', selectedCenterId, selectedDate],
    queryFn: async () => {
      if (!selectedCenterId) return [];
      const res = await bookingApi.getSlots(selectedCenterId, selectedDate);
      return res.data;
    },
    enabled: !!selectedCenterId,
  });

  // Fetch Center Queue
  const { data: queue = [], isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ['centerQueue', selectedCenterId, selectedDate],
    queryFn: async () => {
      if (!selectedCenterId) return [];
      const res = await centerApi.getQueue(selectedCenterId, selectedDate);
      return res.data;
    },
    enabled: !!selectedCenterId,
    refetchInterval: 5000,
  });

  // Fetch Message Logs
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['messageLogs', selectedCenterId],
    queryFn: async () => {
      const res = await centerApi.getMessageLogs(undefined, selectedCenterId || undefined);
      return res.data;
    },
    enabled: activeTab === 'messages',
  });

  // Fetch Center Analytics for Data Engineering & Feature Engineering
  const { data: analytics = null, refetch: refetchAnalytics } = useQuery({
    queryKey: ['centerAnalytics', selectedCenterId, selectedDate],
    queryFn: async () => {
      if (!selectedCenterId) return null;
      const res = await centerApi.getAnalytics(selectedCenterId, selectedDate);
      return res.data;
    },
    enabled: !!selectedCenterId,
    refetchInterval: 10000,
  });

  // Call Next Mutation
  const callNextMutation = useMutation({
    mutationFn: () => centerApi.callNext(selectedCenterId, selectedDate),
    onSuccess: (res: any) => {
      const data = res.data;
      toast.success(`Called Token ${data.token_number} - ${data.farmer_name}`);
      speakText(`Token number ${data.token_number}, ${data.farmer_name}, please proceed to counter.`);
      queryClient.invalidateQueries({ queryKey: ['centerQueue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to call next farmer');
    },
  });

  // Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ tokenId, status, rejectReason, quantityReceived }: any) =>
      centerApi.updateStatus(tokenId, status, rejectReason, quantityReceived),
    onSuccess: (_, vars) => {
      toast.success(`Status updated to ${vars.status}`);
      setAcceptModalToken(null);
      setRejectModalToken(null);
      queryClient.invalidateQueries({ queryKey: ['centerQueue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to update status');
    },
  });

  // Update Payment Mutation
  const updatePaymentMutation = useMutation({
    mutationFn: ({ tokenId, method, status, amount, ref }: any) =>
      centerApi.updatePayment(tokenId, method, status, amount, ref),
    onSuccess: () => {
      toast.success('Payment completed and confirmed to farmer via SMS');
      setPaymentModalToken(null);
      queryClient.invalidateQueries({ queryKey: ['centerQueue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Payment update failed');
    },
  });

  // Assisted Booking Mutation
  const callBookMutation = useMutation({
    mutationFn: (data: any) => bookingApi.callBookToken(data),
    onSuccess: (res: any) => {
      toast.success(`Booked Token ${res.data.token_number} for ${res.data.farmer}!`);
      setCallName('');
      setCallMobile('');
      setCallLocation('');
      setActiveTab('queue');
      queryClient.invalidateQueries({ queryKey: ['centerQueue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Assisted booking failed');
    },
  });

  // Emergency Announcement Mutation
  const announcementMutation = useMutation({
    mutationFn: (data: any) => centerApi.createAnnouncement(selectedCenterId, data.reason, data.message, data.new_date, data.new_time),
    onSuccess: (res: any) => {
      toast.success(`Announcement sent! ${res.data.affected_farmers} active farmers notified.`);
      setAnnMessage('');
      queryClient.invalidateQueries({ queryKey: ['centerQueue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to broadcast announcement');
    },
  });



  // Queue counts
  const waitingCount = queue.filter((t: any) => ['booked', 'arrived'].includes(t.status)).length;
  const processingCount = queue.filter((t: any) => ['verification', 'quality_check'].includes(t.status)).length;
  const completedCount = queue.filter((t: any) => ['procured', 'payment_processing', 'payment_completed'].includes(t.status)).length;

  const filteredQueue = queue.filter((t: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.token_number?.toLowerCase().includes(q) ||
      t.farmer_name?.toLowerCase().includes(q) ||
      t.mobile?.includes(q) ||
      t.crop?.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      booked: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Booked' },
      arrived: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Arrived' },
      verification: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Verifying' },
      quality_check: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Quality Check' },
      accepted: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Accepted' },
      procured: { bg: 'bg-teal-100', text: 'text-teal-800', label: 'Procured' },
      payment_processing: { bg: 'bg-cyan-100', text: 'text-cyan-800', label: 'Paying' },
      payment_completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Paid' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
    };
    const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header with Center and Date Selector */}
      <div className="bg-white rounded-xl shadow-sm border border-primary-100 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span>🏢</span> Procurement Center Operator Dashboard
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Live Mandi Queue, Stage Progression & Physical Counter Terminal
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-amber-50/90 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0">
                {currentCenter?.center_code?.substring(0, 3) || 'MND'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-stone-900">{currentCenter?.center_name || 'Procurement Mandi'}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200 text-amber-900 font-bold">
                    {currentCenter?.center_code}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                  <span className="text-amber-800 font-semibold">{currentCenter?.classification || 'APMC Yard'}</span>
                  <span>•</span>
                  <span>{currentCenter?.district}, {currentCenter?.state}</span>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Procurement Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <button
              onClick={() => navigate('/center/login')}
              className="mt-5 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors border border-amber-300 shadow-sm"
              title="Switch to another classified Mandi"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Switch Mandi</span>
            </button>

            <button
              onClick={() => refetchQueue()}
              className="mt-5 p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
              title="Refresh queue"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Center Live KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-primary-50 rounded-lg p-4 border border-primary-100">
            <div className="text-xs font-medium text-primary-700 uppercase">Today's Bookings</div>
            <div className="text-2xl font-bold text-primary-900 mt-1">{queue.length}</div>
            <div className="text-xs text-primary-600 mt-0.5">Capacity: {selectedCenter?.capacity_per_hour ? selectedCenter.capacity_per_hour * 4 : 100} / day</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
            <div className="text-xs font-medium text-amber-700 uppercase">Waiting in Queue</div>
            <div className="text-2xl font-bold text-amber-900 mt-1">{waitingCount}</div>
            <div className="text-xs text-amber-600 mt-0.5">Active counters: {selectedCenter?.counters || 2}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <div className="text-xs font-medium text-purple-700 uppercase">Verification & QC</div>
            <div className="text-2xl font-bold text-purple-900 mt-1">{processingCount}</div>
            <div className="text-xs text-purple-600 mt-0.5">Avg: {selectedCenter?.avg_processing_min || 7} min/lot</div>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100">
            <div className="text-xs font-medium text-emerald-700 uppercase">Procured / Paid</div>
            <div className="text-2xl font-bold text-emerald-900 mt-1">{completedCount}</div>
            <div className="text-xs text-emerald-600 mt-0.5">Completed today</div>
          </div>
        </div>
      </div>

      {/* Tabs & Quick Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'queue' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4" /> Live Queue ({queue.length})
          </button>
          <button
            onClick={() => setActiveTab('callbook')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'callbook' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <PhoneCall className="w-4 h-4" /> Assisted Booking
          </button>
          <button
            onClick={() => setActiveTab('announcement')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'announcement' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Megaphone className="w-4 h-4" /> Emergency Broadcast
          </button>
          <button
            onClick={() => {
              setActiveTab('messages');
              refetchMessages();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'messages' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4" /> SMS/WhatsApp Logs
          </button>
          <button
            onClick={() => {
              setActiveTab('data_engineering');
              refetchAnalytics();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'data_engineering' ? 'bg-white shadow text-primary-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-600" /> Data & Feature Engineering
          </button>
        </div>

        {/* Primary Call Next Button */}
        <button
          onClick={() => callNextMutation.mutate()}
          disabled={callNextMutation.isPending || waitingCount === 0}
          className="flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all transform active:scale-95"
        >
          <Volume2 className="w-5 h-5 animate-pulse" />
          <span>CALL NEXT FARMER</span>
        </button>
      </div>

      {/* Tab 1: Live Queue Table */}
      {activeTab === 'queue' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search token #, farmer name, mobile or crop..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="text-xs text-gray-500 font-medium">
              Showing {filteredQueue.length} of {queue.length} tokens
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Token #</th>
                  <th className="px-4 py-3 text-left">Farmer Details</th>
                  <th className="px-4 py-3 text-left">Crop & Quantity</th>
                  <th className="px-4 py-3 text-left">Slot Window</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Payment</th>
                  <th className="px-4 py-3 text-center">Stage Progression</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {filteredQueue.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                      {queueLoading ? 'Loading queue...' : 'No tokens booked for this center and date.'}
                    </td>
                  </tr>
                ) : (
                  filteredQueue.map((t: any) => (
                    <tr key={t.id} className="hover:bg-primary-50/40 transition-colors">
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-mono font-bold text-primary-900 bg-primary-100/70 px-2.5 py-1 rounded">
                          {t.token_number}
                        </span>
                        {t.booked_via === 'call' && (
                          <span className="ml-1.5 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold">
                            CALL
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-semibold text-gray-900">{t.farmer_name}</div>
                        <div className="text-xs text-gray-500">{t.mobile}</div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-medium text-gray-900">{t.crop}</div>
                        <div className="text-xs text-gray-500">
                          {t.quantity_received ? `${t.quantity_received} Qtl (Actual)` : `${t.quantity} Qtl (Est)`}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-gray-600 font-medium">
                        <Clock className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                        {t.slot_time}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {getStatusBadge(t.status)}
                        {t.reject_reason && (
                          <div className="text-[11px] text-red-600 mt-0.5 font-medium">{t.reject_reason}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded ${
                            t.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t.payment_status === 'paid' ? `₹${t.payment_amount || 'Paid'}` : 'Pending'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {t.status === 'booked' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ tokenId: t.id, status: 'arrived' })}
                              className="px-2.5 py-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded shadow-sm"
                            >
                              Arrived
                            </button>
                          )}
                          {t.status === 'arrived' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ tokenId: t.id, status: 'verification' })}
                              className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded shadow-sm"
                            >
                              Verify
                            </button>
                          )}
                          {t.status === 'verification' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ tokenId: t.id, status: 'quality_check' })}
                              className="px-2.5 py-1 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white rounded shadow-sm"
                            >
                              QC Check
                            </button>
                          )}
                          {t.status === 'quality_check' && (
                            <>
                              <button
                                onClick={() => {
                                  setAcceptModalToken(t);
                                  setReceivedQuantity(t.quantity || 40);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded shadow-sm flex items-center gap-1"
                              >
                                <CheckCircle className="w-3.5 h-3.5" /> Accept
                              </button>
                              <button
                                onClick={() => setRejectModalToken(t)}
                                className="px-2.5 py-1 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded shadow-sm flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" /> Reject
                              </button>
                            </>
                          )}
                          {t.status === 'accepted' && (
                            <button
                              onClick={() => updateStatusMutation.mutate({ tokenId: t.id, status: 'procured' })}
                              className="px-2.5 py-1 text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded shadow-sm"
                            >
                              Mark Procured
                            </button>
                          )}
                          {t.status === 'procured' && (
                            <button
                              onClick={() => {
                                setPaymentModalToken(t);
                                const qty = t.quantity_received || t.quantity || 40;
                                setPaymentAmount(calculateMspPayment(t.crop, qty));
                                setTransactionRef('PFMS' + Math.floor(10000000 + Math.random() * 90000000));
                              }}
                              className="px-2.5 py-1 text-xs font-semibold bg-green-600 hover:bg-green-700 text-white rounded shadow-sm"
                            >
                              Pay Farmer
                            </button>
                          )}
                          {['payment_completed', 'rejected'].includes(t.status) && (
                            <span className="text-xs text-gray-400 font-medium">Finished</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Assisted Call-in Booking */}
      {activeTab === 'callbook' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-purple-100 text-purple-700 rounded-lg">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Phone-Assisted / Walk-in Booking</h2>
              <p className="text-xs text-gray-500">Book token for offline, illiterate, or feature-phone farmers</p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!callSlotId) {
                toast.error('Please select an available slot');
                return;
              }
              callBookMutation.mutate({
                name: callName,
                mobile: callMobile,
                location: callLocation,
                crop: callCrop,
                quantity: parseFloat(callQty),
                center_id: selectedCenterId,
                slot_id: parseInt(callSlotId),
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Farmer Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Gurdeep Singh"
                  value={callName}
                  onChange={(e) => setCallName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Mobile Number (10 digits) *</label>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="e.g. 9812345678"
                  value={callMobile}
                  onChange={(e) => setCallMobile(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Village / Location</label>
                <input
                  type="text"
                  placeholder="e.g. Khanna Rural"
                  value={callLocation}
                  onChange={(e) => setCallLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Crop</label>
                <select
                  value={callCrop}
                  onChange={(e) => setCallCrop(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="Wheat">Wheat (गेहूं)</option>
                  <option value="Paddy">Paddy / Rice (धान)</option>
                  <option value="Mustard">Mustard (सरसों)</option>
                  <option value="Chana">Chana (चना)</option>
                  <option value="Cotton">Cotton (कपास)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estimated Quantity (Qtl)</label>
                <input
                  type="number"
                  value={callQty}
                  onChange={(e) => setCallQty(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Select Time Window *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1">
                {availableSlots.map((s: any) => (
                  <button
                    key={s.id}
                    type="button"
                    disabled={s.full}
                    onClick={() => setCallSlotId(s.id.toString())}
                    className={`p-3 text-left border rounded-lg transition-all ${
                      callSlotId === s.id.toString()
                        ? 'border-primary-600 bg-primary-50 text-primary-900 font-bold ring-2 ring-primary-500'
                        : s.full
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">{s.start_time} - {s.end_time}</div>
                    <div className="text-[11px] text-gray-500 mt-1">{s.remaining} slots left</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={callBookMutation.isPending}
              className="w-full py-3 bg-primary-700 hover:bg-primary-800 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow"
            >
              {callBookMutation.isPending ? 'Generating Token...' : 'Confirm Call-in Booking & Send SMS'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 3: Emergency Broadcast Announcement */}
      {activeTab === 'announcement' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-amber-100 text-amber-700 rounded-lg">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Emergency Center Broadcast</h2>
              <p className="text-xs text-gray-500">
                Immediately pushes notification + simulated SMS and WhatsApp to all active waiting farmers for {selectedCenter?.center_name || selectedCenter?.name}
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              announcementMutation.mutate({
                reason: annReason,
                message: annMessage,
                new_date: annNewDate || undefined,
                new_time: annNewTime || undefined,
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Announcement</label>
              <select
                value={annReason}
                onChange={(e) => setAnnReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="Heavy Rain Alert">🌧️ Heavy Rain / Weather Delay</option>
                <option value="Weighbridge Calibration">⚖️ Weighbridge Maintenance / Calibration</option>
                <option value="Power Outage">⚡ Grid Power Failure</option>
                <option value="Storage Capacity Limit">🏢 Depot Storage Reorganization</option>
                <option value="Schedule Reschedule">🕒 Operating Hours Adjustment</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Broadcast Message Content *</label>
              <textarea
                required
                rows={3}
                value={annMessage}
                onChange={(e) => setAnnMessage(e.target.value)}
                placeholder="Details of the schedule update or emergency instruction..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Rescheduled Date (Optional)</label>
                <input
                  type="date"
                  value={annNewDate}
                  onChange={(e) => setAnnNewDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">New Rescheduled Time (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. 14:00 onwards"
                  value={annNewTime}
                  onChange={(e) => setAnnNewTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={announcementMutation.isPending}
              className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors shadow flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {announcementMutation.isPending ? 'Broadcasting...' : `Broadcast to ${waitingCount} Waiting Farmers`}
            </button>
          </form>
        </div>
      )}

      {/* Tab 4: Simulated Message Logs */}
      {activeTab === 'messages' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary-600" />
              Simulated SMS & WhatsApp Delivery Audit Trail
            </h3>
            <button
              onClick={() => refetchMessages()}
              className="text-xs text-primary-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Logs
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-2.5 text-left">Time</th>
                  <th className="px-4 py-2.5 text-left">Channel</th>
                  <th className="px-4 py-2.5 text-left">Recipient</th>
                  <th className="px-4 py-2.5 text-left">Message</th>
                  <th className="px-4 py-2.5 text-left">Delivery Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {messages.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No communications logged yet.
                    </td>
                  </tr>
                ) : (
                  messages.map((m: any) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(m.createdAt || m.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded ${
                            m.channel === 'WhatsApp' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {m.channel}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs">{m.recipient}</td>
                      <td className="px-4 py-2 text-gray-800 max-w-md truncate">{m.message}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded">
                          ✓ {m.status}
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

      {/* Tab 5: Data & Feature Engineering */}
      {activeTab === 'data_engineering' && (
        <div className="space-y-6">
          {/* Live Pipeline Telemetry Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-800/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                    Live Data Pipeline • Ingestion & Assay Engine
                  </span>
                </div>
                <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-indigo-400" />
                  {analytics?.center_name || 'Procurement Center'} Telemetry
                </h2>
                <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl">
                  Real-time queueing stream, moisture assay distributions, gate-to-DBT stage conversion funnel, and local engineered feature matrix.
                </p>
              </div>

              {/* Mathematical Little's Law Operational Metric */}
              <div className="bg-slate-800/80 backdrop-blur-md rounded-xl p-4 border border-indigo-500/30 min-w-[280px]">
                <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                  <span className="flex items-center gap-1.5"><Gauge className="w-4 h-4 text-emerald-400" /> Little's Law Queue State</span>
                  <span className="font-mono bg-indigo-950 px-2 py-0.5 rounded text-[11px] text-indigo-300 border border-indigo-700/50">W = L / λ</span>
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  {analytics?.avg_service_time_mins || 21.4} <span className="text-xs font-normal text-indigo-300">mins / vehicle</span>
                </div>
                <div className="text-[11px] text-indigo-300/80 mt-1 flex justify-between">
                  <span>Queue (L): <strong>{analytics?.active_queue_count || queue.length} trucks</strong></span>
                  <span>Ingestion (λ): <strong>~{selectedCenter?.capacity_per_hour || 25}/hr</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-indigo-800/40">
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Total Ingested Tonnage</div>
                <div className="text-xl font-bold text-white mt-1">{analytics?.total_tonnage_qtl || 0} <span className="text-xs font-normal text-indigo-300">Qtl</span></div>
                <div className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Electronic Tare Certified
                </div>
              </div>
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">Weighbridge Velocity</div>
                <div className="text-xl font-bold text-white mt-1">2.85 <span className="text-xs font-normal text-indigo-300">trucks/hr</span></div>
                <div className="text-[11px] text-indigo-300 mt-0.5">Dual weighbridge active</div>
              </div>
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">QC Assay Clearance</div>
                <div className="text-xl font-bold text-emerald-400 mt-1">95.8%</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">Moisture &lt; 14.0% limit</div>
              </div>
              <div className="bg-indigo-950/40 rounded-xl p-3 border border-indigo-700/30">
                <div className="text-xs text-indigo-300 font-medium">PFMS Disbursal Latency</div>
                <div className="text-xl font-bold text-white mt-1">1.2 <span className="text-xs font-normal text-indigo-300">hours</span></div>
                <div className="text-[11px] text-emerald-400 mt-0.5">Near-instant direct credit</div>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Hourly Ingestion Velocity vs Capacity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    Hourly Ingestion Velocity vs Buffer Capacity
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Live booked demand vs arrived and processed vehicles (Little's Law λ vs μ)
                  </p>
                </div>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">
                  M/M/c Model
                </span>
              </div>

              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analytics?.hourly_throughput || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorArrived" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
                      </linearGradient>
                      <linearGradient id="colorProcessed" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="slot" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      formatter={(val: any, name: any) => [val, name === 'demand' ? 'Booked Demand' : name === 'arrived' ? 'Gate Arrivals' : name === 'processed' ? 'Processed' : 'Capacity']}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                    <Area type="monotone" dataKey="demand" name="Booked Demand" stroke="#6366f1" fillOpacity={1} fill="url(#colorDemand)" />
                    <Area type="monotone" dataKey="arrived" name="Gate Arrivals" stroke="#f59e0b" fillOpacity={1} fill="url(#colorArrived)" />
                    <Area type="monotone" dataKey="processed" name="Processed" stroke="#10b981" fillOpacity={1} fill="url(#colorProcessed)" />
                    <ReferenceLine y={selectedCenter?.capacity_per_hour || 25} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Hourly Cap', fill: '#ef4444', fontSize: 10 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Service Rate (μ): 18-20 trucks/hr
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> Buffer: 38.5% Headroom
                </span>
              </div>
            </div>

            {/* Chart 2: Quality Assay Moisture Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col">
              <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                <div>
                  <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-amber-600" />
                    Quality Assay (QC) Moisture Distribution
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Lot moisture variance across tested samples vs Bureau of Indian Standards (BIS) 14% limit
                  </p>
                </div>
                <span className="text-xs bg-amber-50 text-amber-700 font-bold px-2 py-0.5 rounded border border-amber-100">
                  BIS Standard
                </span>
              </div>

              <div className="h-72 w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics?.moisture_distribution || []} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="bin" tick={{ fontSize: 10, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      formatter={(val: any, _name: any, item: any) => [`${val} samples (${item.payload.pct}%)`, 'Sample Count']}
                    />
                    <Bar dataKey="count" name="Lot Samples" radius={[6, 6, 0, 0]}>
                      {(analytics?.moisture_distribution || []).map((entry: any, index: number) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.status === 'PASS' ? '#10b981' : entry.status === 'WARNING' ? '#f59e0b' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1 text-emerald-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Pass (&lt;13%)
                  </span>
                  <span className="flex items-center gap-1 text-amber-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded bg-amber-500"></span> Warning (13-14%)
                  </span>
                  <span className="flex items-center gap-1 text-rose-700 font-medium">
                    <span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Reject (&gt;14%)
                  </span>
                </div>
                <span className="text-gray-500 font-mono text-[11px]">N = 120 Assay Samples</span>
              </div>
            </div>
          </div>

          {/* Section 2: Gate-to-Settlement Pipeline Conversion Funnel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-600" />
                  Gate-to-Settlement Stage Conversion Funnel
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  End-to-end operational pipeline latency and conversion attrition through physical checkpoints
                </p>
              </div>
              <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-full border border-purple-100">
                Overall Efficiency: 84.0%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mt-6">
              {(analytics?.stage_funnel || []).map((stage: any, idx: number) => (
                <div key={idx} className="relative group bg-slate-50 hover:bg-indigo-50/50 rounded-xl p-3.5 border border-gray-200 transition-all">
                  <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{stage.stage}</div>
                  <div className="text-xl font-black text-gray-900 mt-2">{stage.count}</div>
                  <div className="text-xs font-semibold text-emerald-600 mt-0.5">{stage.conversion_pct}% conversion</div>
                  <div className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-indigo-500" />
                    +{stage.latency_mins}m avg lag
                  </div>
                  {idx < (analytics?.stage_funnel?.length || 7) - 1 && (
                    <div className="hidden md:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-gray-400">
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Real-Time Engineered Feature Studio */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Real-Time Engineered Feature Studio
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Mathematical feature representations synthesized from live weighing scales, RFID gates, and QC digital assayers
                </p>
              </div>
              <span className="text-xs bg-amber-50 text-amber-700 font-mono font-bold px-2.5 py-1 rounded border border-amber-200">
                5 Computed Features Live
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
              {(analytics?.engineered_features || []).map((feat: any, idx: number) => (
                <div key={idx} className="bg-slate-50/80 rounded-xl p-4 border border-gray-200 hover:border-indigo-300 transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                        {feat.feature_id}
                      </span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        feat.status === 'OPTIMAL' || feat.status === 'HIGH'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {feat.badge}
                      </span>
                    </div>

                    <h4 className="font-bold text-gray-900 text-sm mb-1">{feat.name}</h4>
                    
                    {/* Mathematical Formula */}
                    <div className="bg-slate-900 rounded-lg p-2 font-mono text-[11px] text-indigo-300 my-2 overflow-x-auto border border-slate-800">
                      <code>{feat.formula}</code>
                    </div>

                    <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                      {feat.interpretation}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase font-semibold text-gray-400">Current Value</div>
                      <div className="text-lg font-black text-gray-900">{feat.value}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-gray-400">Threshold</div>
                      <div className="text-xs font-mono font-semibold text-gray-600">{feat.threshold}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Accept Lot Modal */}
      {acceptModalToken && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Accept Lot - Token {acceptModalToken.token_number}</h3>
            <p className="text-xs text-gray-600">
              Farmer: <strong>{acceptModalToken.farmer_name}</strong> | Crop: <strong>{acceptModalToken.crop}</strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Final Net Weight Received (Quintals) *
              </label>
              <input
                type="number"
                step="0.1"
                value={receivedQuantity}
                onChange={(e) => setReceivedQuantity(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-primary-900"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setAcceptModalToken(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  updateStatusMutation.mutate({
                    tokenId: acceptModalToken.id,
                    status: 'accepted',
                    quantityReceived: receivedQuantity,
                  })
                }
                className="px-4 py-2 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
              >
                Confirm Quality Passed & Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Lot Modal */}
      {rejectModalToken && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-red-900">Reject Lot - Token {rejectModalToken.token_number}</h3>
            <p className="text-xs text-gray-600">
              Farmer: <strong>{rejectModalToken.farmer_name}</strong> | Crop: <strong>{rejectModalToken.crop}</strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Reason for Rejection *</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="Moisture content exceeds 14% threshold">Moisture content exceeds 14% threshold</option>
                <option value="Foreign matter / impurities above permitted limit">Foreign matter / impurities above permitted limit</option>
                <option value="Infestation / discolored grains">Infestation / discolored grains</option>
                <option value="Farmer identity mismatch / Land record anomaly">Farmer identity mismatch / Land record anomaly</option>
                <option value="Other quality defect">Other quality defect</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setRejectModalToken(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  updateStatusMutation.mutate({
                    tokenId: rejectModalToken.id,
                    status: 'rejected',
                    rejectReason: rejectReason,
                  })
                }
                className="px-4 py-2 text-sm font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {paymentModalToken && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Procurement Payout - Token {paymentModalToken.token_number}</h3>
            <p className="text-xs text-gray-600">
              Farmer: <strong>{paymentModalToken.farmer_name}</strong> | Bank: <strong>{paymentModalToken.bank_account || 'Aadhaar DBT'}</strong>
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5 text-xs text-emerald-800 flex items-center justify-between">
              <div>
                <span className="font-semibold">Crop:</span> {paymentModalToken.crop || 'Wheat'} | <span className="font-semibold">Weight:</span> {paymentModalToken.quantity_received || paymentModalToken.quantity || 40} Quintals
              </div>
              <div className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded border border-emerald-300">
                MSP: ₹{getMspRate(paymentModalToken.crop).toLocaleString('en-IN')}/Qtl
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white font-medium"
                >
                  <option value="online">PFMS / DBT Online</option>
                  <option value="cash">Mandi Cash Counter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Total Amount (₹) *</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-green-700"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Transaction Ref / PFMS UTR</label>
              <input
                type="text"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono"
              />
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalToken(null)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  updatePaymentMutation.mutate({
                    tokenId: paymentModalToken.id,
                    method: paymentMethod,
                    status: 'paid',
                    amount: paymentAmount,
                    ref: transactionRef,
                  })
                }
                className="px-4 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg"
              >
                Complete Payment & Notify Farmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
