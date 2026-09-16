import React, { useRef, useState } from 'react';
import { X, Printer, Download, CheckCircle2, ShieldCheck, QrCode, FileText } from 'lucide-react';
import { getMspRate } from '../utils/mspUtils';

export interface ProcurementSlipData {
  organization?: string;
  slipType?: string;
  status?: string;
  date?: string;
  time?: string;
  receiptNo?: string;
  trader?: string;
  weighingNo?: string;
  sellerName?: string;
  sellerMobile?: string;
  sellerVillage?: string;
  departmentGrade?: string;
  lotNo?: string;
  grainType?: string;
  buyer?: string;
  subBuyer?: string;
  bags?: number | string;
  weightKg?: number | string;
  ratePer100Kg?: number | string;
  totalBags?: number | string;
  totalWeightKg?: number | string;
  totalAmount?: number | string;
  netAmount?: number | string;
  deductionAmount?: number | string;
  bankAccount?: string;
  ifsc?: string;
  utrRef?: string;
  paymentMethod?: 'online' | 'cash';
  centerCode?: string;
  moisturePercent?: number;
}

interface ProcurementSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: ProcurementSlipData;
}

export const ProcurementSlipModal: React.FC<ProcurementSlipModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [lang, setLang] = useState<'mr' | 'hi' | 'en'>('mr');
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Defaults and fallbacks based on realistic Indian APMC Mandi standards
  const now = new Date();
  const dateStr = data.date || now.toLocaleDateString('en-GB').replace(/\//g, '-');
  const timeStr = data.time || now.toTimeString().slice(0, 8);

  const organization =
    data.organization ||
    'कृ.उ.बा.स. नामपूर, उप बा करंजाड, नयाळाण, जि. नाशिक (APMC Market Yard)';
  const slipType =
    lang === 'mr'
      ? 'शेतकरी पावती (Farmer Receipt)'
      : lang === 'hi'
      ? 'किसान रसीद (Farmer Procurement Slip)'
      : 'Farmer Procurement Receipt (J-Form)';

  const status = (data.status || 'PAID').toUpperCase();
  const receiptNo = data.receiptNo || `W28244-${now.toISOString().slice(2, 10).replace(/-/g, '')}-3`;
  const trader = data.trader || '27- मे. महाकाल / अन्न सेतु नोडल खरेदी संस्था';
  const weighingNo = data.weighingNo || `WB-${Math.floor(10000 + Math.random() * 90000)}`;
  const sellerName = data.sellerName || 'अविनाश खुशाल पाटील';
  const sellerMobile = data.sellerMobile || '9623037498';
  const sellerVillage = data.sellerVillage || 'अंतापूर, जि. नाशिक';
  const departmentGrade =
    data.departmentGrade ||
    (data.moisturePercent ? `FAQ Grade — ओलावा: ${data.moisturePercent}%` : 'काडा — 573531');
  const lotNo = data.lotNo || `W28244-${now.toISOString().slice(2, 10).replace(/-/g, '')}-3675-A`;
  const grainType = data.grainType || 'काडा उन्हाळी (Kada Unhali) / गहू';
  const buyer = data.buyer || 'शासकीय हमीभाव खरेदी (Govt MSP Procurement)';
  const subBuyer = data.subBuyer || 'kt';

  // Calculations
  const weightVal = Number(data.weightKg || data.totalWeightKg || 2020);
  const bagsVal = Number(data.bags || data.totalBags || Math.ceil(weightVal / 50) || 1);
  const rateVal = Number(data.ratePer100Kg || getMspRate(data.grainType) || 2850);
  const grossAmountVal = Number(data.totalAmount || Math.round((weightVal / 100) * rateVal) || 57570);
  const deductionVal = Number(data.deductionAmount || 0);
  const netAmountVal = Number(data.netAmount || grossAmountVal - deductionVal || 57570);
  const isCashPayment = data.paymentMethod === 'cash';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadTxt = () => {
    const textSlip = `
======================================================================
${organization}
${slipType}
======================================================================
Field                  Value
----------------------------------------------------------------------
Organization           : ${organization}
Slip Type              : ${slipType}
Status                 : ${status}
Date                   : ${dateStr}
Time                   : ${timeStr}
Receipt No.            : ${receiptNo}
Trader                 : ${trader}
Weighing No.           : ${weighingNo}
Seller Name            : ${sellerName}
Seller Mobile          : ${sellerMobile}
Seller Village         : ${sellerVillage}
Department/Grade       : ${departmentGrade}
Lot No.                : ${lotNo}
Grain Type             : ${grainType}
Buyer                  : ${buyer}
Sub-Buyer              : ${subBuyer}
Bags (Nag)             : ${bagsVal}
Weight (Vajan)         : ${weightVal.toFixed(2)} kg (${(weightVal / 100).toFixed(2)} Qtl)
Rate                   : ₹${rateVal.toLocaleString('en-IN')} per 100 kg
Total Bags             : ${bagsVal.toFixed(2)}
Total Weight           : ${weightVal.toFixed(2)} kg
Total Amount           : ₹${grossAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Deduction / Cess       : ₹${deductionVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Net Amount             : ₹${netAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Payment Method         : ${isCashPayment ? 'Cash at Mandi Counter' : 'PFMS / DBT Online'}
${isCashPayment
  ? `Cash Receipt Ref       : ${data.utrRef || `CASH-${receiptNo}`}`
  : `Bank Account           : ${data.bankAccount || 'Aadhaar Seeded DBT'}
IFSC Code              : ${data.ifsc || 'SBIN0001234'}
PFMS / UTR Ref         : ${data.utrRef || 'PFMS' + Date.now()}`}
Powered by             : AnnSetu (अन्न सेतु) — Smart National Procurement Platform
======================================================================
Certified Weighment & Quality Verified under Statutory MSP Scheme.
`;
    const blob = new Blob([textSlip], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Shetkari_Pavti_${receiptNo}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-gray-300 overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Modal Action Header (Hidden in Print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-sm font-bold tracking-wide">
              अधिकृत शेतकरी पावती (APMC Farmer Procurement Slip)
            </h3>
          </div>

          <div className="flex items-center gap-2">
            {/* Language Switcher */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5 text-xs font-semibold">
              <button
                onClick={() => setLang('mr')}
                className={`px-2 py-1 rounded ${lang === 'mr' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                मराठी
              </button>
              <button
                onClick={() => setLang('hi')}
                className={`px-2 py-1 rounded ${lang === 'hi' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                हिंदी
              </button>
              <button
                onClick={() => setLang('en')}
                className={`px-2 py-1 rounded ${lang === 'en' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'}`}
              >
                English
              </button>
            </div>

            <button
              onClick={handleDownloadTxt}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title="Download Text File"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title="Print Receipt"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title="Close Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTENT */}
        <div
          id="procurement-slip-printable"
          ref={printRef}
          className="p-6 sm:p-8 bg-white font-sans text-gray-900 print:p-0 print:m-0 print:w-full print-exact-color"
        >
          {/* Outer Traditional Border */}
          <div className="border-2 border-gray-900 rounded-lg p-5 relative bg-white print:border-black print:p-4 print-exact-color">
            {/* Header: Organization & Title */}
            <div className="text-center pb-4 border-b-2 border-gray-900 space-y-1 print:border-black">
              <div className="flex items-center justify-center gap-2 mb-1">
                <span className="w-8 h-8 rounded-full border border-gray-800 flex items-center justify-center font-serif font-black text-sm text-gray-800">
                  अ
                </span>
                <span className="text-xs font-bold tracking-widest uppercase text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 print:border-black">
                  Government of Maharashtra / APMC Mandi Board
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-gray-950 font-serif">
                {organization}
              </h2>
              <div className="flex items-center justify-center gap-3 pt-1">
                <span className="text-sm font-extrabold text-gray-900 bg-amber-100/70 px-3 py-0.5 rounded border border-amber-300 print:border-black print:bg-none">
                  {slipType}
                </span>
                <span className="text-xs font-black px-2.5 py-0.5 rounded bg-emerald-600 text-white print:text-black print:border print:border-black print:bg-none">
                  {status}
                </span>
              </div>
            </div>

            {/* Receipt Meta Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-b border-gray-300 text-xs bg-gray-50/60 -mx-5 px-5 print:bg-none print:border-black">
              <div>
                <span className="text-gray-500 font-medium block text-[10px] uppercase">
                  {lang === 'mr' ? 'दिनांक (Date)' : 'Date'}
                </span>
                <span className="font-bold text-gray-900">{dateStr}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block text-[10px] uppercase">
                  {lang === 'mr' ? 'वेळ (Time)' : 'Time'}
                </span>
                <span className="font-bold text-gray-900">{timeStr}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block text-[10px] uppercase">
                  {lang === 'mr' ? 'पावती क्र. (Receipt No.)' : 'Receipt No.'}
                </span>
                <span className="font-mono font-bold text-gray-900">{receiptNo}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium block text-[10px] uppercase">
                  {lang === 'mr' ? 'वजन पावती क्र.' : 'Weighing No.'}
                </span>
                <span className="font-mono font-bold text-gray-900">{weighingNo}</span>
              </div>
            </div>

            {/* Main Seller & Buyer Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3.5 border-b border-gray-300 text-xs print:border-black">
              {/* Seller / Farmer Details */}
              <div className="space-y-1.5 pr-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'शेतकरी नाव (Seller Name):' : 'Seller Name:'}
                  </span>
                  <span className="font-bold text-gray-950">{sellerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'मोबाईल क्र. (Mobile):' : 'Mobile No.:'}
                  </span>
                  <span className="font-mono font-semibold text-gray-900">{sellerMobile}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'गाव / पत्ता (Village):' : 'Village / Address:'}
                  </span>
                  <span className="font-medium text-gray-900">{sellerVillage}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'प्रत / दर्जा (Grade):' : 'Department/Grade:'}
                  </span>
                  <span className="font-semibold text-emerald-800">{departmentGrade}</span>
                </div>
              </div>

              {/* Trader / Buyer Details */}
              <div className="space-y-1.5 pl-0 sm:pl-2 border-t sm:border-t-0 sm:border-l border-gray-200 print:border-black">
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'व्यापारी (Trader):' : 'Trader:'}
                  </span>
                  <span className="font-bold text-gray-950">{trader}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'खरेदीदार (Buyer):' : 'Buyer:'}
                  </span>
                  <span className="font-medium text-gray-900">{buyer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'उप-खरेदीदार (Sub-Buyer):' : 'Sub-Buyer:'}
                  </span>
                  <span className="font-medium text-gray-900">{subBuyer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 font-medium">
                    {lang === 'mr' ? 'लॉट क्र. (Lot No.):' : 'Lot No.:'}
                  </span>
                  <span className="font-mono font-bold text-gray-900">{lotNo}</span>
                </div>
              </div>
            </div>

            {/* Produce Commodity & Weight Particulars Table */}
            <div className="my-4 overflow-hidden rounded-md border border-gray-900 print:border-black">
              <table className="min-w-full text-xs divide-y divide-gray-900 print:divide-black">
                <thead className="bg-gray-100 text-gray-900 font-bold print:bg-none">
                  <tr>
                    <th className="px-3 py-2 text-left">
                      {lang === 'mr' ? 'शेतमालाचा प्रकार (Grain Type)' : 'Grain Type'}
                    </th>
                    <th className="px-3 py-2 text-center">
                      {lang === 'mr' ? 'नग / पोती (Bags)' : 'Bags (Nag)'}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {lang === 'mr' ? 'वजन (Weight kg)' : 'Weight (kg)'}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {lang === 'mr' ? 'हमीभाव दर (Rate / 100 kg)' : 'Rate / 100 kg'}
                    </th>
                    <th className="px-3 py-2 text-right">
                      {lang === 'mr' ? 'एकूण रक्कम (Amount)' : 'Total Amount'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 print:divide-black">
                  <tr>
                    <td className="px-3 py-2.5 font-bold text-gray-950">{grainType}</td>
                    <td className="px-3 py-2.5 text-center font-semibold text-gray-900">
                      {bagsVal} Nag
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-950">
                      {weightVal.toFixed(2)} kg
                      <span className="block text-[10px] text-gray-500 font-normal">
                        ({(weightVal / 100).toFixed(2)} Qtl)
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-950">
                      ₹{rateVal.toLocaleString('en-IN')}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-gray-950">
                      ₹{grossAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-gray-50 font-semibold text-gray-900 border-t-2 border-gray-900 print:bg-none print:border-black">
                  <tr>
                    <td className="px-3 py-2 font-bold">
                      {lang === 'mr' ? 'एकूण (Total)' : 'Total'}
                    </td>
                    <td className="px-3 py-2 text-center font-bold">{bagsVal.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-bold">{weightVal.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right text-gray-500 font-normal">—</td>
                    <td className="px-3 py-2 text-right font-black text-gray-950">
                      ₹{grossAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Financial Summary & Net Amount Banner */}
            <div className="bg-amber-50/60 border border-amber-300 rounded-lg p-4 mb-4 print:border-black print:bg-none">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">
                      {lang === 'mr' ? 'एकूण रक्कम (Gross Amount):' : 'Gross Amount:'}
                    </span>
                    <span className="font-mono font-semibold text-gray-900">
                      ₹{grossAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">
                      {lang === 'mr' ? 'वजावट / हमाली (Deduction/Cess):' : 'Deductions:'}
                    </span>
                    <span className="font-mono font-semibold text-emerald-800">
                      ₹{deductionVal.toFixed(2)} (Govt MSP Zero Cess)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">
                      {isCashPayment
                        ? (lang === 'mr' ? 'रोख पेमेंट (Cash Payment):' : 'Payment Method:')
                        : (lang === 'mr' ? 'बँक खाते (Bank DBT A/C):' : 'Bank A/C:')}
                    </span>
                    <span className="font-mono font-medium text-gray-800">
                      {isCashPayment ? 'Cash at Mandi Counter' : (data.bankAccount || 'Aadhaar Direct DBT')}
                    </span>
                  </div>
                </div>

                <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-amber-200 pl-0 sm:pl-4 pt-2 sm:pt-0 print:border-black">
                  <span className="text-[11px] font-bold text-gray-700 uppercase block">
                    {lang === 'mr' ? 'निव्वळ देय रक्कम (Net Amount):' : 'Net Payable Amount:'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-emerald-900 font-mono tracking-tight block">
                    ₹{netAmountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                    {isCashPayment
                      ? '✓ Cash payout recorded at the mandi counter'
                      : '✓ Direct DBT Transfer Initiated to Verified Farmer Account'}
                  </span>
                </div>
              </div>
            </div>

            {/* Authentication, Signatures & Digital Attestation */}
            <div className="pt-4 border-t border-gray-300 grid grid-cols-3 gap-2 text-center text-[10px] text-gray-700 print:border-black">
              <div className="space-y-6">
                <div className="text-gray-400 font-serif italic text-xs pt-2">अविनाश पाटील</div>
                <div className="border-t border-dashed border-gray-400 pt-1 font-semibold text-gray-800">
                  {lang === 'mr' ? 'शेतकऱ्याची सही (Farmer Sign)' : 'Seller Signature'}
                </div>
              </div>

              <div className="flex flex-col items-center justify-center space-y-1">
                <div className="w-12 h-12 rounded border border-gray-300 p-1 bg-white flex items-center justify-center shadow-xs">
                  <QrCode className="w-10 h-10 text-gray-800" />
                </div>
                <span className="text-[9px] font-mono font-semibold text-gray-600">
                  AnnSetu Verified QR
                </span>
              </div>

              <div className="space-y-6">
                <div className="text-emerald-800 font-mono font-bold text-xs pt-2">
                  ✓ तोलाई प्रमाणित
                </div>
                <div className="border-t border-dashed border-gray-400 pt-1 font-semibold text-gray-800">
                  {lang === 'mr' ? 'तोलणार / बाजार समिती सही' : 'Weighbridge / APMC Sign'}
                </div>
              </div>
            </div>

            {/* Footer Endorsement */}
            <div className="mt-4 pt-2 border-t border-gray-200 text-center text-[10px] text-gray-500 flex items-center justify-between print:border-black">
              <span>Powered by: <strong>AnnSetu (अन्न सेतु)</strong> • National Mandi Platform</span>
              <span className="font-mono">Ref: {receiptNo}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer Controls (Hidden in Print) */}
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between print:hidden">
          <span className="text-xs text-gray-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Statutory APMC Government Procurement Format (Standard शेतकरी पावती)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadTxt}
              className="px-3.5 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Download Text
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center gap-1.5 transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              पावती छापा (Print Slip)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProcurementSlipModal;
