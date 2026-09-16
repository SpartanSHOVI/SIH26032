import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Package, Truck, Scale, CheckCircle, AlertCircle, Clock, Calendar, XCircle, Volume2, Globe, FileText } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { procurementApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { useTranslation } from '../context/TranslationContext';
import { SUPPORTED_LANGUAGES, languageByCode, speakText } from '../utils/i18n';
import toast from 'react-hot-toast';
import { ProcurementSlipModal, ProcurementSlipData } from '../components/ProcurementSlipModal';

interface ProcurementLot {
  id: string;
  farmerId: string;
  centerId: string;
  centerName: string;
  lotStatus: 'GATE_ENTRY' | 'WEIGHING' | 'QC' | 'ACCEPTED' | 'REJECTED';
  grossWeight?: number;
  tareWeight?: number;
  netWeight?: number;
  moisturePercent?: number;
  qualityPass?: boolean;
  rejectReason?: string;
  staffId?: string;
  startedAt: string;
  completedAt?: string;
  bookingId: string;
  tokenNumber: number | string;
  bookingDate: string;
  timeWindowStart: string;
  timeWindowEnd: string;
  stagedStatusText: string;
  tamper_evident_seal?: string;
  tee_attestation?: {
    verified: boolean;
    algorithm: string;
    enclave_id: string;
    seal: string;
    timestamp: string;
  };
}

const statusConfig = {
  GATE_ENTRY: { label: 'Gate Entry', color: 'bg-blue-100 text-blue-800', icon: Truck, step: 1 },
  WEIGHING: { label: 'Weighing', color: 'bg-yellow-100 text-yellow-800', icon: Scale, step: 2 },
  QC: { label: 'Quality Check', color: 'bg-purple-100 text-purple-800', icon: AlertCircle, step: 3 },
  ACCEPTED: { label: 'Lot Accepted', color: 'bg-green-100 text-green-800', icon: CheckCircle, step: 4 },
  REJECTED: { label: 'Rejected', color: 'bg-red-100 text-red-800', icon: XCircle, step: 4 },
};

const steps = [
  { key: 'GATE_ENTRY', label: 'Gate Entry', icon: Truck },
  { key: 'WEIGHING', label: 'Weighing', icon: Scale },
  { key: 'QC', label: 'Quality Check', icon: AlertCircle },
  { key: 'ACCEPTED', label: 'Accepted', icon: CheckCircle },
];

export function getStagedStatusText(lot: {
  lotStatus: string;
  netWeight?: number;
  startedAt?: string;
  completedAt?: string;
  qualityPass?: boolean;
  rejectReason?: string;
}): string {
  const status = String(lot.lotStatus || '').toUpperCase();
  const formatTime = (ts?: string) => {
    if (!ts) return '10:00';
    try {
      return format(parseISO(ts), 'HH:mm');
    } catch {
      return ts.includes('T') ? ts.slice(11, 16) : '10:00';
    }
  };

  if (status === 'ACCEPTED' || status === 'PROCURED') {
    const time = formatTime(lot.completedAt || lot.startedAt);
    return `Lot Accepted at ${time}`;
  }
  if (status === 'REJECTED') {
    return `Lot Rejected: ${lot.rejectReason || 'Quality parameters not met'}`;
  }
  if (status === 'QC' || status === 'QUALITY_CHECK') {
    if (lot.qualityPass === false) {
      return `Quality Check failed: ${lot.rejectReason || 'Moisture limit exceeded'}`;
    }
    return 'Quality Check passed';
  }
  if (status === 'WEIGHING' || status === 'VERIFICATION') {
    const time = formatTime(lot.startedAt);
    if (lot.netWeight != null) {
      return `Weighing completed at ${time} — Net: ${lot.netWeight} quintals`;
    }
    return `Weighing completed at ${time}`;
  }
  return `Gate entry recorded at ${formatTime(lot.startedAt)}`;
}

export function normalizeProcurement(p: any): ProcurementLot {
  const s = String(p.status || p.lotStatus || '').toLowerCase();
  let lotStatus: ProcurementLot['lotStatus'] = 'GATE_ENTRY';
  if (s === 'arrived') lotStatus = 'GATE_ENTRY';
  else if (s === 'verification') lotStatus = 'WEIGHING';
  else if (s === 'quality_check') lotStatus = 'QC';
  else if (['accepted', 'procured', 'payment_processing', 'payment_completed'].includes(s)) lotStatus = 'ACCEPTED';
  else if (s === 'rejected') lotStatus = 'REJECTED';
  else if (s === 'booked') lotStatus = 'GATE_ENTRY';

  const dateStr = p.date
    ? String(p.date).slice(0, 10)
    : p.created_at
    ? String(p.created_at).slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  const net = p.netWeight != null
    ? Number(p.netWeight)
    : (p.net_weight != null
    ? Number(p.net_weight)
    : (p.quantity_received != null ? Number(p.quantity_received) : undefined));

  const gross = p.grossWeight != null
    ? Number(p.grossWeight)
    : (p.gross_weight != null ? Number(p.gross_weight) : undefined);

  const tare = p.tareWeight != null
    ? Number(p.tareWeight)
    : (p.tare_weight != null ? Number(p.tare_weight) : undefined);

  const moisture = p.moisturePercent != null
    ? Number(p.moisturePercent)
    : (p.moisture_percent != null ? Number(p.moisture_percent) : undefined);

  const qualityPass = p.qualityPass != null
    ? Boolean(p.qualityPass)
    : (p.quality_pass != null
    ? Boolean(p.quality_pass)
    : (lotStatus === 'ACCEPTED' ? true : lotStatus === 'REJECTED' ? false : undefined));

  const startedAt = p.created_at || p.started_at || p.startedAt || new Date().toISOString();
  const completedAt = p.completed_at || p.completedAt || p.procured_at || undefined;
  const rejectReason = p.rejectReason || p.reject_reason || undefined;

  const lot: ProcurementLot = {
    id: String(p.token_id || p.id),
    farmerId: String(p.farmer_id || p.farmerId || ''),
    centerId: String(p.center_id || p.centerId || ''),
    centerName: p.center_name || p.center || p.centerName || 'Procurement Center',
    lotStatus,
    grossWeight: gross,
    tareWeight: tare,
    netWeight: net,
    moisturePercent: moisture,
    qualityPass,
    rejectReason,
    startedAt,
    completedAt,
    bookingId: String(p.bookingId || p.booking_id || p.token_id || p.id),
    tokenNumber: p.token_number || p.tokenNumber || p.id,
    bookingDate: dateStr,
    timeWindowStart: p.start_time || p.timeWindowStart || '09:00',
    timeWindowEnd: p.end_time || p.timeWindowEnd || '10:00',
    stagedStatusText: '',
  };

  lot.stagedStatusText = getStagedStatusText(lot);
  return lot;
}

export default function ProcurementStatus() {
  const { farmer } = useAuth();
  const { language, setLanguage, translating, languageInfo } = useTranslation();

  const handleLangChange = (code: string) => {
    setLanguage(code);
    const selected = languageByCode(code);
    toast.success(`Language set to ${selected?.nativeName || code}`);
    speakText(`Procurement language set to ${selected?.name || code}`, selected.speechCode);
  };

  const { data: procurements = [], isLoading } = useQuery({
    queryKey: ['myProcurements', farmer?.id],
    queryFn: () =>
      procurementApi.getMyProcurement(farmer?.id).then((res: any) =>
        Array.isArray(res.data) ? res.data.map(normalizeProcurement) : []
      ),
    enabled: !!farmer?.id,
  });

  const activeProcurement = procurements.find((p: ProcurementLot) => 
    ['GATE_ENTRY', 'WEIGHING', 'QC'].includes(p.lotStatus)
  );

  const completedProcurements = procurements.filter((p: ProcurementLot) => 
    ['ACCEPTED', 'REJECTED'].includes(p.lotStatus)
  );

  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [selectedSlipData, setSelectedSlipData] = useState<ProcurementSlipData | null>(null);

  const handleOpenSlip = async (lot: ProcurementLot) => {
    try {
      const res = await procurementApi.getReceipt(String(lot.tokenNumber || lot.id));
      if (res?.data) {
        const d = res.data;
        setSelectedSlipData({
          organization: d.organization,
          slipType: d.slip_type,
          status: d.status,
          date: d.date,
          time: d.time,
          receiptNo: d.receipt_no,
          trader: d.trader,
          weighingNo: d.weighing_no,
          sellerName: d.seller_name || farmer?.name,
          sellerMobile: d.seller_mobile || farmer?.mobile,
          sellerVillage: d.seller_village,
          departmentGrade: d.department_grade,
          lotNo: d.lot_no,
          grainType: d.grain_type || farmer?.crop,
          buyer: d.buyer,
          subBuyer: d.sub_buyer,
          bags: d.bags,
          weightKg: d.weight_kg,
          ratePer100Kg: d.rate_per_100_kg,
          totalBags: d.total_bags,
          totalWeightKg: d.total_weight_kg,
          totalAmount: d.total_amount,
          netAmount: d.net_amount,
          deductionAmount: d.deduction_amount,
          bankAccount: d.bank_account || farmer?.bank_account,
          ifsc: d.ifsc || farmer?.ifsc,
          utrRef: d.utr_ref,
          moisturePercent: lot.moisturePercent,
        });
        setSlipModalOpen(true);
        return;
      }
    } catch {
      // fallback to client-side mapping
    }
    const weightKg = (lot.netWeight || 40) * 100;
    const rate = 2275;
    const total = (weightKg / 100) * rate;
    setSelectedSlipData({
      organization: `कृ.उ.बा.स. ${lot.centerName}, APMC Market Yard`,
      status: lot.lotStatus === 'ACCEPTED' ? 'PAID' : lot.lotStatus,
      sellerName: farmer?.name || 'अविनाश खुशाल पाटील',
      sellerMobile: farmer?.mobile || '9623037498',
      grainType: farmer?.crop || 'Wheat (गेहूं)',
      receiptNo: `W${lot.centerId.slice(0, 4)}-${lot.tokenNumber}`,
      lotNo: `W28244-${lot.tokenNumber}-A`,
      weightKg,
      ratePer100Kg: rate,
      totalAmount: total,
      netAmount: total,
      moisturePercent: lot.moisturePercent,
    });
    setSlipModalOpen(true);
  };

  const handleVoiceReadout = () => {
    if (activeProcurement) {
      const stageLabel = statusConfig[activeProcurement.lotStatus as keyof typeof statusConfig]?.label || activeProcurement.lotStatus;
      const text = `Procurement update for Token ${activeProcurement.tokenNumber} at ${activeProcurement.centerName}. Current stage: ${stageLabel}. ${activeProcurement.stagedStatusText}.`;
      speakText(text, languageInfo?.speechCode || 'hi-IN');
    } else if (completedProcurements.length > 0) {
      const latest = completedProcurements[0];
      const stageLabel = statusConfig[latest.lotStatus as keyof typeof statusConfig]?.label || latest.lotStatus;
      const text = `Latest procurement for Token ${latest.tokenNumber}. Status: ${stageLabel}. ${latest.stagedStatusText}. Net weight ${latest.netWeight || 0} quintals.`;
      speakText(text, languageInfo?.speechCode || 'hi-IN');
    } else {
      speakText('No active procurement records found. Complete a booking to start.', languageInfo?.speechCode || 'hi-IN');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header with Voice Readout & Language Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-xl border border-primary-100 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-primary-900">Procurement Status</h1>
          <p className="text-primary-600">Track your crop through each stage</p>
        </div>

        {/* Voice Readout & Quick Language Selector */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleVoiceReadout}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            title="Listen to procurement voice readout"
          >
            <Volume2 className="w-4 h-4 text-emerald-200" />
            <span>Voice Status Readout</span>
          </button>

          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
            <Globe className="w-3.5 h-3.5 text-primary-700" />
            <select
              value={language}
              onChange={(e) => handleLangChange(e.target.value)}
              aria-label="Select Language for Procurement Status"
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.nativeName} ({l.name})
                </option>
              ))}
            </select>
            {translating && <span className="text-[10px] text-primary-600 animate-pulse font-medium">Translating...</span>}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
          </CardContent>
        </Card>
      ) : activeProcurement ? (
        <ActiveProcurementView
          procurement={activeProcurement}
          allProcurements={procurements}
          onOpenSlip={handleOpenSlip}
        />
      ) : completedProcurements.length > 0 ? (
        <CompletedProcurementsView
          procurements={completedProcurements}
          onOpenSlip={handleOpenSlip}
        />
      ) : (
        <EmptyProcurementView />
      )}

      <ProcurementSlipModal
        isOpen={slipModalOpen}
        onClose={() => setSlipModalOpen(false)}
        data={selectedSlipData || {}}
      />
    </div>
  );
}

function ActiveProcurementView({
  procurement,
  allProcurements,
  onOpenSlip,
}: {
  procurement: ProcurementLot;
  allProcurements: ProcurementLot[];
  onOpenSlip: (lot: ProcurementLot) => void;
}) {
  const currentStep = steps.findIndex(s => s.key === procurement.lotStatus);
  const config = statusConfig[procurement.lotStatus as keyof typeof statusConfig];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Active Procurement
          </CardTitle>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const speech = `Current stage: ${config.label}. ${procurement.stagedStatusText}`;
                speakText(speech);
              }}
              className="p-1.5 hover:bg-slate-100 rounded-md text-slate-600 hover:text-emerald-700 transition-colors"
              title="Listen to stage audio readout"
              aria-label="Listen to stage audio readout"
            >
              <Volume2 className="w-4 h-4 text-emerald-600" />
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
              {config.label}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              {steps.map((step, index) => (
                <div key={step.key} className="flex flex-col items-center relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    index < currentStep
                      ? 'bg-primary-600 text-white'
                      : index === currentStep
                      ? 'bg-primary-600 text-white ring-4 ring-primary-200'
                      : 'bg-primary-100 text-primary-400'
                  }`}>
                    <step.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs mt-1 font-medium ${
                    index <= currentStep ? 'text-primary-900' : 'text-primary-400'
                  }`}>
                    {step.label}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`absolute top-5 left-full w-full h-1 ${index < currentStep ? 'bg-primary-600' : 'bg-primary-100'}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-600">Center</p>
              <p className="font-medium text-primary-900">{procurement.centerName}</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-600">Token Number</p>
              <p className="font-medium text-primary-900">#{procurement.tokenNumber}</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-600">Booking Date</p>
              <p className="font-medium text-primary-900">{format(parseISO(procurement.bookingDate), 'dd MMM yyyy')}</p>
            </div>
            <div className="p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-600">Time Window</p>
              <p className="font-medium text-primary-900">
                {format(parseISO(`2000-01-01T${procurement.timeWindowStart}`), 'HH:mm')} -{' '}
                {format(parseISO(`2000-01-01T${procurement.timeWindowEnd}`), 'HH:mm')}
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-white border border-primary-200 rounded-lg">
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 font-semibold text-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{procurement.stagedStatusText}</span>
              </div>
              <span className="text-xs text-emerald-700 font-mono">Stage Telemetry</span>
            </div>

            <h3 className="font-medium text-primary-900 mb-3 flex items-center gap-2">
              {config.icon && <config.icon className="w-5 h-5 text-primary-600" />}
              Current Stage: {config.label}
            </h3>
            
            {procurement.lotStatus === 'GATE_ENTRY' && (
              <div className="space-y-3 text-primary-600">
                <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-green-600" /> Farmer checked in at gate</p>
                <p className="flex items-center gap-2"><Clock className="w-4 h-4" /> Checked in at: {format(parseISO(procurement.startedAt), 'HH:mm')}</p>
                <p className="text-sm text-primary-500">Next: Proceed to weighing station</p>
              </div>
            )}

            {procurement.lotStatus === 'WEIGHING' && (
              <div className="space-y-3">
                <p className="font-semibold text-primary-900 text-sm">
                  {getStagedStatusText({ ...procurement, lotStatus: 'WEIGHING' })}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Gross Weight</p>
                    <p className="font-bold text-primary-900 text-xl">{procurement.grossWeight != null ? `${procurement.grossWeight} qtl` : '-'}</p>
                  </div>
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Tare Weight</p>
                    <p className="font-bold text-primary-900 text-xl">{procurement.tareWeight != null ? `${procurement.tareWeight} qtl` : '-'}</p>
                  </div>
                  <div className="p-3 bg-primary-50 rounded-lg col-span-2">
                    <p className="text-sm text-primary-600">Net Weight</p>
                    <p className="font-bold text-primary-900 text-2xl text-green-700">{procurement.netWeight != null ? `${procurement.netWeight} qtl` : '-'}</p>
                  </div>
                </div>
                <p className="text-sm text-primary-500">Next: Quality check (moisture, foreign matter)</p>
              </div>
            )}

            {procurement.lotStatus === 'QC' && (
              <div className="space-y-3">
                <p className={`font-semibold text-sm ${procurement.qualityPass ? 'text-green-700' : 'text-red-700'}`}>
                  {getStagedStatusText({ ...procurement, lotStatus: 'QC' })}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Moisture %</p>
                    <p className="font-bold text-primary-900 text-xl">{procurement.moisturePercent != null ? `${procurement.moisturePercent}%` : '-'}</p>
                  </div>
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Quality</p>
                    <p className={`font-bold text-xl ${procurement.qualityPass ? 'text-green-700' : 'text-red-700'}`}>
                      {procurement.qualityPass ? 'PASS' : 'FAIL'}
                    </p>
                  </div>
                </div>
                <p className="text-sm text-primary-500">
                  {procurement.qualityPass ? 'Next: Lot acceptance and payment initiation' : 'Lot may be rejected or require re-processing'}
                </p>
              </div>
            )}

            {procurement.lotStatus === 'ACCEPTED' && (
              <div className="space-y-3 text-green-700">
                <p className="font-bold text-base text-green-800">
                  {getStagedStatusText({ ...procurement, lotStatus: 'ACCEPTED' })}
                </p>
                <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Lot accepted for procurement</p>
                <p className="flex items-center gap-2"><Scale className="w-4 h-4" /> Net weight: {procurement.netWeight != null ? `${procurement.netWeight} quintals` : '-'}</p>
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Accepted at: {format(parseISO(procurement.completedAt || procurement.startedAt), 'HH:mm')}</p>
                <p className="text-sm text-primary-500">Payment will be initiated via PFMS/DBT</p>
                <div className="pt-2">
                  <button
                    onClick={() => onOpenSlip(procurement)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-emerald-200" />
                    <span>🧾 अधिकृत शेतकरी पावती (View & Print Official Slip)</span>
                  </button>
                </div>
              </div>
            )}

            {procurement.lotStatus === 'REJECTED' && (
              <div className="space-y-3 text-red-700">
                <p className="font-bold text-base text-red-800">
                  {getStagedStatusText({ ...procurement, lotStatus: 'REJECTED' })}
                </p>
                <p className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Lot rejected</p>
                <p className="text-sm text-primary-500">Reason: {procurement.rejectReason || 'Quality parameters not met (moisture/f.m.)'}</p>
                <p className="text-sm text-primary-500">You may re-process and re-book</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-600" />
            Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allProcurements
              .filter(p => p.bookingId === procurement.bookingId)
              .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
              .map((lot) => {
                const StatusIcon = statusConfig[lot.lotStatus as keyof typeof statusConfig]?.icon;

                return (
                  <div key={lot.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    ['ACCEPTED', 'REJECTED'].includes(lot.lotStatus) ? 'bg-primary-100' : 'bg-primary-50'
                  }`}>
                    {StatusIcon && (
                      <StatusIcon className={`w-5 h-5 ${
                        ['ACCEPTED', 'REJECTED'].includes(lot.lotStatus) ? 'text-primary-600' : 'text-primary-400'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${['ACCEPTED', 'REJECTED'].includes(lot.lotStatus) ? 'text-primary-900' : 'text-primary-500'}`}>
                      {statusConfig[lot.lotStatus as keyof typeof statusConfig]?.label}
                    </p>
                    <p className="text-sm text-primary-500">
                      {format(parseISO(lot.startedAt), 'dd MMM HH:mm')} - {lot.completedAt ? format(parseISO(lot.completedAt), 'HH:mm') : 'In progress'}
                    </p>
                    {lot.netWeight && (
                      <p className="text-sm text-primary-600">Net: {lot.netWeight} qtl</p>
                    )}
                    {lot.moisturePercent !== undefined && (
                      <p className="text-sm text-primary-600">Moisture: {lot.moisturePercent}%</p>
                    )}
                  </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CompletedProcurementsView({
  procurements,
  onOpenSlip,
}: {
  procurements: ProcurementLot[];
  onOpenSlip: (lot: ProcurementLot) => void;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            Procurement History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {procurements.map((procurement) => {
              const StatusIcon = statusConfig[procurement.lotStatus as keyof typeof statusConfig]?.icon;

              return (
                <Card key={procurement.id} className="border-primary-200">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center">
                        {StatusIcon && (
                          <StatusIcon className="w-6 h-6 text-primary-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-primary-900">{procurement.centerName}</p>
                        <p className="text-sm text-primary-600">
                          {format(parseISO(procurement.bookingDate), 'dd MMM yyyy')} • Token #{procurement.tokenNumber}
                        </p>
                        <p className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block mt-1">
                          {procurement.stagedStatusText}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onOpenSlip(procurement)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                        title="View Official Shetkari Pavti"
                      >
                        <FileText className="w-3.5 h-3.5 text-amber-700" />
                        <span>🧾 शेतकरी पावती</span>
                      </button>
                      <button
                        onClick={() => {
                          const speech = `Procurement record for Token ${procurement.tokenNumber}. Status: ${statusConfig[procurement.lotStatus as keyof typeof statusConfig]?.label}. ${procurement.stagedStatusText}.`;
                          speakText(speech);
                        }}
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500 hover:text-emerald-700 transition-colors"
                        title="Listen to lot details"
                        aria-label="Listen to lot details"
                      >
                        <Volume2 className="w-4 h-4 text-emerald-600" />
                      </button>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[procurement.lotStatus as keyof typeof statusConfig]?.color}`}>
                        {statusConfig[procurement.lotStatus as keyof typeof statusConfig]?.label}
                      </span>
                    </div>
                  </div>
                  {procurement.netWeight && (
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div className="p-3 bg-primary-50 rounded-lg">
                        <p className="text-primary-600">Net Weight</p>
                        <p className="font-bold text-primary-900">{procurement.netWeight} qtl</p>
                      </div>
                      <div className="p-3 bg-primary-50 rounded-lg">
                        <p className="text-primary-600">Moisture</p>
                        <p className="font-bold text-primary-900">{procurement.moisturePercent}%</p>
                      </div>
                      <div className="p-3 bg-primary-50 rounded-lg">
                        <p className="text-primary-600">Completed</p>
                        <p className="font-bold text-primary-900">{format(parseISO(procurement.completedAt || procurement.startedAt), 'dd MMM HH:mm')}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyProcurementView() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Package className="w-16 h-16 text-primary-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-primary-900 mb-2">No Procurement Records</h2>
        <p className="text-primary-600 mb-6">Complete a booking and visit the center to start procurement</p>
        <Button onClick={() => window.location.href = '/booking'}>
          Book a Slot
        </Button>
      </CardContent>
    </Card>
  );
}