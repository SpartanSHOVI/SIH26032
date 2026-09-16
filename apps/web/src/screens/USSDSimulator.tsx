import { useState, useRef, useEffect } from 'react';
import { Smartphone, RefreshCw, Info, Globe, PhoneCall, Zap, Users, Wifi } from 'lucide-react';
import { ussdApi } from '../services/api';
import { useAuth } from '../hooks/useAuth';

// ─── USSD Menu Tree (client-side fallback for offline demo) ──────────────────
const OFFLINE_MENU: Record<string, Record<string, string>> = {
  '': {
    hi: 'CON अन्न सेतु किसान सेवा (*555#)\n1. हिंदी\n2. ਪੰਜਾਬੀ\n3. मराठी\n4. English',
    pa: 'CON ਅੰਨ ਸੇਤੂ ਕਿਸਾਨ ਸੇਵਾ (*555#)\n1. ਹਿੰਦੀ\n2. ਪੰਜਾਬੀ\n3. ਮਰਾਠੀ\n4. English',
    en: 'CON AnnSetu Kisan Seva (*555#)\n1. Hindi\n2. Punjabi\n3. Marathi\n4. English',
  },
  '1': {
    hi: 'CON मुख्य मेनू:\n1. टोकन एवं कतार स्थिति\n2. नया स्लॉट बुक करें\n3. देरी की सूचना (+15 मिनट)\n4. आज का एमएसपी\n9. सहायता अधिकारी\n0. वापस',
    pa: 'CON ਮੁੱਖ ਮੇਨੂ:\n1. ਟੋਕਨ ਅਤੇ ਕਤਾਰ ਸਥਿਤੀ\n2. ਨਵਾਂ ਸਲਾਟ ਬੁੱਕ ਕਰੋ\n3. ਦੇਰੀ ਦੀ ਸੂਚਨਾ (+15 ਮਿੰਟ)\n4. ਅੱਜ ਦਾ ਐਮਐਸਪੀ\n9. ਸਹਾਇਤਾ ਅਧਿਕਾਰੀ\n0. ਵਾਪਸ',
    en: 'CON Main Menu:\n1. Token & Queue Status\n2. Book New Slot\n3. Running Late (+15 min grace)\n4. Today\'s MSP Rates\n9. Speak to Officer\n0. Back',
  },
  '1*1': {
    hi: 'CON आपका टोकन: PUN0011001\nमंडी: कपूरथला खरीद केंद्र\nआगे: 12 किसान | प्रतीक्षा: ~23 मिनट\nस्थिति: Arrived (प्रमाणीकरण के लिए)\n0. मुख्य मेनू',
    pa: 'CON ਤੁਹਾਡਾ ਟੋਕਨ: PUN0011001\nਮੰਡੀ: ਕਪੂਰਥਲਾ ਖਰੀਦ ਕੇਂਦਰ\nਅੱਗੇ: 12 ਕਿਸਾਨ | ਉਡੀਕ: ~23 ਮਿੰਟ\n0. ਮੁੱਖ ਮੇਨੂ',
    en: 'CON Token: PUN0011001\nMandi: Kapurthala Procurement Center\nAhead: 12 farmers | Wait: ~23 min\nStatus: Arrived (pending verification)\n0. Main Menu',
  },
  '1*2': {
    hi: 'CON खरीद स्लॉट उपलब्ध हैं।\nऑनलाइन बुक करें: annsetu.gov.in\nया 9 दबाकर अधिकारी से बात करें।\n0. मुख्य मेनू',
    en: 'CON Procurement slots available.\nBook online: annsetu.gov.in\nOr press 9 to speak to an officer.\n0. Main Menu',
  },
  '1*3': {
    hi: 'END आपकी 15 मिनट की छूट स्वीकार की गई। कतार में आपकी स्थिति सुरक्षित है।',
    pa: 'END ਤੁਹਾਡੀ 15 ਮਿੰਟ ਦੀ ਛੋਟ ਮਿਲ ਗਈ। ਤੁਹਾਡੀ ਥਾਂ ਸੁਰੱਖਿਅਤ ਹੈ।',
    en: 'END 15-minute grace period granted. Your queue position is protected.',
  },
  '1*4': {
    hi: 'END ਸਰਕਾਰੀ ਐਮਐਸਪੀ (2025-26):\nਗੇਹੂੰ: ₹2275/ਕੁਇੰਟਲ\nਝੋਨਾ: ₹2183/ਕੁਇੰਟਲ\nਸਰ੍ਹੋਂ: ₹5650/ਕੁਇੰਟਲ\nभुगतान: DBT बैंक खाते में।',
    pa: 'END ਸਰਕਾਰੀ ਐਮਐਸਪੀ (2025-26):\nਕਣਕ: ₹2275/ਕੁਇੰਟਲ\nਝੋਨਾ: ₹2183/ਕੁਇੰਟਲ\nਸਰ੍ਹੋਂ: ₹5650/ਕੁਇੰਟਲ',
    en: 'END Govt MSP Rates (2025-26):\nWheat: ₹2,275/quintal\nPaddy: ₹2,183/quintal\nMustard: ₹5,650/quintal\nPayment via DBT to your bank.',
  },
  '1*9': {
    hi: 'END आपकी कॉल मंडी नोडल अधिकारी से जोड़ी जा रही है। कृपया लाइन पर बने रहें।',
    en: 'END Connecting to Mandi Nodal Officer. Please hold the line.',
  },
};

const LANGUAGES = [
  { code: 'hi', label: 'हिंदी', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', flag: '🟡' },
  { code: 'en', label: 'English', flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
];

interface SessionEntry {
  type: 'input' | 'response';
  content: string;
  time: string;
}

export default function USSDSimulator() {
  const { farmer } = useAuth();
  const [lang, setLang] = useState<'hi' | 'pa' | 'en'>('hi');
  const [sessionActive, setSessionActive] = useState(false);
  const [navPath, setNavPath] = useState<string[]>([]);
  const [display, setDisplay] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([]);
  const [apiConnected, setApiConnected] = useState<boolean | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll session log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [sessionLog]);

  const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const getOfflineResponse = (path: string): string => {
    const menu = OFFLINE_MENU[path];
    if (!menu) return 'END Session ended. Please redial *555#';
    return menu[lang] || menu['en'] || 'END Session ended.';
  };

  const dial = async (input?: string) => {
    setLoading(true);
    const phone = farmer?.mobile || '9876543210';
    let textPath: string;
    let newPath: string[];

    if (!sessionActive) {
      // Fresh dial
      textPath = '';
      newPath = [];
      setNavPath([]);
      setSessionLog([]);
    } else {
      const key = input || '';
      newPath = [...navPath, key];
      textPath = newPath.join('*');
      setNavPath(newPath);
    }

    // Show what user "pressed"
    const pressed = !sessionActive ? '*555#' : input;
    if (pressed) {
      setSessionLog((p) => [...p, { type: 'input', content: `⌨ Dialled: ${pressed}`, time: now() }]);
    }

    try {
      const res = await ussdApi.dial({ phoneNumber: phone, serviceCode: '*555#', text: textPath });
      const responseText: string = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      setDisplay(responseText.replace(/^(CON|END)\s?/, ''));
      setApiConnected(true);

      if (responseText.startsWith('CON')) {
        setSessionActive(true);
      } else {
        setSessionActive(false);
        setNavPath([]);
      }

      setSessionLog((p) => [
        ...p,
        { type: 'response', content: responseText.replace(/^(CON|END)\s?/, ''), time: now() },
      ]);
    } catch {
      // Offline fallback — use client-side menu tree
      setApiConnected(false);
      const pathKey = !sessionActive ? '' : newPath.join('*');
      const fallback = getOfflineResponse(pathKey);
      const text = fallback.replace(/^(CON|END)\s?/, '');
      setDisplay(text);

      if (fallback.startsWith('CON')) {
        setSessionActive(true);
      } else {
        setSessionActive(false);
        setNavPath([]);
      }

      setSessionLog((p) => [...p, { type: 'response', content: text, time: now() }]);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setSessionActive(false);
    setNavPath([]);
    setDisplay('');
    setSessionLog([]);
    setApiConnected(null);
  };

  const keys = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['*', '0', '#'],
  ];

  const keyLabels: Record<string, string> = {
    '1': 'Status', '2': 'Book', '3': 'Late+15',
    '4': 'MSP', '5': 'JKL', '6': 'MNO',
    '7': 'PQRS', '8': 'TUV', '9': 'Officer',
    '*': 'Back', '0': 'Menu', '#': 'Help',
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-gov-navy text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Smartphone className="w-5 h-5 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
                Feature Phone Demo — Zero Internet Required
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">
              *555# USSD किसान सेवा सिम्युलेटर
            </h1>
            <p className="text-sm text-primary-100 mt-1">
              Shows how a farmer on a basic 2G phone with no smartphone or internet can access
              queue status, MSP rates, and slot info — using only the *555# USSD code.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* API status badge */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              apiConnected === true
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-300'
                : apiConnected === false
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-300'
                : 'bg-slate-500/20 border-slate-400/30 text-slate-300'
            }`}>
              <Wifi className="w-3 h-3" />
              {apiConnected === true ? 'Live API' : apiConnected === false ? 'Offline Mode (demo tree)' : 'Not dialled yet'}
            </div>

            {/* Language Selector */}
            <div className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-primary-200" />
              <select
                value={lang}
                onChange={(e) => { reset(); setLang(e.target.value as any); }}
                className="bg-white/10 text-white text-xs font-bold rounded px-2 py-1 border border-white/20 cursor-pointer"
                aria-label="USSD menu language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-gray-900">
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ──────────── LEFT: Nokia Phone Frame ──────────── */}
        <div className="lg:col-span-5 flex justify-center">
          <div className="relative select-none" style={{ width: 240 }}>
            {/* Phone body */}
            <div
              className="relative mx-auto rounded-[2.5rem] shadow-2xl border-4 border-gray-700"
              style={{
                background: 'linear-gradient(160deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
                width: 240,
                minHeight: 460,
                padding: '16px 16px 20px',
              }}
            >
              {/* Top speaker grill */}
              <div className="flex justify-center mb-3">
                <div className="w-16 h-1.5 rounded-full bg-gray-600 opacity-60" />
              </div>

              {/* Carrier / signal bar */}
              <div
                className="flex items-center justify-between px-2 mb-1"
                style={{ fontSize: 9, color: '#9ca3af' }}
              >
                <span>Bharti Airtel</span>
                <div className="flex items-end gap-0.5 h-3">
                  {[3, 5, 7, 9, 11].map((h, i) => (
                    <div
                      key={i}
                      className="w-1 rounded-sm"
                      style={{ height: h, background: i < 4 ? '#34d399' : '#374151' }}
                    />
                  ))}
                </div>
              </div>

              {/* LCD Screen */}
              <div
                className="rounded-lg border-2 border-gray-600 p-3 mb-4 relative overflow-hidden"
                style={{
                  background: '#0a1628',
                  minHeight: 160,
                  fontFamily: "'Courier New', monospace",
                  boxShadow: 'inset 0 0 20px rgba(0,255,100,0.05)',
                }}
              >
                {/* Green phosphor glow overlay */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'radial-gradient(ellipse at center, rgba(0,255,80,0.04) 0%, transparent 70%)',
                  }}
                />

                {/* Screen content */}
                {!sessionActive && !display && !loading ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2">
                    <div
                      style={{ color: '#34d399', fontSize: 13, fontWeight: 700 }}
                      className="animate-pulse"
                    >
                      AnnSetu Kisan
                    </div>
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Dial *555# to start</div>
                  </div>
                ) : loading ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2">
                    <div
                      className="w-5 h-5 border-2 rounded-full animate-spin"
                      style={{ borderColor: '#34d399', borderTopColor: 'transparent' }}
                    />
                    <div style={{ color: '#6b7280', fontSize: 10 }}>Connecting...</div>
                  </div>
                ) : (
                  <pre
                    className="whitespace-pre-wrap break-words leading-snug"
                    style={{ color: '#34d399', fontSize: 11 }}
                  >
                    {display}
                  </pre>
                )}
              </div>

              {/* ── Dial *555# Button ── */}
              {!sessionActive ? (
                <button
                  onClick={() => dial()}
                  disabled={loading}
                  className="w-full py-2 rounded-xl font-black text-sm mb-3 transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: loading ? '#374151' : 'linear-gradient(135deg, #059669, #10b981)',
                    color: '#fff',
                    letterSpacing: '0.05em',
                    boxShadow: '0 4px 12px rgba(16,185,129,0.4)',
                  }}
                >
                  {loading ? 'Connecting...' : '⌨ Dial *555#'}
                </button>
              ) : (
                <button
                  onClick={reset}
                  disabled={loading}
                  className="w-full py-2 rounded-xl font-black text-sm mb-3 transition-all active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #b91c1c, #ef4444)',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
                  }}
                >
                  📵 End Session
                </button>
              )}

              {/* ── Numeric Keypad ── */}
              <div className="grid grid-cols-3 gap-2">
                {keys.flat().map((k) => (
                  <button
                    key={k}
                    onClick={() => sessionActive ? dial(k) : undefined}
                    disabled={!sessionActive || loading}
                    className="flex flex-col items-center justify-center py-2 rounded-lg border transition-all active:scale-90"
                    style={{
                      background: sessionActive ? '#1e293b' : '#111827',
                      borderColor: sessionActive ? '#334155' : '#1f2937',
                      cursor: sessionActive ? 'pointer' : 'not-allowed',
                      opacity: sessionActive ? 1 : 0.4,
                    }}
                    aria-label={`USSD key ${k}`}
                  >
                    <span style={{ color: sessionActive ? '#f9fafb' : '#6b7280', fontWeight: 700, fontSize: 16 }}>
                      {k}
                    </span>
                    <span style={{ color: '#6b7280', fontSize: 8, letterSpacing: '0.05em' }}>
                      {keyLabels[k]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Bottom chin */}
              <div className="flex justify-center mt-4">
                <div className="w-10 h-10 rounded-full border-2 border-gray-600 flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-gray-700" />
                </div>
              </div>
            </div>

            {/* Phone shadow */}
            <div
              className="absolute -bottom-4 left-1/2 -translate-x-1/2 rounded-full blur-xl opacity-40"
              style={{ width: 160, height: 20, background: '#10b981' }}
            />
          </div>
        </div>

        {/* ──────────── RIGHT: Session Log + Info ──────────── */}
        <div className="lg:col-span-7 space-y-4">
          {/* Session Transcript */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-800/60">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                USSD Session Transcript
              </span>
              <button
                onClick={reset}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="Reset session"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div
              ref={logRef}
              className="p-4 space-y-2 overflow-y-auto"
              style={{ minHeight: 200, maxHeight: 280, fontFamily: 'monospace' }}
            >
              {sessionLog.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Dial *555# using the phone to start a session
                </div>
              ) : (
                sessionLog.map((entry, i) => (
                  <div
                    key={i}
                    className={`text-xs px-3 py-2 rounded-lg ${
                      entry.type === 'input'
                        ? 'bg-amber-950/50 text-amber-300 border border-amber-700/30 ml-8 text-right'
                        : 'bg-slate-800 text-emerald-300 border border-slate-700 mr-8'
                    }`}
                  >
                    <div className="opacity-50 text-[10px] mb-0.5">
                      {entry.type === 'input' ? '📲 Farmer' : '📡 AnnSetu Gateway'} · {entry.time}
                    </div>
                    <pre className="whitespace-pre-wrap break-words">{entry.content}</pre>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Why USSD Matters — Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-blue-900">Why USSD? — The Inclusion Story</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  icon: <Users className="w-5 h-5 text-blue-600" />,
                  stat: '67 crore',
                  label: 'Indians on feature phones',
                  sub: 'No smartphone, no app possible',
                },
                {
                  icon: <Wifi className="w-5 h-5 text-amber-600" />,
                  stat: '0 bytes',
                  label: 'Internet data used by USSD',
                  sub: 'Works on 2G, even in remote mandis',
                },
                {
                  icon: <Zap className="w-5 h-5 text-emerald-600" />,
                  stat: '₹0',
                  label: 'Cost to farmer',
                  sub: 'Toll-free; charged to government account',
                },
              ].map((card, i) => (
                <div key={i} className="bg-white border border-blue-100 rounded-lg p-3 text-center shadow-sm">
                  <div className="flex justify-center mb-1">{card.icon}</div>
                  <div className="text-lg font-black text-gray-900">{card.stat}</div>
                  <div className="text-xs font-bold text-gray-700">{card.label}</div>
                  <div className="text-[10px] text-gray-500 mt-0.5">{card.sub}</div>
                </div>
              ))}
            </div>

            <div className="text-xs text-blue-800 bg-blue-100/60 rounded-lg p-3 space-y-1">
              <div>
                <span className="font-bold">How USSD works:</span> A farmer dials{' '}
                <span className="font-mono font-bold">*555#</span> on any GSM phone. The carrier
                routes the session to AnnSetu's USSD gateway over the SS7 signaling channel — no
                data plan, no app, no literacy barrier. The farmer navigates a text menu with
                numeric keypresses.
              </div>
              <div>
                <span className="font-bold">Production integration:</span> Africa's Talking USSD
                Gateway / NPCI *99# National USSD Platform. Session is stateful (carrier session
                ID) and terminates with "END" response.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Menu Tree Reference Card */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-bold text-gray-900">*555# Menu Tree — Quick Reference</h3>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { key: 'Key 1', label: 'Token & Queue Status', detail: 'Live position, wait time, current status', color: 'emerald' },
            { key: 'Key 2', label: 'Book / Reschedule Slot', detail: 'Directs to portal or agent for booking', color: 'blue' },
            { key: 'Key 3', label: 'Running Late (+15 min)', detail: 'Grants grace period; queue preserved', color: 'amber' },
            { key: 'Key 4', label: 'Today\'s MSP Rates', detail: 'Govt-notified rates for 5 major crops', color: 'purple' },
          ].map((item) => (
            <div
              key={item.key}
              className={`p-3 rounded-lg border bg-${item.color}-50 border-${item.color}-200`}
            >
              <div className={`text-xs font-black text-${item.color}-700 mb-1`}>{item.key}</div>
              <div className={`font-bold text-${item.color}-900 mb-0.5`}>{item.label}</div>
              <div className="text-gray-600 text-[10px]">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
