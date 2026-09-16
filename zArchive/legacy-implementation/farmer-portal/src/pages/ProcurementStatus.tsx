import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Package, Truck, Scale, CheckCircle, AlertCircle, Clock, Calendar, XCircle } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { procurementApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

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
  staffId?: string;
  startedAt: string;
  completedAt?: string;
  bookingId: string;
  tokenNumber: number;
  bookingDate: string;
  timeWindowStart: string;
  timeWindowEnd: string;
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

export default function ProcurementStatus() {
  const { farmer } = useAuth();

  const { data: procurements = [], isLoading } = useQuery({
    queryKey: ['myProcurements', farmer?.id],
    queryFn: () => procurementApi.getMyProcurement(farmer?.id).then((res: any) => res.data),
    enabled: !!farmer?.id,
  });

  const activeProcurement = procurements.find((p: ProcurementLot) => 
    ['GATE_ENTRY', 'WEIGHING', 'QC'].includes(p.lotStatus)
  );

  const completedProcurements = procurements.filter((p: ProcurementLot) => 
    ['ACCEPTED', 'REJECTED'].includes(p.lotStatus)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Procurement Status</h1>
        <p className="text-primary-600">Track your crop through each stage</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
          </CardContent>
        </Card>
      ) : activeProcurement ? (
        <ActiveProcurementView procurement={activeProcurement} allProcurements={procurements} />
      ) : completedProcurements.length > 0 ? (
        <CompletedProcurementsView procurements={completedProcurements} />
      ) : (
        <EmptyProcurementView />
      )}
    </div>
  );
}

function ActiveProcurementView({ procurement, allProcurements }: { procurement: ProcurementLot; allProcurements: ProcurementLot[] }) {
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
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.color}`}>
            {config.label}
          </span>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Gross Weight</p>
                    <p className="font-bold text-primary-900 text-xl">{procurement.grossWeight || '-'} qtl</p>
                  </div>
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Tare Weight</p>
                    <p className="font-bold text-primary-900 text-xl">{procurement.tareWeight || '-'} qtl</p>
                  </div>
                  <div className="p-3 bg-primary-50 rounded-lg col-span-2">
                    <p className="text-sm text-primary-600">Net Weight</p>
                    <p className="font-bold text-primary-900 text-2xl text-green-700">{procurement.netWeight || '-'} qtl</p>
                  </div>
                </div>
                <p className="text-sm text-primary-500">Next: Quality check (moisture, foreign matter)</p>
              </div>
            )}

            {procurement.lotStatus === 'QC' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-primary-50 rounded-lg">
                    <p className="text-sm text-primary-600">Moisture %</p>
                    <p className="font-bold text-primary-900 text-xl">{procurement.moisturePercent || '-'}%</p>
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
                <p className="flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Lot accepted for procurement</p>
                <p className="flex items-center gap-2"><Scale className="w-4 h-4" /> Net weight: {procurement.netWeight} quintals</p>
                <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Accepted at: {format(parseISO(procurement.completedAt || procurement.startedAt), 'HH:mm')}</p>
                <p className="text-sm text-primary-500">Payment will be initiated via PFMS/DBT</p>
              </div>
            )}

            {procurement.lotStatus === 'REJECTED' && (
              <div className="space-y-3 text-red-700">
                <p className="flex items-center gap-2"><XCircle className="w-4 h-4" /> Lot rejected</p>
                <p className="text-sm text-primary-500">Reason: Quality parameters not met (moisture/f.m.)</p>
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

function CompletedProcurementsView({ procurements }: { procurements: ProcurementLot[] }) {
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
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusConfig[procurement.lotStatus as keyof typeof statusConfig]?.color}`}>
                      {statusConfig[procurement.lotStatus as keyof typeof statusConfig]?.label}
                    </span>
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