import { useState, useEffect, useRef } from 'react';
import {
  Phone,
  PhoneCall,
  PhoneOff,
  Radio,
  Volume2,
  VolumeX,
  Smartphone,
  Play,
  Square,
  RotateCcw,
  Sparkles,
  X,
  Clock,
  ShieldCheck,
  Languages,
  Headphones,
  BellRing
} from 'lucide-react';
import { ussdApi, ivrApi } from '../services/api';
import { speakText } from '../utils/i18n';
import { useAuth } from '../hooks/useAuth';
import toast from 'react-hot-toast';

interface HelplineModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'ivr' | 'ussd' | 'voice_updates';
}

interface VoiceAlert {
  id: number;
  type: string;
  title: string;
  transcript: string;
  timestamp: string;
  duration: string;
  lang: string;
  status: string;
}

export default function HelplineModal({ isOpen, onClose, defaultTab = 'ivr' }: HelplineModalProps) {
  const { farmer } = useAuth();
  const [activeTab, setActiveTab] = useState<'ivr' | 'ussd' | 'voice_updates'>(defaultTab);

  // Synchronize defaultTab if changed
  useEffect(() => {
    if (isOpen) {
      setActiveTab(defaultTab);
    }
  }, [isOpen, defaultTab]);

  // ==========================================
  // 1. IVR VOICE HELPLINE STATE
  // ==========================================
  const [callActive, setCallActive] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [ivrSpeech, setIvrSpeech] = useState('');
  const [ivrStep, setIvrStep] = useState('IDLE');
  const [allowedKeys, setAllowedKeys] = useState<string[]>([]);
  const [ivrHistory, setIvrHistory] = useState<{ sender: 'ivr' | 'farmer'; text: string; time: string }[]>([]);
  const [ivrLang, setIvrLang] = useState('hi');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const callTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Call timer effect
  useEffect(() => {
    if (callActive) {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [callActive]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const playVoicePrompt = (text: string, langCode: string) => {
    if (!soundEnabled || !text) return;
    setIsSpeaking(true);
    const langMap: Record<string, string> = {
      hi: 'hi-IN',
      pa: 'pa-IN',
      mr: 'mr-IN',
      en: 'en-IN',
    };
    try {
      speakText(text, langMap[langCode] || 'hi-IN');
    } catch (err) {
      console.warn('Speech synthesis unavailable or blocked:', err);
    }
    // Approximate duration or speech end
    setTimeout(() => {
      setIsSpeaking(false);
    }, Math.max(3000, (text?.length || 0) * 75));
  };

  const startIvrCall = async () => {
    setCallActive(true);
    setIvrStep('CONNECTING');
    setIvrHistory([]);

    const phone = farmer?.mobile || '9876543210';
    try {
      const res = await ivrApi.call({ caller_phone: phone, digits: '', language: ivrLang, step: 'CONNECTING' });
      const data = res.data;
      const speech = data.audio_speech || data.message || 'Connecting to AnnSetu IVR Gateway...';
      setIvrStep(data.step || 'LANGUAGE_SELECTION');
      setIvrSpeech(speech);
      setAllowedKeys(data.allowed_keys || ['1', '2', '3', '4']);
      setIvrHistory([{ sender: 'ivr', text: speech, time: 'Just now' }]);
      playVoicePrompt(speech, ivrLang);
    } catch (e: any) {
      console.error('IVR connection failure:', e);
      toast.error('Could not connect to Toll-Free IVR gateway.');
      setCallActive(false);
    }
  };

  const endIvrCall = () => {
    setCallActive(false);
    setIvrStep('IDLE');
    setIvrSpeech('');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    toast('Call ended. किसान कॉल समाप्त हुई।', { icon: '📞' });
  };

  const sendIvrDigit = async (digit: string) => {
    if (!callActive) return;

    // Add farmer's keypress to history
    setIvrHistory((prev) => [...prev, { sender: 'farmer', text: `Pressed Key [ ${digit} ]`, time: 'Just now' }]);

    const phone = farmer?.mobile || '9876543210';
    try {
      const res = await ivrApi.call({ caller_phone: phone, digits: digit, language: ivrLang, step: ivrStep });
      const data = res.data;
      if (data.language) setIvrLang(data.language);
      const speech = data.audio_speech || data.message || '';
      setIvrStep(data.step || 'MAIN_MENU');
      setIvrSpeech(speech);
      setAllowedKeys(data.allowed_keys || []);
      setIvrHistory((prev) => [...prev, { sender: 'ivr', text: speech, time: 'Just now' }]);
      playVoicePrompt(speech, data.language || ivrLang);
    } catch (e) {
      console.error('IVR DTMF error:', e);
      toast.error('DTMF transmission error');
    }
  };

  // ==========================================
  // 2. USSD (*555#) FEATURE PHONE STATE
  // ==========================================
  const [ussdDisplay, setUssdDisplay] = useState<string>('Ready. Dial *555# for AnnSetu Kisan Seva');
  const [ussdInput, setUssdInput] = useState<string>('*555#');
  const [ussdSessionActive, setUssdSessionActive] = useState<boolean>(false);
  const [ussdPath, setUssdPath] = useState<string[]>([]);
  const [ussdLoading, setUssdLoading] = useState<boolean>(false);

  const dialUssd = async (rawCode?: string) => {
    const code = rawCode !== undefined ? rawCode : ussdInput;
    if (!code.trim()) return;

    setUssdLoading(true);
    const phone = farmer?.mobile || '9876543210';

    try {
      let textToSend = '';
      if (!ussdSessionActive) {
        // First dial
        textToSend = '';
        setUssdPath([]);
      } else {
        const nextSteps = [...ussdPath, code];
        textToSend = nextSteps.join('*');
        setUssdPath(nextSteps);
      }

      const res = await ussdApi.dial({
        phoneNumber: phone,
        serviceCode: '*555#',
        text: textToSend,
      });

      const responseText: string = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      setUssdDisplay(responseText);

      if (responseText.startsWith('CON')) {
        setUssdSessionActive(true);
        setUssdInput('');
      } else {
        // END session
        setUssdSessionActive(false);
        setUssdInput('*555#');
        setUssdPath([]);
      }
    } catch (err: any) {
      setUssdDisplay('END Network Connection Error. Please retry later.');
      setUssdSessionActive(false);
      setUssdInput('*555#');
      setUssdPath([]);
    } finally {
      setUssdLoading(false);
    }
  };

  const resetUssd = () => {
    setUssdSessionActive(false);
    setUssdInput('*555#');
    setUssdPath([]);
    setUssdDisplay('Ready. Dial *555# for AnnSetu Kisan Seva');
  };

  // ==========================================
  // 3. RECORDED VOICE UPDATES INBOX (OBD)
  // ==========================================
  const [voiceAlerts, setVoiceAlerts] = useState<VoiceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [playingAlertId, setPlayingAlertId] = useState<number | null>(null);

  const fetchVoiceAlerts = async () => {
    setAlertsLoading(true);
    try {
      const res = await ivrApi.getAlerts({ mobile: farmer?.mobile || '9876543210' });
      setVoiceAlerts(res.data || []);
    } catch (e) {
      console.error('Failed to load voice alerts', e);
    } finally {
      setAlertsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'voice_updates') {
      fetchVoiceAlerts();
    }
  }, [isOpen, activeTab]);

  const togglePlayAlert = (alert: VoiceAlert) => {
    if (playingAlertId === alert.id) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setPlayingAlertId(null);
    } else {
      const textToSpeak = alert.transcript || (alert as any).message || (alert as any).content || alert.title || '';
      if (!textToSpeak) return;
      setPlayingAlertId(alert.id);
      try {
        speakText(textToSpeak, alert.lang || 'hi-IN');
      } catch (err) {
        console.warn('Voice alert speech error:', err);
      }
      setTimeout(() => {
        setPlayingAlertId(null);
      }, Math.max(4000, textToSpeak.length * 80));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 px-5 py-4 border-b border-emerald-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shadow-inner">
              <PhoneCall className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  टोल-फ्री किसान हेल्पलाइन एवं फीचर फोन सेवा
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <Radio className="w-3 h-3 animate-ping text-emerald-400" />
                  24x7 Active
                </span>
              </div>
              <p className="text-xs text-slate-300">
                0-Internet, 2G/3G & Low-Literacy Support • Toll-Free: 1800-180-SETU (7388) • USSD: *555#
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4 pt-2 gap-2">
          <button
            onClick={() => setActiveTab('ivr')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'ivr'
                ? 'border-emerald-400 bg-slate-900 text-emerald-300 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Phone className="w-4 h-4 text-emerald-400" />
            <span>📞 1800-180-SETU (IVR हेल्पलाइन)</span>
          </button>

          <button
            onClick={() => setActiveTab('ussd')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'ussd'
                ? 'border-amber-400 bg-slate-900 text-amber-300 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <Smartphone className="w-4 h-4 text-amber-400" />
            <span>📱 2G/3G USSD सिम्युलेटर (*555#)</span>
          </button>

          <button
            onClick={() => setActiveTab('voice_updates')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'voice_updates'
                ? 'border-blue-400 bg-slate-900 text-blue-300 shadow-sm'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/40'
            }`}
          >
            <BellRing className="w-4 h-4 text-blue-400" />
            <span>🎙️ वॉइस अपडेट्स (OBD Alerts)</span>
            {voiceAlerts.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] flex items-center justify-center font-bold">
                {voiceAlerts.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900/90 text-slate-200">
          {/* ========================================================= */}
          {/* TAB 1: 1800-180-SETU TOLL FREE IVR CALL SIMULATOR */}
          {/* ========================================================= */}
          {activeTab === 'ivr' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Call Monitor Screen */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                  {/* Glowing background halo when on call */}
                  {callActive && (
                    <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
                  )}

                  {/* Call Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          callActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-600'
                        }`}
                      />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        {callActive ? `Live Call • ${formatTimer(callDuration)}` : 'Helpline Ready • 1800-180-SETU'}
                      </span>
                    </div>

                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors"
                      title={soundEnabled ? 'Mute audio' : 'Unmute audio'}
                    >
                      {soundEnabled ? (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-[11px]">Audio On</span>
                        </>
                      ) : (
                        <>
                          <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-[11px]">Muted</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Visual Status Indicator */}
                  {!callActive ? (
                    <div className="py-8 text-center flex flex-col items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400 shadow-lg shadow-emerald-950">
                        <Phone className="w-9 h-9" />
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">
                        राष्ट्रीय किसान टोल-फ्री हेल्पलाइन (1800-180-SETU)
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mb-5 leading-relaxed">
                        स्मार्टफोन या इंटरनेट के बिना, केवल कॉल करके अपनी भाषा (हिंदी, पंजाबी, मराठी) में टोकन स्थिति, मंडी कतार और एमएसपी रेट सुनें।
                      </p>
                      <button
                        onClick={startIvrCall}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-emerald-900/50 hover:scale-[1.02] active:scale-[0.98] transition-all"
                      >
                        <PhoneCall className="w-4 h-4" />
                        कॉल शुरू करें (Dial 1800-180-SETU)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Audio waveform visualization */}
                      <div className="bg-slate-900/80 rounded-xl p-3.5 border border-emerald-500/20 flex items-center gap-3">
                        <div className="flex items-center gap-1 h-6 px-1">
                          {[40, 75, 100, 60, 90, 45, 80, 100, 50, 70].map((h, i) => (
                            <span
                              key={i}
                              className={`w-1 bg-emerald-400 rounded-full transition-all duration-300 ${
                                isSpeaking ? 'animate-pulse' : 'opacity-30'
                              }`}
                              style={{ height: isSpeaking ? `${h}%` : '25%' }}
                            />
                          ))}
                        </div>
                        <div className="flex-1 text-xs">
                          <span className="font-semibold text-emerald-300">
                            {isSpeaking ? 'बोल रहा है (Speaking Voice Prompt)...' : 'आपकी आवाज़ / की-प्रेस की प्रतीक्षा (Listening)...'}
                          </span>
                          <span className="block text-[11px] text-slate-400">
                            Caller: {farmer?.name || 'Farmer'} ({farmer?.mobile || '9876543210'})
                          </span>
                        </div>
                        {ivrSpeech && (
                          <button
                            onClick={() => playVoicePrompt(ivrSpeech, ivrLang)}
                            className="p-1.5 rounded-lg bg-emerald-900/50 hover:bg-emerald-800 text-emerald-200 text-xs flex items-center gap-1 border border-emerald-500/30"
                            title="Replay Audio Prompt"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="text-[10px]">फिर सुनें</span>
                          </button>
                        )}
                      </div>

                      {/* Current IVR Speech Prompt Box */}
                      <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 shadow-inner">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                            <Headphones className="w-3.5 h-3.5" />
                            IVR वॉयस प्रॉम्प्ट संदेश:
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200 font-mono">
                            STEP: {ivrStep}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-white leading-relaxed whitespace-pre-line">
                          "{ivrSpeech}"
                        </p>
                      </div>

                      {/* Call Transcript History */}
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {ivrHistory.map((item, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg text-xs leading-relaxed ${
                              item.sender === 'farmer'
                                ? 'bg-amber-950/40 text-amber-200 border border-amber-500/30 ml-8 text-right'
                                : 'bg-slate-900 text-slate-300 border border-slate-800 mr-8'
                            }`}
                          >
                            <span className="text-[10px] block opacity-60 font-mono">
                              {item.sender === 'farmer' ? 'आप (Farmer Input)' : 'हेल्पलाइन ऑपरेटर'}
                            </span>
                            {item.text}
                          </div>
                        ))}
                      </div>

                      {/* End Call Button */}
                      <div className="pt-2">
                        <button
                          onClick={endIvrCall}
                          className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-rose-950 transition-all"
                        >
                          <PhoneOff className="w-4 h-4" />
                          कॉल समाप्त करें (End Call)
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Features Pill Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-white block">मुफ्त कॉल (Toll-Free)</span>
                      <span className="text-[11px] text-slate-400">बिना बैलेंस कटे 24x7 उपलब्ध</span>
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center gap-2.5">
                    <Languages className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-white block">क्षेत्रीय भाषाएं</span>
                      <span className="text-[11px] text-slate-400">हिंदी, पंजाबी, मराठी, अंग्रेजी</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: In-Call DTMF Dialpad */}
              <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col items-center">
                <div className="w-full flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    फोन डायलपैड (DTMF Keypad)
                  </h4>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {callActive ? 'KEYS ENABLED' : 'DIAL TO ACTIVATE'}
                  </span>
                </div>

                {/* Dialpad Grid */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-4">
                  {[
                    { num: '1', sub: 'Status' },
                    { num: '2', sub: 'Book' },
                    { num: '3', sub: 'Late' },
                    { num: '4', sub: 'MSP' },
                    { num: '5', sub: 'JKL' },
                    { num: '6', sub: 'MNO' },
                    { num: '7', sub: 'PQRS' },
                    { num: '8', sub: 'TUV' },
                    { num: '9', sub: 'Operator' },
                    { num: '*', sub: 'Back' },
                    { num: '0', sub: 'Exit' },
                    { num: '#', sub: 'Help' },
                  ].map((btn) => {
                    const isKeyAllowed = callActive && (allowedKeys.length === 0 || allowedKeys.includes(btn.num));
                    return (
                      <button
                        key={btn.num}
                        disabled={!callActive}
                        onClick={() => sendIvrDigit(btn.num)}
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-150 ${
                          !callActive
                            ? 'bg-slate-900/50 border-slate-800 text-slate-600 cursor-not-allowed'
                            : isKeyAllowed
                            ? 'bg-gradient-to-b from-slate-800 to-slate-900 hover:from-emerald-900/60 hover:to-slate-800 border-slate-700 hover:border-emerald-500 text-white shadow-md active:scale-95'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <span className="text-lg font-bold group-hover:text-emerald-300 transition-colors">
                          {btn.num}
                        </span>
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 group-hover:text-emerald-200">
                          {btn.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Quick Option Shortcuts */}
                <div className="w-full bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    त्वरित विकल्प (Quick Menu Keys)
                  </span>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span>1. लाइव टोकन एवं कतार स्थिति</span>
                    <span className="font-mono text-emerald-400 font-bold">[ Key 1 ]</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span>2. खरीद स्लॉट बुक करें</span>
                    <span className="font-mono text-amber-400 font-bold">[ Key 2 ]</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span>3. देरी रिपोर्ट (+15 मिनट ग्रेस)</span>
                    <span className="font-mono text-blue-400 font-bold">[ Key 3 ]</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span>4. सरकारी एमएसपी दरें</span>
                    <span className="font-mono text-purple-400 font-bold">[ Key 4 ]</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-300 text-[11px]">
                    <span>9. मंडी अधिकारी से बात करें</span>
                    <span className="font-mono text-rose-400 font-bold">[ Key 9 ]</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 2: 2G/3G USSD (*555#) FEATURE PHONE SIMULATOR */}
          {/* ========================================================= */}
          {activeTab === 'ussd' && (
            <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-2">
              {/* Retro Feature Phone Handset (Nokia / JioBharat Style) */}
              <div className="w-full max-w-sm bg-gradient-to-b from-slate-800 to-slate-950 border-4 border-slate-700 rounded-[2.5rem] p-5 shadow-2xl shadow-emerald-950/40 relative">
                {/* Speaker Grill */}
                <div className="w-16 h-1.5 bg-slate-900 rounded-full mx-auto mb-4" />

                {/* Monochrome Retro LCD / OLED Screen */}
                <div className="bg-[#1e3422] border-2 border-[#2b4c30] rounded-xl p-4 shadow-inner font-mono text-[#78e88e] min-h-[190px] flex flex-col justify-between mb-4">
                  {/* Status Bar */}
                  <div className="flex items-center justify-between text-[10px] border-b border-[#2b4c30] pb-1 mb-2 text-[#56b068]">
                    <span>📶 2G GSM AnnSetu</span>
                    <span>🔋 98%</span>
                  </div>

                  {/* Main Screen Content */}
                  <div className="text-xs leading-relaxed whitespace-pre-line flex-1 overflow-y-auto">
                    {ussdLoading ? (
                      <div className="flex items-center gap-2 text-amber-300 py-4">
                        <span className="animate-spin">⌛</span> Connecting GSM gateway...
                      </div>
                    ) : (
                      ussdDisplay
                    )}
                  </div>

                  {/* USSD Input Bar */}
                  <div className="pt-2 border-t border-[#2b4c30] flex items-center gap-1.5">
                    <span className="text-xs text-[#56b068]">&gt;</span>
                    <input
                      type="text"
                      value={ussdInput}
                      onChange={(e) => setUssdInput(e.target.value)}
                      placeholder={ussdSessionActive ? 'Enter choice (e.g. 1)' : '*555#'}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') dialUssd();
                      }}
                      className="bg-transparent text-xs text-white font-bold w-full focus:outline-none placeholder:text-[#56b068]/50"
                    />
                  </div>
                </div>

                {/* Soft Keys (Send / Cancel) */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={() => dialUssd()}
                    disabled={ussdLoading}
                    className="py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    <span>{ussdSessionActive ? 'Send (भेजें)' : 'Dial (*555#)'}</span>
                  </button>
                  <button
                    onClick={resetUssd}
                    className="py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow active:scale-95"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span>End (समाप्त)</span>
                  </button>
                </div>

                {/* Tactile Keypad */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    '1',
                    '2',
                    '3',
                    '4',
                    '5',
                    '6',
                    '7',
                    '8',
                    '9',
                    '*',
                    '0',
                    '#',
                  ].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => {
                        if (!ussdSessionActive && ussdInput === '*555#') {
                          setUssdInput(digit);
                        } else {
                          setUssdInput((prev) => prev + digit);
                        }
                      }}
                      className="p-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-sm shadow active:scale-90 transition-transform"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Explanatory Guide Box */}
              <div className="max-w-md space-y-4">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm mb-2">
                    <Sparkles className="w-4 h-4" />
                    बिना इंटरनेट (0-Internet) के कैसे काम करता है?
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    देश के लाखों किसान भाइयों के पास स्मार्टफोन या डेटा पैक नहीं होता। अन्न सेतु का GSM 03.90 USSD गेटवे किसी भी साधारण नोकिया या 2जी/3जी कीपैड फोन पर सीधे टेलीकॉम टावर से काम करता है।
                  </p>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="font-bold text-amber-400 font-mono">*555#</span>
                      <span className="text-slate-300">डायल करने पर किसान का नाम और मुख्य मेनू स्क्रीन पर आता है।</span>
                    </div>
                    <div className="flex items-start gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="font-bold text-emerald-400 font-mono">1 भेजें:</span>
                      <span className="text-slate-300">आज का टोकन नंबर, मंडी नाम और आगे खड़े किसानों की संख्या तुरंत दिखती है।</span>
                    </div>
                    <div className="flex items-start gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="font-bold text-blue-400 font-mono">2 भेजें:</span>
                      <span className="text-slate-300">कल या परसों के लिए 1 घंटे का खरीद स्लॉट घर बैठे बुक करें।</span>
                    </div>
                    <div className="flex items-start gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                      <span className="font-bold text-rose-400 font-mono">3 भेजें:</span>
                      <span className="text-slate-300">ट्रैक्टर खराब होने पर 15 मिनट की अतिरिक्त देरी छूट प्राप्त करें।</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div className="text-xs">
                    <span className="font-bold text-white block">टेलीकॉम नेटवर्क एकीकृत</span>
                    <span className="text-slate-400">BSNL, Jio, Airtel, Vi सभी भारतीय नेटवर्कों पर निःशुल्क</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: RECORDED VOICE UPDATES INBOX (OBD BROADCASTS) */}
          {/* ========================================================= */}
          {activeTab === 'voice_updates' && (
            <div className="space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-400" />
                    ऑटोमेटेड वॉइस कॉल अलर्ट्स (Outbound Recorded Dialing)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    जब भी आपका टोकन बुलाया जाएगा या भुगतान खाते में जाएगा, किसान को यह वॉयस कॉल खुद-ब-खुद प्राप्त होगी।
                  </p>
                </div>

                <button
                  onClick={fetchVoiceAlerts}
                  disabled={alertsLoading}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 self-start sm:self-auto border border-slate-700"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${alertsLoading ? 'animate-spin' : ''}`} />
                  <span>रिफ्रेश संदेश (Refresh)</span>
                </button>
              </div>

              {/* Alerts List */}
              {alertsLoading ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  <span className="animate-spin text-lg inline-block mr-2">⌛</span>
                  वॉइस संदेश लोड हो रहे हैं...
                </div>
              ) : voiceAlerts.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800">
                  कोई नया वॉइस संदेश नहीं है।
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {voiceAlerts.map((alert) => {
                    const isPlaying = playingAlertId === alert.id;
                    return (
                      <div
                        key={alert.id}
                        className={`bg-slate-950 border rounded-xl p-4 shadow-lg transition-all ${
                          isPlaying
                            ? 'border-emerald-400 shadow-emerald-950/50 bg-slate-950/90'
                            : 'border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isPlaying
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-slate-800 text-emerald-400'
                              }`}
                            >
                              <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-bounce' : ''}`} />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">
                                {alert.title || (alert as any).notification_type || 'ऑडियो सूचना (Voice Alert)'}
                              </h4>
                              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                                <span>{alert.duration || '0:25'}</span>
                                <span>•</span>
                                <span>{alert.type || 'VOICE_OBD'}</span>
                              </div>
                            </div>
                          </div>

                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                            {alert.status || 'DELIVERED'}
                          </span>
                        </div>

                        {/* Transcript */}
                        <div className="bg-slate-900/80 rounded-lg p-3 border border-slate-800 mb-3">
                          <p className="text-xs text-slate-200 leading-relaxed italic">
                            "{alert.transcript || (alert as any).message || (alert as any).content || 'कोई वॉइस संदेश नहीं'}"
                          </p>
                        </div>

                        {/* Player Controls */}
                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>
                              {alert.timestamp || (alert as any).created_at
                                ? new Date(alert.timestamp || (alert as any).created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'Just now'}
                            </span>
                          </div>

                          <button
                            onClick={() => togglePlayAlert(alert)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow ${
                              isPlaying
                                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                          >
                            {isPlaying ? (
                              <>
                                <Square className="w-3.5 h-3.5 fill-current" />
                                <span>रोकें (Stop)</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>आवाज में सुनें (Listen)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="bg-slate-950 border-t border-slate-800 px-5 py-3 text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>विशेष सुविधा: अनपढ़ किसान भाइयों के लिए स्वचालित वॉयस और की-प्रेस सहायता प्रणाली</span>
          </div>
          <div className="text-[11px] text-emerald-400 font-mono font-semibold">
            Toll-Free 1800-180-7388 • USSD *555#
          </div>
        </div>
      </div>
    </div>
  );
}
