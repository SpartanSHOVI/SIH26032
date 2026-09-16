export interface Language {
  code: string;
  name: string;
  nativeName: string;
  speechCode: string;
  translationCode?: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', speechCode: 'en-IN' },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', speechCode: 'as-IN' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', speechCode: 'bn-IN' },
  { code: 'brx', name: 'Bodo', nativeName: 'बरʼ', speechCode: 'hi-IN' },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', speechCode: 'hi-IN' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', speechCode: 'gu-IN' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', speechCode: 'hi-IN' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', speechCode: 'kn-IN' },
  { code: 'ks', name: 'Kashmiri', nativeName: 'कश्मीरी', speechCode: 'hi-IN' },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', speechCode: 'hi-IN', translationCode: 'gom' },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', speechCode: 'hi-IN' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', speechCode: 'ml-IN' },
  { code: 'mni-Mtei', name: 'Manipuri', nativeName: 'মৈতৈলোন্', speechCode: 'hi-IN' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', speechCode: 'mr-IN' },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', speechCode: 'ne-NP' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', speechCode: 'or-IN' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', speechCode: 'pa-IN' },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', speechCode: 'hi-IN' },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', speechCode: 'hi-IN' },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي', speechCode: 'hi-IN' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', speechCode: 'ta-IN' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', speechCode: 'te-IN' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', speechCode: 'ur-IN' },
];

export function languageByCode(code: string) {
  return SUPPORTED_LANGUAGES.find((language) => language.code === code) ?? SUPPORTED_LANGUAGES[0];
}

/**
 * Transliterates Gurmukhi script (ਪੰਜਾਬੀ) into phonetic Devanagari (पंजाबी).
 * Browser TTS engines (e.g. Hindi `hi-IN` voices) only know Devanagari and Latin,
 * silently skipping Gurmukhi Unicode characters. This phonetic bridge ensures
 * that phrases like "ਪੰਜਾਬੀ ਲਈ 2 ਦਬਾਓ" are pronounced as "पंजाबी लई 2 दबाओ"
 * without skipping any language.
 */
export function gurmukhiToDevanagari(text: string): string {
  let res = text
    .replace(/\u0A38\u0A3C/g, 'श')
    .replace(/\u0A16\u0A3C/g, 'ख़')
    .replace(/\u0A17\u0A3C/g, 'ग़')
    .replace(/\u0A1C\u0A3C/g, 'ज़')
    .replace(/\u0A2B\u0A3C/g, 'फ़')
    .replace(/\u0A32\u0A3C/g, 'ळ')
    .replace(/[\u0A71]([\u0A15-\u0A39])/g, '$1\u0A4D$1');

  const map: Record<string, string> = {
    '\u0A05': 'अ', '\u0A06': 'आ', '\u0A07': 'इ', '\u0A08': 'ई', '\u0A09': 'उ', '\u0A0A': 'ऊ',
    '\u0A0F': 'ए', '\u0A10': 'ऐ', '\u0A13': 'ओ', '\u0A14': 'औ',
    '\u0A15': 'क', '\u0A16': 'ख', '\u0A17': 'ग', '\u0A18': 'घ', '\u0A19': 'ङ',
    '\u0A1A': 'च', '\u0A1B': 'छ', '\u0A1C': 'ज', '\u0A1D': 'झ', '\u0A1E': 'ञ',
    '\u0A1F': 'ट', '\u0A20': 'ठ', '\u0A21': 'ड', '\u0A22': 'ढ', '\u0A23': 'ण',
    '\u0A24': 'त', '\u0A25': 'थ', '\u0A26': 'द', '\u0A27': 'ध', '\u0A28': 'न',
    '\u0A2A': 'प', '\u0A2B': 'फ', '\u0A2C': 'ब', '\u0A2D': 'भ', '\u0A2E': 'म',
    '\u0A2F': 'य', '\u0A30': 'र', '\u0A32': 'ल', '\u0A33': 'ळ', '\u0A35': 'व',
    '\u0A36': 'श', '\u0A38': 'स', '\u0A39': 'ह',
    '\u0A3E': 'ा', '\u0A3F': 'ि', '\u0A40': 'ी', '\u0A41': 'ु', '\u0A42': 'ू',
    '\u0A47': 'े', '\u0A48': 'ै', '\u0A4B': 'ो', '\u0A4C': 'ौ', '\u0A4D': '्',
    '\u0A70': 'ं', '\u0A02': 'ं', '\u0A3C': '़', '\u0A71': '',
    '\u0A66': '0', '\u0A67': '1', '\u0A68': '2', '\u0A69': '3', '\u0A6A': '4',
    '\u0A6B': '5', '\u0A6C': '6', '\u0A6D': '7', '\u0A6E': '8', '\u0A6F': '9',
  };

  return res.replace(/[\u0A00-\u0A7F]/g, (ch) => map[ch] || ch);
}

export function formatTokenForSpeech(token: string): string {
  if (!token) return '';
  // Sanitize undefined, null, or accidental strings
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

  // Split into chunks by dashes, spaces, or dots
  const chunks = clean.split(/[-_\s.]+/).filter(Boolean);

  return chunks
    .map((chunk) => {
      // Spell out every character (digit or letter) individually
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

export async function speakText(text: string, lang = 'hi-IN'): Promise<void> {
  if (typeof window === 'undefined') return;

  // Clean out any stray 'undefined' or 'null' from text announcements
  let textToSpeak = text.replace(/-\s*undefined\b/gi, '').replace(/\bundefined\b/gi, '').trim();

  // Replace any token patterns like "Token AGM00550-260913-100062" or "token number XYZ..."
  textToSpeak = textToSpeak.replace(
    /(?:token(?:\s+number)?)\s+([A-Za-z0-9-_]+(?:\s*-\s*[A-Za-z0-9-_]+)*)/gi,
    (match, tokenStr) => {
      // Remove trailing punctuation from tokenStr
      const rawToken = tokenStr.replace(/[.,;:]+$/, '');
      const formatted = formatTokenForSpeech(rawToken);
      return `Token number ${formatted}.`;
    },
  );

  const langPrefix = lang.split('-')[0].toLowerCase();

  // 1. Try Bhashini Neural TTS Service via API proxy
  try {
    const ttsRes = await fetch('/api/v1/translate/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: textToSpeak,
        language: langPrefix,
        gender: 'female',
      }),
    });

    if (ttsRes.ok) {
      const data = await ttsRes.json();
      if (data?.audioContent) {
        const audio = new Audio(`data:audio/wav;base64,${data.audioContent}`);
        await audio.play();
        return;
      }
    }
  } catch {
    // Continue to browser Web Speech fallback
  }

  // 2. High-fidelity Browser SpeechSynthesis Fallback
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const voices = window.speechSynthesis.getVoices();
  const matchingVoice = voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix));

  let voiceLang = lang;

  // If text contains Gurmukhi script (e.g. Punjabi "ਪੰਜਾਬੀ ਲਈ 2 ਦਬਾਓ")
  if (/[\u0A00-\u0A7F]/.test(textToSpeak)) {
    const hasPunjabiVoice = voices.some((v) => v.lang.toLowerCase().startsWith('pa'));
    if (!hasPunjabiVoice || langPrefix !== 'pa') {
      textToSpeak = gurmukhiToDevanagari(textToSpeak);
      if (langPrefix === 'pa' && !hasPunjabiVoice) {
        voiceLang = 'hi-IN';
      }
    }
  }

  const utterance = new SpeechSynthesisUtterance(textToSpeak);
  utterance.lang = voiceLang;
  if (matchingVoice && voiceLang === lang) {
    utterance.voice = matchingVoice;
  }
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

