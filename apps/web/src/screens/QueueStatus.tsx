import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Clock,
  CheckCircle,
  AlertCircle,
  Users,
  Search,
  Volume2,
  RefreshCw,
  XCircle,
  ShieldCheck,
  Bell,
  MapPin,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { queueApi, bookingApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useQueueRealtime } from '../hooks/useQueueRealtime';
import toast from 'react-hot-toast';
import { speakText } from '../utils/i18n';

const PIPELINE_STAGES = [
  { key: 'booked', label: 'Booked', desc: 'Slot confirmed' },
  { key: 'arrived', label: 'Arrived', desc: 'Checked in at gate' },
  { key: 'verification', label: 'Verification', desc: 'Aadhaar / Land record check' },
  { key: 'quality_check', label: 'Quality Check', desc: 'Moisture & purity assay' },
  { key: 'accepted', label: 'Accepted', desc: 'Produce lot passed' },
  { key: 'procured', label: 'Procured', desc: 'Weighed & stored' },
  { key: 'payment_processing', label: 'Processing', desc: 'PFMS DBT transfer' },
  { key: 'payment_completed', label: 'Paid', desc: 'Credited to bank' },
];

export default function QueueStatus() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { farmer } = useAuth();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeLookupValue, setActiveLookupValue] = useState<string>('');

  // Prepopulate lookup value with farmer's mobile or active token
  useEffect(() => {
    if (farmer?.mobile && !activeLookupValue) {
      setActiveLookupValue(farmer.mobile);
      setSearchQuery(farmer.mobile);
    }
  }, [farmer, activeLookupValue]);

  // Fetch token details via React Query
  const { data: serverTokenData = null, isLoading, refetch } = useQuery({
    queryKey: ['tokenQueueDetails', activeLookupValue],
    queryFn: async () => {
      if (!activeLookupValue) return null;
      try {
        const res = await queueApi.lookupToken(activeLookupValue);
        return res.data;
      } catch (err) {
        return null;
      }
    },
    refetchInterval: 12000,
  });

  const handleTokenCalled = useCallback((event: any) => {
    toast.success(`📢 Your token ${event.tokenNumber || ''} is now being called to counter!`, { duration: 8000 });
    speakText(`Attention, token number ${event.tokenNumber || ''}, please proceed to counter.`);
  }, []);

  const handleQueueUpdated = useCallback(() => {
    toast('Live queue updated', { icon: '🔄' });
  }, []);

  // Dedicated realtime hook with room-scoping, offline-first caching & rolling wait recalculations
  const {
    tokenData,
    farmers_ahead,
    estimated_wait_min,
    current_token,
    avg_processing_min,
    status: currentStatus,
    realtimeConnected,
    isStale,
    lastUpdatedClock,
    timeAgoText,
    hasCachedData,
  } = useQueueRealtime({
    activeLookupValue,
    serverTokenData,
    onTokenCalled: handleTokenCalled,
    onQueueUpdated: handleQueueUpdated,
  });

  // Running late mutation
  const runningLateMutation = useMutation({
    mutationFn: (id: number) => bookingApi.runningLate(id),
    onSuccess: (res: any) => {
      toast.success(res.data.message || 'Slot extended by 15 minutes');
      queryClient.invalidateQueries({ queryKey: ['tokenQueueDetails'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Could not extend slot');
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setActiveLookupValue(searchQuery.trim());
  };

  const getStageIndex = (status: string) => {
    if (status === 'rejected') return -1;
    return PIPELINE_STAGES.findIndex((s) => s.key === status);
  };

  const currentStageIndex = tokenData ? getStageIndex(currentStatus || tokenData.status) : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Search / Lookup Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearch} className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
            <div className="relative flex-1">
              <label htmlFor="queue-token-lookup" className="sr-only">
                Search token or mobile number
              </label>
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <input
                id="queue-token-lookup"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search token (e.g. PUN0011001) or mobile..."
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-primary-700 hover:bg-primary-800 text-white text-xs font-bold rounded-lg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 focus-visible:ring-offset-1"
            >
              Lookup
            </button>
          </form>

          {/* Real-time Status Indicator with Offline-First Staleness */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  realtimeConnected && !isStale ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                }`}
              />
              <span className={realtimeConnected && !isStale ? 'text-emerald-700' : 'text-amber-700'}>
                {realtimeConnected && !isStale ? (
                  <>
                    Live Socket Connected{' '}
                    <span className="text-[10px] font-normal text-gray-500">({timeAgoText})</span>
                  </>
                ) : (
                  <>Offline • Last updated {lastUpdatedClock}</>
                )}
              </span>
            </div>
            <button
              onClick={() => refetch()}
              className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              title="Refresh queue"
              aria-label="Refresh queue"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Offline Caching Staleness Notice Banner */}
      {isStale && tokenData && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between text-xs text-amber-900 shadow-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Showing offline cached queue state from <strong>{lastUpdatedClock}</strong>. Live queue sync will resume on reconnect.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded font-mono text-[10px] font-bold uppercase tracking-wider">
            Cached State
          </span>
        </div>
      )}

      {isLoading && !tokenData ? (
        <div className="bg-white rounded-lg p-12 text-center text-gray-500 shadow-sm border border-gray-200">
          <Truck className="w-12 h-12 text-primary-300 mx-auto animate-bounce mb-3" />
          <p className="font-semibold text-gray-700">Fetching live queue telemetry...</p>
        </div>
      ) : !tokenData ? (
        <div className="bg-white rounded-lg p-12 text-center shadow-sm border border-gray-200">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-gray-900">No Active Booking Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 mb-5">
            Could not find an active procurement token for "{activeLookupValue}". Enter your registered mobile number or token ID.
          </p>
          <button
            onClick={() => navigate('/farmer/booking')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            Book a Procurement Slot
          </button>
        </div>
      ) : (
        <>
          {/* Main Token Banner */}
          <div className="bg-gov-navy text-white rounded-lg shadow-sm p-6 sm:p-8 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
                    Official Token
                  </span>
                  <span className="text-xs text-primary-200">
                    {tokenData.date} ({tokenData.start_time} - {tokenData.end_time})
                  </span>
                </div>

                <div className="text-4xl sm:text-5xl font-black font-mono tracking-wider text-white mt-2">
                  {tokenData.token_number}
                </div>

                <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-primary-100">
                  <div className="flex items-center gap-1 font-semibold">
                    <MapPin className="w-4 h-4 text-emerald-300" />
                    <span>{tokenData.center_name}</span>
                  </div>
                  <div>
                    Farmer: <strong>{tokenData.farmer_name}</strong> ({tokenData.mobile})
                  </div>
                  <div>
                    Produce: <strong>{tokenData.crop}</strong> ({tokenData.quantity} Qtl)
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() =>
                    speakText(
                      `Token ${tokenData.token_number}, ${tokenData.farmer_name}. Estimated wait is ${estimated_wait_min} minutes. ${farmers_ahead} farmers ahead.`
                    )
                  }
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Volume2 className="w-4 h-4 text-emerald-300" />
                  <span>Voice Readout</span>
                </button>

                <button
                  onClick={() => runningLateMutation.mutate(tokenData.id)}
                  disabled={tokenData.running_late_used || runningLateMutation.isPending}
                  className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:bg-gray-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  title="Extend slot arrival window by 15 minutes"
                >
                  <Clock className="w-4 h-4" />
                  <span>{tokenData.running_late_used ? 'Extension Used (+15m)' : 'Running Late (+15m)'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Rejection Alert Banner (If applicable) */}
          {(currentStatus === 'rejected' || tokenData.status === 'rejected') && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-900">Lot Rejected at Quality Assay</h4>
                <p className="text-xs text-red-700 mt-0.5">
                  Reason: <strong>{tokenData.reject_reason || 'Quality standard threshold not met'}</strong>
                </p>
                <p className="text-xs text-red-600 mt-1">
                  You may re-clean or re-dry your produce and book a new slot once ready.
                </p>
              </div>
            </div>
          )}

          {/* Little's Law Real-Time Queue Telemetry Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
                <span>Now Serving</span>
                <Volume2 className="w-4 h-4 text-primary-600" />
              </div>
              <div className="text-2xl font-black text-gray-900 mt-1 font-mono">
                {current_token || '—'}
              </div>
              <div className="text-[11px] text-gray-500 mt-0.5">At counter 1 & 2</div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
                <span>Farmers Ahead</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-900 mt-1">
                {farmers_ahead}
              </div>
              <div className="text-[11px] text-blue-600 mt-0.5">
                {farmers_ahead === 0 ? 'Your turn next!' : `${farmers_ahead} ahead of you`}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
                <span>Estimated Wait</span>
                <Clock className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-900 mt-1">
                ≈{estimated_wait_min} <span className="text-xs font-semibold text-gray-600">min</span>
              </div>
              <div className="text-[11px] text-amber-700 mt-0.5">
                {timeAgoText}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
                <span>Counter Speed</span>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-900 mt-1">
                {avg_processing_min} <span className="text-xs font-semibold text-gray-600">min/lot</span>
              </div>
              <div className="text-[11px] text-emerald-700 mt-0.5">Rolling avg of last 20 lots</div>
            </div>
          </div>

          {/* ── Explainable Wait Time — "Why this wait?" ── */}
          {tokenData.wait_explanation && tokenData.wait_explanation.status === 'waiting' && (
            <div className="bg-blue-950 border border-blue-700/60 rounded-xl p-5 shadow-inner">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span className="text-blue-300">🧮</span>
                    Why is the wait <span className="text-amber-300">≈{estimated_wait_min} min</span>?
                  </h3>
                  <p className="text-[11px] text-blue-200 mt-0.5">
                    Little's Law — real arithmetic on your actual queue, updated live.
                  </p>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-900/60 text-blue-300 border border-blue-700/40 whitespace-nowrap">
                  {tokenData.wait_explanation.little_law}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                {[
                  {
                    label: 'Farmers Ahead',
                    value: tokenData.wait_explanation.farmers_ahead,
                    unit: 'in queue',
                    color: 'blue',
                  },
                  {
                    label: 'Counters Open',
                    value: tokenData.wait_explanation.counters_open,
                    unit: 'active now',
                    color: 'emerald',
                  },
                  {
                    label: 'Avg per Farmer',
                    value: tokenData.wait_explanation.avg_min_per_farmer,
                    unit: 'min / lot',
                    color: 'amber',
                  },
                  {
                    label: 'Your Wait',
                    value: `≈${estimated_wait_min}`,
                    unit: 'minutes',
                    color: 'rose',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`bg-blue-900/40 border border-blue-700/30 rounded-lg p-3 text-center`}
                  >
                    <div className="text-[10px] text-blue-300 font-semibold uppercase tracking-wider mb-1">
                      {item.label}
                    </div>
                    <div className="text-xl font-black text-white font-mono">{item.value}</div>
                    <div className="text-[10px] text-blue-400 mt-0.5">{item.unit}</div>
                  </div>
                ))}
              </div>

              {/* Formula box */}
              <div className="bg-black/30 rounded-lg p-3 font-mono text-xs border border-blue-800/40">
                <div className="text-blue-300 text-[10px] uppercase tracking-wider mb-1 font-sans font-semibold">
                  Live Formula
                </div>
                <span className="text-amber-300 font-bold text-sm">
                  {tokenData.wait_explanation.formula}
                </span>
              </div>

              {/* Tip (only shown if wait > 30 min) */}
              {tokenData.wait_explanation.tip && (
                <div className="mt-3 text-[11px] text-blue-200 bg-blue-900/30 rounded-lg px-3 py-2 border border-blue-700/20">
                  💡 {tokenData.wait_explanation.tip}
                </div>
              )}
            </div>
          )}

          {/* Completion / Next notice */}
          {tokenData.wait_explanation?.status === 'next' && (
            <div className="bg-emerald-950 border border-emerald-600/40 rounded-xl p-4 flex items-center gap-3">
              <span className="text-2xl">🔔</span>
              <div>
                <div className="text-sm font-black text-emerald-300">You are next in line!</div>
                <div className="text-xs text-emerald-200 mt-0.5">Please proceed to the counter. Staff will call your token shortly.</div>
              </div>
            </div>
          )}

          {/* 8-Stage Visual Procurement Flow Tracker */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">

            <h3 className="text-base font-bold text-gray-900">Procurement & Payment Lifecycle</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-2">
              {PIPELINE_STAGES.map((stage, idx) => {
                const isPassed = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;
                return (
                  <div
                    key={stage.key}
                    className={`p-3 rounded-lg border text-center relative transition-all ${
                      isCurrent
                        ? 'bg-primary-50 border-primary-600 ring-2 ring-primary-500 shadow-sm'
                        : isPassed
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                        : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 text-xs font-bold">
                      {isPassed ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : isCurrent ? (
                        <span className="w-3 h-3 bg-primary-600 rounded-full animate-ping" />
                      ) : (
                        <span>{idx + 1}</span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-gray-900">{stage.label}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{stage.desc}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Grid: Payment Summary & In-App Notification Feed */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Payment Snapshot */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center justify-between">
                <span>PFMS / Direct Benefit Transfer (DBT)</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded font-semibold inline-flex items-center gap-1 ${
                    tokenData.payment_status === 'paid'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tokenData.payment_status === 'paid' ? (
                    <>
                      <CheckCircle className="w-3 h-3 text-green-700" />
                      <span>CREDITED</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-3 h-3 text-gray-500" />
                      <span>PENDING</span>
                    </>
                  )}
                </span>
              </h4>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Beneficiary:</span>
                  <span className="font-semibold text-gray-900">{tokenData.farmer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Produce Procured:</span>
                  <span className="font-semibold text-gray-900">
                    {tokenData.quantity_received || tokenData.quantity} Qtl {tokenData.crop}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Method:</span>
                  <span className="font-semibold text-gray-900 uppercase">
                    {tokenData.payment_method || 'Online DBT'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Transaction Reference:</span>
                  <span className="font-mono text-gray-900 font-bold">
                    {tokenData.transaction_ref || 'Initiates upon lot acceptance'}
                  </span>
                </div>
                <div className="border-t border-gray-100 pt-2 flex justify-between items-center">
                  <span className="text-sm font-bold text-gray-700">Total MSP Amount:</span>
                  <span className="text-base font-extrabold text-emerald-700">
                    {tokenData.payment_amount ? `₹${tokenData.payment_amount}` : 'Calculated at Weighment'}
                  </span>
                </div>
              </div>
            </div>

            {/* Notifications Feed */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h4 className="text-sm font-bold text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary-600" />
                Live Notification Feed
              </h4>

              <div className="space-y-2.5 max-h-52 overflow-y-auto pr-1">
                {!tokenData.notifications || tokenData.notifications.length === 0 ? (
                  <div className="text-xs text-gray-500 py-6 text-center">No notifications yet.</div>
                ) : (
                  tokenData.notifications.map((n: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg text-xs space-y-1 border border-gray-100">
                      <div className="text-gray-800 font-medium">{n.message}</div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-between">
                        <span>Channel: {n.channel || 'in-app'}</span>
                        <span>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
