export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી' },
];

export const TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    'platform_name': 'AnnSetu',
    'tagline': 'Smart Farmer Procurement & Queue Platform',
    'farmer_portal': 'Farmer Portal',
    'center_operator': 'Center Operator',
    'admin_command': 'Admin Dashboard',
    'dashboard': 'Dashboard',
    'book_slot': 'Book Slot',
    'live_queue': 'Live Queue',
    'payment_status': 'Payment Status',
    'profile': 'Profile',
    'call_next': 'Call Next Farmer',
    'running_late': 'Running Late (+15m)',
    'farmers_ahead': 'Farmers Ahead',
    'est_wait': 'Estimated Wait',
    'current_token': 'Now Serving',
    'today_tokens': "Today's Bookings",
    'completed': 'Completed',
    'waiting': 'Waiting',
    'processing': 'Processing',
    'rejected': 'Rejected',
  },
  hi: {
    'platform_name': 'अन्न सेतु',
    'tagline': 'स्मार्ट किसान खरीद और कतार प्रबंधन मंच',
    'farmer_portal': 'किसान पोर्टल',
    'center_operator': 'खरीद केंद्र ऑपरेटर',
    'admin_command': 'प्रशासन डैशबोर्ड',
    'dashboard': 'डैशबोर्ड',
    'book_slot': 'स्लॉट बुक करें',
    'live_queue': 'लाइव कतार',
    'payment_status': 'भुगतान स्थिति',
    'profile': 'प्रोफ़ाइल',
    'call_next': 'अगले किसान को बुलाएं',
    'running_late': 'देरी हो रही है (+15 मिनट)',
    'farmers_ahead': 'आपसे आगे किसान',
    'est_wait': 'अनुमानित प्रतीक्षा',
    'current_token': 'वर्तमान टोकन',
    'today_tokens': 'आज की बुकिंग',
    'completed': 'पूर्ण',
    'waiting': 'प्रतीक्षारत',
    'processing': 'जांच जारी',
    'rejected': 'अस्वीकृत',
  },
  pa: {
    'platform_name': 'ਅੰਨ ਸੇਤੂ',
    'tagline': 'ਸਮਾਰਟ ਕਿਸਾਨ ਖਰੀਦ ਅਤੇ ਕਤਾਰ ਪਲੇਟਫਾਰਮ',
    'farmer_portal': 'ਕਿਸਾਨ ਪੋਰਟਲ',
    'center_operator': 'ਮੰਡੀ ਆਪਰੇਟਰ',
    'admin_command': 'ਐਡਮਿਨ ਡੈਸ਼ਬੋਰਡ',
    'dashboard': 'ਡੈਸ਼ਬੋਰਡ',
    'book_slot': 'ਸਲਾਟ ਬੁੱਕ ਕਰੋ',
    'live_queue': 'ਲਾਈਵ ਕਤਾਰ',
    'payment_status': 'ਭੁਗਤਾਨ ਸਥਿਤੀ',
    'profile': 'ਪ੍ਰੋਫਾਈਲ',
    'call_next': 'ਅਗਲੇ ਕਿਸਾਨ ਨੂੰ ਬੁਲਾਓ',
    'running_late': 'ਦੇਰ ਹੋ ਰਹੀ ਹੈ (+15 ਮਿੰਟ)',
    'farmers_ahead': 'ਤੁਹਾਡੇ ਤੋਂ ਅੱਗੇ ਕਿਸਾਨ',
    'est_wait': 'ਅੰਦਾਜ਼ਨ ਇੰਤਜ਼ਾਰ',
    'current_token': 'ਮੌਜੂਦਾ ਟੋਕਨ',
    'today_tokens': 'ਅੱਜ ਦੀਆਂ ਬੁਕਿੰਗਾਂ',
    'completed': 'ਸੰਪੰਨ',
    'waiting': 'ਉਡੀਕ ਵਿਚ',
    'processing': 'ਪੜਤਾਲ ਜਾਰੀ',
    'rejected': 'ਰੱਦ',
  },
  mr: {
    'platform_name': 'अन्न सेतू',
    'tagline': 'स्मार्ट शेतकरी खरेदी आणि रांग व्यवस्थापन',
    'farmer_portal': 'शेतकरी पोर्टल',
    'center_operator': 'केंद्र ऑपरेटर',
    'admin_command': 'प्रशासक डॅशबोर्ड',
    'dashboard': 'डॅशबोर्ड',
    'book_slot': 'स्लॉट बुक करा',
    'live_queue': 'थेट रांग',
    'payment_status': 'पेमेंट स्थिती',
    'profile': 'माझी माहिती',
    'call_next': 'पुढील शेतकऱ्याला बोलवा',
    'running_late': 'उशीर होत आहे (+15 मिनिटे)',
    'farmers_ahead': 'तुमच्या पुढे शेतकरी',
    'est_wait': 'अंदाजे वेळ',
    'current_token': 'सध्या चालू टोकन',
    'today_tokens': 'आजचे टोकन',
    'completed': 'पूर्ण झाले',
    'waiting': 'प्रतीक्षेत',
    'processing': 'तपासणी सुरू',
    'rejected': 'नाकारले',
  }
};

export function t(key: string, lang = 'en'): string {
  if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key]) {
    return TRANSLATIONS[lang][key];
  }
  if (TRANSLATIONS['en'] && TRANSLATIONS['en'][key]) {
    return TRANSLATIONS['en'][key];
  }
  return key;
}

export function formatTokenForSpeech(token: string): string {
  if (!token) return '';
  const clean = token.replace(/undefined|null/gi, '').trim();
  if (!clean) return '';

  const digitWords: Record<string, string> = {
    '0': 'zero',
    '1': 'one',
    '2': 'two',
    '3': 'three',
    '4': 'four',
    '5': 'five',
    '6': 'six',
    '7': 'seven',
    '8': 'eight',
    '9': 'nine',
  };

  const chunks = clean.split(/[-_\s.]+/).filter(Boolean);

  return chunks
    .map((chunk) => {
      return chunk
        .split('')
        .map((char) => {
          if (digitWords[char]) return digitWords[char];
          if (/[a-zA-Z]/.test(char)) return char.toUpperCase();
          return '';
        })
        .filter(Boolean)
        .join(' ');
    })
    .join('. ');
}

export function speakText(text: string, lang = 'hi-IN'): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  let textToSpeak = text.replace(/-\s*undefined\b/gi, '').replace(/\bundefined\b/gi, '').trim();

  textToSpeak = textToSpeak.replace(
    /(?:token(?:\s+number)?)\s+([A-Za-z0-9-_]+(?:\s*-\s*[A-Za-z0-9-_]+)*)/gi,
    (match, tokenStr) => {
      const rawToken = tokenStr.replace(/[.,;:]+$/, '');
      const formatted = formatTokenForSpeech(rawToken);
      return `Token number ${formatted}.`;
    },
  );

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = lang;
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}
