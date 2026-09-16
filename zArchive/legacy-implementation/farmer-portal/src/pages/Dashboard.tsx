import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import {
  Calendar,
  Truck,
  Package,
  CreditCard,
  ArrowRight,
  PhoneCall,
  Smartphone,
  Radio,
  Volume2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { bookingApi, procurementApi, paymentApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import HelplineModal from '../components/HelplineModal';

interface Booking {
  id: string | number;
  bookingDate?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  tokenNumber?: string | number;
  token_number?: string | number;
  status: string;
  center?: {
    name?: string;
    code?: string;
  };
  centerName?: string;
  centerCode?: string;
  createdAt?: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { farmer } = useAuth();
  const [helplineModalOpen, setHelplineModalOpen] = useState(false);
  const [helplineTab, setHelplineTab] = useState<'ivr' | 'ussd' | 'voice_updates'>('ivr');

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['myBookings', farmer?.id],
    queryFn: () => bookingApi.getMyBookings(farmer?.id).then(res => res.data),
    enabled: !!farmer?.id,
  });

  const { data: procurements = [] } = useQuery({
    queryKey: ['myProcurements', farmer?.id],
    queryFn: () => procurementApi.getMyProcurement(farmer?.id).then((res: any) => res.data),
    enabled: !!farmer?.id,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['myPayments', farmer?.id],
    queryFn: () => paymentApi.getMyPayments(farmer?.id).then((res: any) => res.data),
    enabled: !!farmer?.id,
  });

  const formatBookingDate = (dateStr?: string, createdAt?: string) => {
    const target = dateStr || (createdAt ? createdAt.substring(0, 10) : null);
    if (!target) return 'Today';
    try {
      return format(parseISO(target), 'dd MMM yyyy');
    } catch {
      return target;
    }
  };

  const formatPaymentDate = (dateStr?: string, createdAt?: string) => {
    const target = dateStr || (createdAt ? createdAt.substring(0, 10) : null);
    if (!target) return null;
    try {
      return format(parseISO(target), 'dd MMM yyyy');
    } catch {
      return null;
    }
  };

  const formatSlotTime = (start?: string, end?: string) => {
    if (!start && !end) return '';
    return `${start || '09:00'} - ${end || '10:00'}`;
  };

  const activeBooking = bookings.find((b: Booking) => {
    const st = (b.status || '').toLowerCase();
    return ['pending', 'confirmed', 'booked', 'arrived', 'verification', 'quality_check'].includes(st);
  });

  const activeProcurement = procurements.find((p: any) => 
    ['GATE_ENTRY', 'WEIGHING', 'QC', 'arrived', 'verification', 'quality_check'].includes(p.lotStatus || p.status)
  );

  const completedProcurement = procurements.find((p: any) => 
    ['ACCEPTED', 'accepted', 'procured'].includes(p.lotStatus || p.status)
  );

  const pendingPayment = payments.find((p: any) => 
    ['PENDING', 'PROCESSING', 'pending', 'processing', 'payment_processing'].includes(p.status)
  );

  const creditedPayment = payments.find((p: any) => 
    ['CREDITED', 'credited', 'paid', 'payment_completed'].includes(p.status)
  );

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed':
      case 'booked': return 'bg-emerald-100 text-emerald-800';
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'completed':
      case 'paid':
      case 'payment_completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled':
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'accepted':
      case 'procured': return 'bg-green-100 text-green-800';
      case 'arrived':
      case 'verification':
      case 'quality_check':
      case 'gate_entry':
      case 'weighing':
      case 'qc': return 'bg-indigo-100 text-indigo-800';
      case 'credited': return 'bg-green-100 text-green-800';
      case 'payment_processing':
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-gray-900">Welcome, {farmer?.name || 'Farmer'}</h1>
            {farmer?.crop && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                {farmer.crop} ({farmer.quantity ? `${farmer.quantity} Qt` : 'Registered'})
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 font-medium">
            <span>Farmer ID: <strong className="text-gray-700 font-mono">{farmer?.farmerId || farmer?.farmer_id || `FARMER-${farmer?.mobile || '001'}`}</strong></span>
            <span>•</span>
            <span>Mobile: <strong className="text-gray-700 font-mono">{farmer?.mobile || '—'}</strong></span>
            {farmer?.state && (
              <>
                <span>•</span>
                <span>Location: <strong className="text-gray-700">{farmer.district ? `${farmer.district}, ` : ''}{farmer.state}</strong></span>
              </>
            )}
          </div>
        </div>
        <Button onClick={() => navigate('/farmer/booking')} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20">
          <Calendar className="w-4 h-4" />
          Book New Slot
        </Button>
      </div>

      {/* Illiteracy & 0-Internet Feature Phone Assistance Bar */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-emerald-500/30">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[11px] font-black uppercase tracking-wider flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse text-slate-950" />
                0-Internet & Feature Phone Seva
              </span>
              <span className="text-xs text-emerald-300 font-semibold hidden sm:inline">
                • अनपढ़ और 2G/3G फोन धारक किसान भाइयों हेतु
              </span>
            </div>
            <h3 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
              <span>टोल-फ्री हेल्पलाइन (1800-180-SETU) एवं *555# कोड</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              स्मार्टफोन या इंटरनेट के बिना, केवल एक फोन कॉल करके या साधारण कीपैड फोन से *555# डायल करके लाइव टोकन स्थिति, मंडी कतार और सीधे बैंक खाते का स्टेटस जानें।
            </p>
          </div>

          {/* Quick Action Dial Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <button
              onClick={() => {
                setHelplineTab('ivr');
                setHelplineModalOpen(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all hover:scale-105 active:scale-95"
            >
              <PhoneCall className="w-4 h-4" />
              <span>📞 हेल्पलाइन कॉल (IVR)</span>
            </button>

            <button
              onClick={() => {
                setHelplineTab('ussd');
                setHelplineModalOpen(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600 transition-all hover:scale-105 active:scale-95"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>📱 डायल *555# (USSD)</span>
            </button>

            <button
              onClick={() => {
                setHelplineTab('voice_updates');
                setHelplineModalOpen(true);
              }}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600 transition-all hover:scale-105 active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-blue-400" />
              <span>🎙️ वॉयस संदेश (Alerts)</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:border-emerald-200 transition-all">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-600">Book Slot</CardTitle>
            <Calendar className="w-5 h-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <p className="text-lg font-semibold text-primary-900">
                  {farmer?.crop || 'Produce'} Mandi Slot
                </p>
                <p className="text-xs text-primary-500 mt-0.5">
                  Select mandi center, preferred date & allocate queue token
                </p>
              </div>

              {activeBooking ? (
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-lg p-2.5 text-xs text-emerald-900">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Active Booking</span>
                    <span className="bg-emerald-200/80 text-emerald-900 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider font-bold">
                      {activeBooking.status}
                    </span>
                  </div>
                  <p className="truncate text-emerald-700 mt-1 font-medium">
                    {activeBooking.center?.name || activeBooking.centerName || 'Mandi Center'}
                  </p>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    {formatBookingDate(activeBooking.bookingDate, activeBooking.createdAt)}
                  </p>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-xs text-slate-600">
                  <p className="font-medium text-slate-800">MSP Mandi Centers Open</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Guaranteed entry & minimal wait times</p>
                </div>
              )}

              <Button 
                onClick={() => navigate('/farmer/booking')} 
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold text-xs py-2.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{activeBooking ? 'Book Another Slot' : 'Book a Slot'}</span>
                <ArrowRight className="w-3 h-3 ml-auto" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-600">Live Queue</CardTitle>
            <Truck className="w-5 h-5 text-primary-400" />
          </CardHeader>
          <CardContent>
            {activeBooking ? (
              <div className="space-y-2">
                <p className="text-primary-600">
                  Your Token: <span className="font-semibold text-primary-900">#{activeBooking.tokenNumber || activeBooking.token_number || activeBooking.id}</span>
                </p>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor('CONFIRMED')}`}>
                    Waiting
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/farmer/queue')} className="w-full mt-3">
                  Live Status <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Truck className="w-12 h-12 text-primary-300 mx-auto mb-3" />
                <p className="text-primary-500">Book a slot to see queue status</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-600">Procurement</CardTitle>
            <Package className="w-5 h-5 text-primary-400" />
          </CardHeader>
          <CardContent>
            {activeProcurement ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-primary-900">{activeProcurement.center?.name || activeProcurement.centerName || 'Processing'}</p>
                <p className="text-primary-600">Stage: {activeProcurement.lotStatus || activeProcurement.status}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activeProcurement.lotStatus || activeProcurement.status)}`}>
                    {activeProcurement.lotStatus || activeProcurement.status}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/farmer/procurement')} className="w-full mt-3">
                  View Details <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            ) : completedProcurement ? (
              <div className="space-y-2">
                <p className="text-primary-600">Last: {completedProcurement.center?.name || completedProcurement.centerName || 'Procurement Center'}</p>
                <p className="text-primary-600">Net Weight: {completedProcurement.netWeight || completedProcurement.quantityReceived || 0} qtl</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/farmer/procurement')} className="w-full mt-3">
                  View History <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="w-12 h-12 text-primary-300 mx-auto mb-3" />
                <p className="text-primary-500">No active procurement</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-primary-600">Payment Status</CardTitle>
            <CreditCard className="w-5 h-5 text-primary-400" />
          </CardHeader>
          <CardContent>
            {pendingPayment ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-primary-900">₹{pendingPayment.amount?.toLocaleString()}</p>
                <p className="text-primary-600">Processing...</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pendingPayment.status)}`}>
                    {pendingPayment.status}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/farmer/payment')} className="w-full mt-3">
                  Track Payment <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            ) : creditedPayment ? (
              <div className="space-y-2">
                <p className="text-lg font-semibold text-primary-900">₹{creditedPayment.amount?.toLocaleString()}</p>
                <p className="text-primary-600">
                  {formatPaymentDate(creditedPayment.creditedAt, creditedPayment.createdAt)
                    ? `Credited on ${formatPaymentDate(creditedPayment.creditedAt, creditedPayment.createdAt)}`
                    : 'Payment Credited'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Credited
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/farmer/payment')} className="w-full mt-3">
                  View Details <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <CreditCard className="w-12 h-12 text-primary-300 mx-auto mb-3" />
                <p className="text-primary-500">No payment initiated yet</p>
                <p className="text-xs text-primary-400 mt-1">Payment starts after lot acceptance</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookingsLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent" /></div>
            ) : bookings.length === 0 ? (
              <p className="text-primary-500 text-center py-8">No bookings yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {bookings.slice(0, 5).map((booking: Booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                    <div>
                      <p className="font-medium text-primary-900">
                        {booking.center?.name || booking.centerName || 'Procurement Center'}
                      </p>
                      <p className="text-sm text-primary-600">
                        {formatBookingDate(booking.bookingDate, booking.createdAt)} • Token #{booking.tokenNumber || booking.token_number || booking.id}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Toll-Free Helpline & USSD Modal */}
      <HelplineModal
        isOpen={helplineModalOpen}
        onClose={() => setHelplineModalOpen(false)}
        defaultTab={helplineTab}
      />
    </div>
  );
}