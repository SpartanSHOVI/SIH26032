import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  IndianRupee,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  TicketCheck,
  Users,
  Volume2,
} from 'lucide-react';
import LanguageSelector from '../components/LanguageSelector';
import { publicTrackingApi } from '../services/api';
import { speakText } from '../utils/i18n';

const PIPELINE_STAGES = [
  { key: 'booked', label: 'Booked', description: 'Slot and token issued' },
  { key: 'arrived', label: 'Arrived', description: 'Gate check-in' },
  { key: 'verification', label: 'Verified', description: 'Identity and records' },
  { key: 'quality_check', label: 'Quality', description: 'Produce checked' },
  { key: 'accepted', label: 'Accepted', description: 'Lot approved' },
  { key: 'procured', label: 'Procured', description: 'Weighed and stored' },
  { key: 'payment_processing', label: 'Processing', description: 'PFMS / DBT initiated' },
  { key: 'payment_completed', label: 'Paid', description: 'Amount credited' },
];

function displayStatus(value?: string) {
  if (!value) return 'Awaiting update';
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatCurrency(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0
    ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
    : 'Calculated after weighment';
}

export default function PublicBookingTracking() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialValue = searchParams.get('value')?.trim() ?? '';
  const [searchValue, setSearchValue] = useState(initialValue);
  const [activeValue, setActiveValue] = useState(initialValue);

  const query = useQuery({
    queryKey: ['public-booking-tracking', activeValue],
    queryFn: async () => (await publicTrackingApi.lookup(activeValue)).data,
    enabled: Boolean(activeValue),
    retry: false,
    refetchInterval: 10000,
  });

  const token = query.data;
  const currentStageIndex = useMemo(
    () => PIPELINE_STAGES.findIndex((stage) => stage.key === token?.status),
    [token?.status],
  );

  const handleLookup = (event: React.FormEvent) => {
    event.preventDefault();
    const value = searchValue.trim();
    if (!value) return;
    setActiveValue(value);
    setSearchParams({ value });
  };

  return (
    <div className="min-h-screen gov-page text-slate-800">
      <header className="gov-header">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/login" className="flex items-center gap-3 text-white no-underline">
            <span className="gov-emblem"><span className="text-xl font-black">अ</span></span>
            <span>
              <span className="block text-lg font-bold leading-tight">AnnSetu</span>
              <span className="block text-[11px] text-blue-100">Public booking access</span>
            </span>
          </Link>
          <LanguageSelector theme="dark" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <Link to="/login" className="inline-flex items-center gap-1 text-xs font-semibold text-gov-blue hover:text-gov-navy mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to login and registration
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Track booking without login</h1>
            <p className="text-sm text-slate-600 mt-1 max-w-2xl">
              For slots booked by a procurement-centre assistant. Use the mobile number given during the call or the token number sent by SMS.
            </p>
          </div>
          {token && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live queue refreshes every 10 seconds
            </div>
          )}
        </div>

        <form onSubmit={handleLookup} className="gov-card p-4 sm:p-5">
          <label htmlFor="guest-booking-lookup" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Mobile number or token number
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                id="guest-booking-lookup"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="10-digit mobile or token number"
                autoComplete="tel"
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <button
              type="submit"
              disabled={!searchValue.trim() || query.isFetching}
              className="px-5 py-2.5 rounded-lg bg-gov-navy hover:bg-gov-blue text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {query.isFetching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <TicketCheck className="w-4 h-4" />}
              Find my booking
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" /> Personal and bank details remain hidden in this public view.
          </p>
        </form>

        {!activeValue ? (
          <div className="gov-card p-10 text-center">
            <TicketCheck className="w-12 h-12 text-emerald-700 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Your assisted booking is one step away</h2>
            <p className="text-sm text-slate-600 mt-1">No AnnSetu account, password, or registration is required.</p>
          </div>
        ) : query.isLoading ? (
          <div className="gov-card p-12 text-center">
            <RefreshCw className="w-9 h-9 text-gov-blue animate-spin mx-auto mb-3" />
            <p className="font-semibold text-slate-700">Finding your booking…</p>
          </div>
        ) : query.isError || !token ? (
          <div className="gov-card p-10 text-center border-amber-200">
            <AlertCircle className="w-11 h-11 text-amber-600 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-slate-900">Booking not found</h2>
            <p className="text-sm text-slate-600 mt-1 max-w-lg mx-auto">
              Check the mobile or token number and try again. If an assistant just created the booking, wait for the confirmation SMS or contact the procurement centre.
            </p>
          </div>
        ) : (
          <>
            <section className="bg-gov-navy text-white rounded-lg shadow-sm p-5 sm:p-7">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 font-bold uppercase tracking-wider">
                      {token.booked_via === 'call' ? 'Assistant booking' : 'Procurement booking'}
                    </span>
                    <span className="text-blue-100">{token.date} · {token.start_time}–{token.end_time}</span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black font-mono tracking-wide mt-2">{token.token_number}</div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 text-xs text-blue-100">
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-emerald-300" /> {token.center_name}, {token.center_location}</span>
                    <span>{token.farmer_name} · {token.mobile}</span>
                    <span>{token.crop} · {token.quantity} Qtl</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => speakText(`Token ${token.token_number}. ${token.farmers_ahead} farmers are ahead. Estimated waiting time is ${token.estimated_wait_min} minutes.`)}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Volume2 className="w-4 h-4 text-emerald-300" /> Hear status
                </button>
              </div>
            </section>

            {token.status === 'rejected' && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-red-900">Produce lot not accepted</h2>
                  <p className="text-xs text-red-700 mt-1">Reason: {token.reject_reason || 'Please contact the procurement centre for details.'}</p>
                </div>
              </div>
            )}

            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Now serving', value: token.current_token || '—', note: 'At the procurement centre', icon: Volume2, tone: 'text-gov-blue' },
                { label: 'Farmers ahead', value: token.farmers_ahead ?? 0, note: token.farmers_ahead === 0 ? 'Your turn is next' : 'Ahead in your queue', icon: Users, tone: 'text-blue-700' },
                { label: 'Estimated wait', value: `≈${token.estimated_wait_min ?? 0} min`, note: 'Updates with queue movement', icon: Clock, tone: 'text-amber-700' },
                { label: 'Current stage', value: displayStatus(token.status), note: `${token.counters ?? 1} counter(s) operating`, icon: CheckCircle2, tone: 'text-emerald-700' },
              ].map((metric) => (
                <div key={metric.label} className="gov-card p-4">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-bold text-slate-500">
                    {metric.label}<metric.icon className={`w-4 h-4 ${metric.tone}`} />
                  </div>
                  <div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 break-words">{metric.value}</div>
                  <div className="text-[11px] text-slate-500 mt-1">{metric.note}</div>
                </div>
              ))}
            </section>

            {token.wait_explanation?.message && token.status !== 'rejected' && (
              <section className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                <Clock className="w-5 h-5 text-gov-blue shrink-0" />
                <div>
                  <h2 className="text-sm font-bold text-gov-navy">Live queue guidance</h2>
                  <p className="text-xs text-blue-900 mt-1">{token.wait_explanation.message}</p>
                  {token.wait_explanation.formula && <p className="text-[11px] font-mono text-blue-700 mt-1">{token.wait_explanation.formula}</p>}
                </div>
              </section>
            )}

            <section className="gov-card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">End-to-end procurement journey</h2>
                  <p className="text-xs text-slate-500">From assistant booking to payment credit</p>
                </div>
                <button type="button" onClick={() => query.refetch()} className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200" aria-label="Refresh booking status">
                  <RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {PIPELINE_STAGES.map((stage, index) => {
                  const complete = currentStageIndex > index || token.status === 'payment_completed';
                  const current = currentStageIndex === index;
                  return (
                    <div key={stage.key} className={`rounded-lg border p-3 text-center ${current ? 'bg-blue-50 border-gov-blue ring-2 ring-blue-200' : complete ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="h-6 flex items-center justify-center">
                        {complete ? <CheckCircle2 className="w-5 h-5 text-emerald-700" /> : <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${current ? 'bg-gov-blue text-white' : 'bg-slate-200 text-slate-600'}`}>{index + 1}</span>}
                      </div>
                      <div className="text-xs font-bold text-slate-900 mt-1">{stage.label}</div>
                      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{stage.description}</div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-4">
              <div className="gov-card p-5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <IndianRupee className="w-4 h-4 text-emerald-700" /> Procurement and payment
                </h2>
                <dl className="text-xs space-y-3 mt-4">
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Produce received</dt><dd className="font-semibold text-right">{token.quantity_received || token.quantity} Qtl {token.crop}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Payment status</dt><dd className="font-bold text-right text-gov-navy">{displayStatus(token.payment_status || 'pending')}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Payment method</dt><dd className="font-semibold text-right">{token.booked_via === 'call' ? 'Cash at Mandi Counter' : (token.payment_method || 'PFMS / DBT')}</dd></div>
                  <div className="flex justify-between gap-4"><dt className="text-slate-500">Reference</dt><dd className="font-mono font-semibold text-right">{token.transaction_ref || 'Generated after transfer'}</dd></div>
                  <div className="flex justify-between gap-4 border-t border-slate-100 pt-3"><dt className="font-bold text-slate-700">MSP amount</dt><dd className="text-base font-black text-emerald-700 text-right">{formatCurrency(token.payment_amount)}</dd></div>
                </dl>
              </div>
              <div className="gov-card p-5 bg-emerald-50/40 border-emerald-200">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-700" /> Safe no-login access</h2>
                <ul className="mt-3 space-y-2 text-xs text-slate-700 list-disc pl-4">
                  <li>This page is read-only; it cannot change a booking or payment.</li>
                  <li>Your name, mobile number and payment reference are masked.</li>
                  <li>Aadhaar, bank account, IFSC and private messages are never displayed.</li>
                  <li>For changes or corrections, contact the procurement-centre assistant.</li>
                </ul>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
