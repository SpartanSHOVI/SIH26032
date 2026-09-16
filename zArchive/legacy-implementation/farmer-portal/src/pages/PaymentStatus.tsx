import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { CreditCard, Clock, CheckCircle, AlertCircle, FileText, Download, ExternalLink } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { paymentApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface Payment {
  id: string;
  procurementLotId: string;
  farmerId: string;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'CREDITED' | 'FAILED' | 'REVERSED';
  utrReference?: string;
  creditedAt?: string;
  pfmsResponse?: any;
  createdAt: string;
  updatedAt: string;
  procurementLot?: {
    id: string;
    centerName: string;
    netWeight: number;
    bookingDate: string;
    tokenNumber: number;
  };
}

const statusConfig = {
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-800', icon: Clock },
  PROCESSING: { label: 'Processing', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  CREDITED: { label: 'Credited', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: AlertCircle },
  REVERSED: { label: 'Reversed', color: 'bg-orange-100 text-orange-800', icon: AlertCircle },
};

export default function PaymentStatus() {
  const { farmer } = useAuth();

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['myPayments', farmer?.id],
    queryFn: () => paymentApi.getMyPayments(farmer?.id).then((res: any) => res.data),
    enabled: !!farmer?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-900">Payment Status</h1>
        <p className="text-primary-600">Track payments from procurement to bank account</p>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-600 border-t-transparent" />
          </CardContent>
        </Card>
      ) : payments.length === 0 ? (
        <EmptyPaymentView />
      ) : (
        <div className="space-y-6">
          <PaymentSummary payments={payments} />
          <PaymentHistory payments={payments} />
        </div>
      )}
    </div>
  );
}

function PaymentSummary({ payments }: { payments: Payment[] }) {
  const creditedPayments = payments.filter(p => p.status === 'CREDITED');
  const pendingPayments = payments.filter(p => ['PENDING', 'PROCESSING'].includes(p.status));
  const failedPayments = payments.filter(p => ['FAILED', 'REVERSED'].includes(p.status));

  const totalCredited = creditedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalPending = pendingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-primary-600">Total Credited</CardTitle>
          <CheckCircle className="w-5 h-5 text-green-600" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary-900">₹{totalCredited.toLocaleString()}</p>
          <p className="text-sm text-primary-500">{creditedPayments.length} transaction(s)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-primary-600">Pending / Processing</CardTitle>
          <Clock className="w-5 h-5 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary-900">₹{totalPending.toLocaleString()}</p>
          <p className="text-sm text-primary-500">{pendingPayments.length} transaction(s)</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-primary-600">Failed / Reversed</CardTitle>
          <AlertCircle className="w-5 h-5 text-red-600" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-primary-900">{failedPayments.length}</p>
          <p className="text-sm text-primary-500">Check details below</p>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentHistory({ payments }: { payments: Payment[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary-600" />
          Payment History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {payments
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PaymentCard({ payment }: { payment: Payment }) {
  const config = statusConfig[payment.status];
  const Icon = config.icon;

  return (
    <Card className="border-primary-200">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${config.color.replace('bg-', 'bg-').replace('text-', '')}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <p className="font-medium text-primary-900">
                  {payment.procurementLot?.centerName || 'Procurement Lot'}
                </p>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="text-sm text-primary-600">
                {payment.procurementLot 
                  ? `Token #${payment.procurementLot.tokenNumber} • ${format(parseISO(payment.procurementLot.bookingDate), 'dd MMM yyyy')} • ${payment.procurementLot.netWeight} qtl`
                  : `Lot ID: ${payment.procurementLotId.slice(0, 8)}...`
                }
              </p>
              <p className="text-sm text-primary-500 mt-1">
                Initiated: {format(parseISO(payment.createdAt), 'dd MMM yyyy HH:mm')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 ml-auto">
            <div className="text-right">
              <p className="text-2xl font-bold text-primary-900">₹{payment.amount.toLocaleString()}</p>
              <p className="text-xs text-primary-500">Amount</p>
            </div>

            {payment.utrReference && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-primary-500">UTR Reference</span>
                <code className="px-2 py-1 bg-primary-100 rounded text-sm font-mono text-primary-900">
                  {payment.utrReference}
                </code>
              </div>
            )}

            {payment.creditedAt && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-primary-500">Credited On</span>
                <span className="text-sm font-medium text-primary-900">
                  {format(parseISO(payment.creditedAt), 'dd MMM yyyy')}
                </span>
              </div>
            )}

            <div className="flex flex-col items-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => viewPaymentDetails(payment)}>
                <FileText className="w-4 h-4" />
                Details
              </Button>
              {payment.pfmsResponse && (
                <Button variant="ghost" size="sm" onClick={() => downloadPaymentReceipt(payment)}>
                  <Download className="w-4 h-4" />
                  Receipt
                </Button>
              )}
            </div>
          </div>
        </div>

        {payment.status === 'PROCESSING' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-600" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Payment is being processed</p>
                <p>It typically takes 1-3 working days for PFMS/DBT to credit the amount to your bank account.</p>
              </div>
            </div>
          </div>
        )}

        {payment.status === 'FAILED' && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <div className="text-sm text-red-800">
                <p className="font-medium">Payment failed</p>
                <p>Please contact the procurement center or your bank. UTR: {payment.utrReference || 'N/A'}</p>
              </div>
            </div>
          </div>
        )}

        {payment.pfmsResponse && (
          <details className="mt-4">
            <summary className="text-sm text-primary-600 hover:text-primary-700 cursor-pointer flex items-center gap-1">
              <ExternalLink className="w-4 h-4" />
              View PFMS Response
            </summary>
            <pre className="mt-2 p-3 bg-primary-50 rounded text-xs overflow-x-auto text-primary-900">
              {JSON.stringify(payment.pfmsResponse, null, 2)}
            </pre>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function viewPaymentDetails(payment: Payment) {
  const details = `
Payment Details
================
Payment ID: ${payment.id}
Procurement Lot: ${payment.procurementLotId}
Amount: ₹${payment.amount.toLocaleString()}
Status: ${payment.status}
UTR Reference: ${payment.utrReference || 'N/A'}
Created: ${format(parseISO(payment.createdAt), 'dd MMM yyyy HH:mm')}
${payment.creditedAt ? `Credited: ${format(parseISO(payment.creditedAt), 'dd MMM yyyy HH:mm')}` : ''}

PFMS Response:
${payment.pfmsResponse ? JSON.stringify(payment.pfmsResponse, null, 2) : 'Not available'}
  `;
  
  const blob = new Blob([details], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payment-${payment.id.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPaymentReceipt(payment: Payment) {
  const receipt = `
ANNSETU - PAYMENT RECEIPT
=========================

Farmer: ${payment.farmerId}
Payment ID: ${payment.id}
Date: ${format(new Date(), 'dd MMM yyyy HH:mm')}

PROCUREMENT DETAILS
-------------------
Center: ${payment.procurementLot?.centerName || 'N/A'}
Booking Date: ${payment.procurementLot ? format(parseISO(payment.procurementLot.bookingDate), 'dd MMM yyyy') : 'N/A'}
Token Number: ${payment.procurementLot?.tokenNumber || 'N/A'}
Net Weight: ${payment.procurementLot?.netWeight || 'N/A'} quintals

PAYMENT DETAILS
---------------
Amount: ₹${payment.amount.toLocaleString()}
Status: ${payment.status}
UTR Reference: ${payment.utrReference || 'N/A'}
Initiated: ${format(parseISO(payment.createdAt), 'dd MMM yyyy HH:mm')}
${payment.creditedAt ? `Credited: ${format(parseISO(payment.creditedAt), 'dd MMM yyyy HH:mm')}` : ''}

PFMS Response:
${payment.pfmsResponse ? JSON.stringify(payment.pfmsResponse, null, 2) : 'Not available'}

---
This is a system-generated receipt from AnnSetu.
For queries, contact the procurement center or visit annsetu.gov.in
  `;

  const blob = new Blob([receipt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt-${payment.id.slice(0, 8)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function EmptyPaymentView() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <CreditCard className="w-16 h-16 text-primary-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-primary-900 mb-2">No Payment Records</h2>
        <p className="text-primary-600 mb-6">Payments appear here after your lot is accepted at the procurement center</p>
        <div className="space-y-2 text-sm text-primary-500">
          <p>1. Book a procurement slot</p>
          <p>2. Complete procurement (Gate Entry → Weighing → QC → Accepted)</p>
          <p>3. Payment is automatically initiated via PFMS/DBT</p>
        </div>
      </CardContent>
    </Card>
  );
}