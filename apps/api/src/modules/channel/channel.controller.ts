import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/access';
import { DatabaseService, first, rows } from '../../infrastructure/database/database.service';

const IVR_PROMPTS = {
  hi: {
    welcome:
      'अन्न सेतु राष्ट्रीय किसान हेल्पलाइन में आपका स्वागत है। हिंदी के लिए 1 दबाएं। ਪੰਜਾਬੀ ਲਈ 2 ਦਬਾਓ। मराठीसाठी 3 दाबा। For English, press 4.',
    mainMenu: (name: string) =>
      `नमस्ते ${name} जी। अपने टोकन और मंडी लाइन की लाइव स्थिति जानने के लिए 1 दबाएं। नया खरीद स्लॉट बुक करने के लिए 2 दबाएं। यदि आपको मंडी पहुंचने में देरी हो रही है और 15 मिनट की छूट चाहिए तो 3 दबाएं। आज के सरकारी न्यूनतम समर्थन मूल्य यानी एमएसपी जानने के लिए 4 दबाएं। मंडी सहायता अधिकारी से बात करने के लिए 9 दबाएं।`,
    noToken:
      'आपके नाम पर आज कोई सक्रिय टोकन नहीं है। नया स्लॉट बुक करने के लिए 2 दबाएं या अधिकारी से बात करने के लिए 9 दबाएं। मुख्य मेनू के लिए 0 दबाएं।',
    tokenStatus: (tokenNum: string, centerName: string, ahead: number, waitMin: number, status: string) =>
      `आपका टोकन नंबर ${tokenNum} है। ${centerName} में आपके आगे ${ahead} किसान हैं। अनुमानित प्रतीक्षा समय लगभग ${waitMin} मिनट है। आपकी स्थिति ${status} है। मुख्य मेनू के लिए 0 दबाएं।`,
    slotBooking: (centerName: string) =>
      `${centerName} में खरीद स्लॉट उपलब्ध हैं। स्लॉट बुक करने और पुष्टि के लिए 9 दबाकर मंडी सहायता अधिकारी से बात करें अथवा अन्न सेतु पोर्टल का उपयोग करें। मुख्य मेनू के लिए 0 दबाएं।`,
    graceGranted: (graceUntil: string) =>
      `आपकी 15 मिनट की छूट स्वीकार कर ली गई है। अब आप ${graceUntil} तक मंडी में प्रवेश कर सकते हैं। आपकी कतार स्थिति सुरक्षित है। मुख्य मेनू के लिए 0 दबाएं।`,
    mspRates:
      'भारत सरकार द्वारा निर्धारित आज के न्यूनतम समर्थन मूल्य हैं: गेहूं ₹2275 प्रति क्विंटल। धान ₹2183 प्रति क्विंटल। सरसों ₹5650 प्रति क्विंटल। चना ₹5440 प्रति क्विंटल। सोयाबीन ₹4600 प्रति क्विंटल। भुगतान सीधे डीबीटी बैंक खाते में होगा। मुख्य मेनू के लिए 0 दबाएं।',
    agentConnect: 'आपकी कॉल मंडी नोडल अधिकारी से जोड़ी जा रही है। कृपया लाइन पर बने रहें।',
    invalidInput: 'गलत बटन दबाया गया है।',
  },
  pa: {
    welcome:
      'ਅੰਨ ਸੇਤੂ ਰਾਸ਼ਟਰੀ ਕਿਸਾਨ ਹੈਲਪਲਾਈਨ ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਹਿੰਦੀ ਲਈ 1, ਪੰਜਾਬੀ ਲਈ 2, ਮਰਾਠੀ ਲਈ 3, ਅੰਗਰੇਜ਼ੀ ਲਈ 4 ਦਬਾਓ।',
    mainMenu: (name: string) =>
      `ਸਤਿ ਸ਼੍ਰੀ ਅਕਾਲ ${name} ਜੀ। ਆਪਣੇ ਟੋਕਨ ਅਤੇ ਮੰਡੀ ਲਾਈਨ ਦੀ ਲਾਈਵ ਸਥਿਤੀ ਜਾਣਨ ਲਈ 1 ਦਬਾਓ। ਨਵਾਂ ਸਲਾਟ ਬੁੱਕ ਕਰਨ ਲਈ 2 ਦਬਾਓ। ਜੇਕਰ ਦੇਰ ਹੋ ਰਹੀ ਹੈ ਅਤੇ 15 ਮਿੰਟ ਦੀ ਛੋਟ ਚਾਹੁੰਦੇ ਹੋ ਤਾਂ 3 ਦਬਾਓ। ਅੱਜ ਦਾ ਸਰਕਾਰੀ ਐਮਐਸਪੀ ਜਾਣਨ ਲਈ 4 ਦਬਾਓ। ਮੰਡੀ ਅਧਿਕਾਰੀ ਨਾਲ ਗੱਲ ਕਰਨ ਲਈ 9 ਦਬਾਓ।`,
    noToken: 'ਤੁਹਾਡੇ ਨਾਮ ਤੇ ਅੱਜ ਕੋਈ ਸਰਗਰਮ ਟੋਕਨ ਨਹੀਂ ਹੈ। ਨਵਾਂ ਸਲਾਟ ਬੁੱਕ ਕਰਨ ਲਈ 2 ਦਬਾਓ। ਮੁੱਖ ਮੇਨੂ ਲਈ 0 ਦਬਾਓ।',
    tokenStatus: (tokenNum: string, centerName: string, ahead: number, waitMin: number, status: string) =>
      `ਤੁਹਾਡਾ ਟੋਕਨ ਨੰਬਰ ${tokenNum} ਹੈ। ਮੰਡੀ ${centerName} ਵਿਖੇ ਤੁਹਾਡੇ ਤੋਂ ਅੱਗੇ ${ahead} ਕਿਸਾਨ ਹਨ। ਅੰਦਾਜ਼ਨ ਸਮਾਂ ${waitMin} ਮਿੰਟ ਹੈ। ਤੁਹਾਡੀ ਸਥਿਤੀ ${status} ਹੈ।`,
    slotBooking: (centerName: string) =>
      `ਮੰਡੀ ${centerName} ਵਿਖੇ ਸਲਾਟ ਉਪਲਬਧ ਹਨ। ਬੁਕਿੰਗ ਲਈ 9 ਦਬਾ ਕੇ ਅਧਿਕਾਰੀ ਨਾਲ ਗੱਲ ਕਰੋ। ਮੁੱਖ ਮੇਨੂ ਲਈ 0 ਦਬਾਓ।`,
    graceGranted: (graceUntil: string) =>
      `ਤੁਹਾਡੀ 15 ਮਿੰਟ ਦੀ ਛੋਟ ਸਵੀਕਾਰ ਕਰ ਲਈ ਗਈ ਹੈ। ਤੁਹਾਡੀ ਕਤਾਰ ਸੁਰੱਖਿਅਤ ਹੈ। ਮੁੱਖ ਮੇਨੂ ਲਈ 0 ਦਬਾਓ।`,
    mspRates:
      'ਮੌਜੂਦਾ ਸਰਕਾਰੀ ਐਮਐਸਪੀ ਦਰਾਂ ਹਨ: ਕਣਕ ₹2275 ਪ੍ਰਤੀ ਕੁਇੰਟਲ। ਝੋਨਾ ₹2183 ਪ੍ਰਤੀ ਕੁਇੰਟਲ। ਸਰ੍ਹੋਂ ₹5650 ਪ੍ਰਤੀ ਕੁਇੰਟਲ। ਚਨਾ ₹5440 ਪ੍ਰਤੀ ਕੁਇੰਟਲ। ਮੁੱਖ ਮੇਨੂ ਲਈ 0 ਦਬਾਓ।',
    agentConnect: 'ਤੁਹਾਡੀ ਕਾਲ ਮੰਡੀ ਨੋਡਲ ਅਧਿਕਾਰੀ ਨਾਲ ਜੋੜੀ ਜਾ ਰਹੀ ਹੈ। ਕਿਰਪਾ ਕਰਕੇ ਲਾਈਨ ਤੇ ਬਣੇ ਰਹੋ।',
    invalidInput: 'ਗਲਤ ਬਟਨ ਦਬਾਇਆ ਗਿਆ ਹੈ।',
  },
  mr: {
    welcome:
      'अन्न सेतु राष्ट्रीय शेतकरी हेल्पलाईन मध्ये आपले स्वागत आहे. हिंदीसाठी 1, पंजाबीसाठी 2, मराठीसाठी 3, इंग्रजीसाठी 4 दाबा.',
    mainMenu: (name: string) =>
      `नमस्कार ${name} जी. आपल्या टोकन आणि थेट रांगेची स्थिती जाणून घेण्यासाठी 1 दाबा. नवीन स्लॉट बुक करण्यासाठी 2 दाबा. उशीर होत असल्यास 15 मिनिटांची सवलत मिळवण्यासाठी 3 दाबा. आजचे हमीभाव म्हणजेच एमएसपी जाणून घेण्यासाठी 4 दाबा. मंडी अधिकाऱ्याशी बोलण्यासाठी 9 दाबा.`,
    noToken: 'आपल्या नावावर आज कोणतेही सक्रिय टोकन नाही. नवीन स्लॉट बुक करण्यासाठी 2 दाबा. मुख्य मेनूसाठी 0 दाबा.',
    tokenStatus: (tokenNum: string, centerName: string, ahead: number, waitMin: number, status: string) =>
      `आपला टोकन क्रमांक ${tokenNum} आहे. ${centerName} मंडीमध्ये आपल्या पुढे ${ahead} शेतकरी आहेत. अंदाजे वेळ ${waitMin} मिनिटे आहे. आपली सद्य स्थिती ${status} आहे.`,
    slotBooking: (centerName: string) =>
      `${centerName} मंडीमध्ये स्लॉट उपलब्ध आहेत. बुकिंगसाठी 9 दाबा किंवा पोर्टल वापरा. मुख्य मेनूसाठी 0 दाबा.`,
    graceGranted: (graceUntil: string) =>
      `आपली 15 मिनिटांची सवलत मंजूर झाली आहे. आपली रांगेतील स्थिती सुरक्षित आहे. मुख्य मेनूसाठी 0 दाबा.`,
    mspRates:
      'भारत सरकारचे सध्याचे किमान हमीभाव: गहू ₹2275 प्रति क्विंटल. भात ₹2183 प्रति क्विंटल. मोहरी ₹5650 प्रति क्विंटल. हरभरा ₹5440 प्रति क्विंटल. सोयाबीन ₹4600 प्रति क्विंटल. मुख्य मेनूसाठी 0 दाबा.',
    agentConnect: 'आपला कॉल मंडी नोडल अधिकाऱ्याशी जोडला जात आहे. कृपया प्रतीक्षा करा.',
    invalidInput: 'चुकीचे बटण दाबले गेले आहे.',
  },
  en: {
    welcome:
      'Welcome to AnnSetu National Farmer Helpline. For Hindi press 1. For Punjabi press 2. For Marathi press 3. For English press 4.',
    mainMenu: (name: string) =>
      `Welcome ${name}. Press 1 for live token and queue status. Press 2 to book a procurement slot. Press 3 for a 15-minute late arrival grace period. Press 4 for current statutory MSP rates. Press 9 to speak with our Mandi Helpdesk Officer.`,
    noToken:
      'No active token found for your account today. Press 2 to book or 9 for an officer. Press 0 for Main Menu.',
    tokenStatus: (tokenNum: string, centerName: string, ahead: number, waitMin: number, status: string) =>
      `Your token number is ${tokenNum}. At ${centerName}, there are ${ahead} farmers ahead of you. Estimated waiting time is ${waitMin} minutes. Current status is ${status}. Press 0 for Main Menu.`,
    slotBooking: (centerName: string) =>
      `Procurement slots are open at ${centerName}. Press 9 to speak with an officer to confirm booking or visit the AnnSetu portal. Press 0 for Main Menu.`,
    graceGranted: (graceUntil: string) =>
      `Your 15-minute late arrival grace period has been granted until ${graceUntil}. Your queue position is protected. Press 0 for Main Menu.`,
    mspRates:
      'Current Government Statutory MSP Rates: Wheat is ₹2,275 per quintal. Paddy is ₹2,183 per quintal. Mustard is ₹5,650 per quintal. Chana Gram is ₹5,440 per quintal. Soybean is ₹4,600 per quintal. Direct DBT transfer to your verified bank account. Press 0 for Main Menu.',
    agentConnect: 'Connecting your call to the Mandi Nodal Officer. Please hold the line.',
    invalidInput: 'Invalid option pressed. Please try again.',
  },
};

/**
 * Phonetically transliterates Gurmukhi text into Devanagari.
 * Standard Hindi TTS voices only speak Devanagari and Latin characters, silently
 * skipping Gurmukhi characters (e.g. skipping "ਪੰਜਾਬੀ ਲਈ 2 ਦਬਾਓ"). This phonetic bridge
 * ensures phrases are pronounced as "पंजाबी लई 2 दबाओ" without skipping.
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

@Controller()
export class ChannelController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Public()
  @Post('ussd')
  async ussd(@Body() body: Record<string, any>) {
    const mobile = String(body.phoneNumber ?? body.mobile ?? '').replace(/^\+91/, '').trim();
    const text = String(body.text ?? '').trim();
    const latest = mobile
      ? await first<{ token_number: string; status: string }>(
          this.db,
          `select t.token_number, t.status from tokens t join farmers f on f.id = t.farmer_id where f.mobile = $1 order by t.created_at desc limit 1`,
          mobile,
        )
      : null;
    if (!text) return 'CON Welcome to AnnSetu\n1. Check token\n2. Payment status\n3. Statutory MSP Rates';
    if (text === '1') return latest ? `END Token ${latest.token_number}: ${latest.status}` : 'END No token found for this phone.';
    if (text === '2') return latest ? `END Payment status: ${latest.status}` : 'END No payment found for this phone.';
    if (text === '3') {
      const topRates = await rows<{ crop: string; price: number; bonus: number }>(
        this.db,
        `select crop, price_per_quintal::float as price, bonus_per_quintal::float as bonus
           from msp_rates
          where is_active = true and crop in ('Wheat', 'Paddy (Common)', 'Mustard', 'Gram (Chana)')
          order by price_per_quintal desc limit 4`,
      );
      const lines = topRates.map(r => `${r.crop}: Rs ${Math.round(r.price + r.bonus)}/qtl`).join('\n');
      return `END Statutory MSP Rates:\n${lines}`;
    }
    return 'END Thank you for using AnnSetu.';
  }

  @Public()
  @Get('ussd')
  ussdGet() {
    return 'CON Welcome to AnnSetu\n1. Check token\n2. Payment status\n3. Statutory MSP Rates';
  }

  @Public()
  @Post('ivr/call')
  async ivr(@Body() body: Record<string, any>) {
    const mobile = String(body.caller_phone ?? body.mobile ?? '').replace(/^\+91/, '').trim();
    let lang = String(body.language ?? 'hi').toLowerCase();

    /**
     * Full BCP-47 speech code map — mirrors SUPPORTED_LANGUAGES in apps/web/src/utils/i18n.ts
     * Languages without a dedicated TTS voice (Bodo, Dogri, Kashmiri, Santali, etc.) fall back
     * to their closest supported language so TTS always fires and never silently skips.
     */
    const LANG_SPEECH_MAP: Record<string, string> = {
      'en':       'en-IN',   // English
      'hi':       'hi-IN',   // Hindi
      'pa':       'pa-IN',   // Punjabi
      'mr':       'mr-IN',   // Marathi
      'bn':       'bn-IN',   // Bengali
      'te':       'te-IN',   // Telugu
      'ta':       'ta-IN',   // Tamil
      'gu':       'gu-IN',   // Gujarati
      'kn':       'kn-IN',   // Kannada
      'ml':       'ml-IN',   // Malayalam
      'or':       'or-IN',   // Odia
      'ur':       'ur-IN',   // Urdu
      'as':       'as-IN',   // Assamese
      'ne':       'ne-NP',   // Nepali
      'brx':      'hi-IN',   // Bodo → Hindi (same Devanagari script)
      'doi':      'hi-IN',   // Dogri → Hindi
      'ks':       'hi-IN',   // Kashmiri → Hindi
      'mai':      'hi-IN',   // Maithili → Hindi
      'mni-mtei': 'hi-IN',   // Manipuri → Hindi
      'sa':       'hi-IN',   // Sanskrit → Hindi
      'sat':      'hi-IN',   // Santali → Hindi
      'sd':       'ur-IN',   // Sindhi → Urdu (closest Perso-Arabic script)
      'kok':      'mr-IN',   // Konkani → Marathi
      'gom':      'mr-IN',   // Goan Konkani → Marathi
    };
    if (!LANG_SPEECH_MAP[lang]) lang = 'hi'; // unknown → Hindi default
    const speechCode = LANG_SPEECH_MAP[lang] ?? 'hi-IN';

    const digits = String(body.digits ?? '').trim();
    const currentStep = String(body.step ?? '');


    // Look up farmer
    const farmer = mobile
      ? await first<{ id: string; name: string; preferred_center_id?: string }>(
          this.db,
          `select id::text, name, preferred_center_id::text from farmers where mobile = $1 limit 1`,
          mobile,
        )
      : null;
    const farmerName = farmer?.name || 'किसान भाई';

    const respond = (payload: Record<string, any>) => {
      const speech = payload.audio_speech || '';
      return {
        ...payload,
        tts_speech:
          payload.tts_speech ||
          (/[\u0A00-\u0A7F]/.test(speech)
            ? gurmukhiToDevanagari(speech)
            : speech),
      };
    };

    // 1. Initial Call - No digits yet: Language Selection
    if (!digits && (currentStep === '' || currentStep === 'CONNECTING' || currentStep === 'LANGUAGE_SELECTION')) {
      const welcomeText = IVR_PROMPTS.hi.welcome;
      return respond({
        helpline_number: '1800-180-SETU (7388)',
        caller_phone: mobile,
        language: lang,
        speech_code: 'hi-IN', // Welcome is always in Hindi; user selects language next
        step: 'LANGUAGE_SELECTION',
        audio_speech: welcomeText,
        tts_speech: gurmukhiToDevanagari(welcomeText),
        allowed_keys: ['1', '2', '3', '4'],
      });
    }

    // 2. Language Selection from step LANGUAGE_SELECTION
    if (currentStep === 'LANGUAGE_SELECTION' && ['1', '2', '3', '4'].includes(digits)) {
      const langMap: Record<string, string> = { '1': 'hi', '2': 'pa', '3': 'mr', '4': 'en' };
      lang = langMap[digits] || 'hi';
      const selectedSpeechCode = LANG_SPEECH_MAP[lang] ?? 'hi-IN';
      const prompt = (IVR_PROMPTS as any)[lang]?.mainMenu(farmerName) || IVR_PROMPTS.hi.mainMenu(farmerName);
      return respond({
        helpline_number: '1800-180-SETU (7388)',
        caller_phone: mobile,
        language: lang,
        speech_code: selectedSpeechCode,
        step: 'MAIN_MENU',
        audio_speech: prompt,
        allowed_keys: ['1', '2', '3', '4', '9'],
      });
    }

    // 3. Main Menu Navigation
    if (digits === '0') {
      const prompt = (IVR_PROMPTS as any)[lang]?.mainMenu(farmerName) || IVR_PROMPTS.hi.mainMenu(farmerName);
      return respond({
        helpline_number: '1800-180-SETU (7388)',
        caller_phone: mobile,
        language: lang,
        speech_code: speechCode,
        step: 'MAIN_MENU',
        audio_speech: prompt,
        allowed_keys: ['1', '2', '3', '4', '9'],
      });
    }

    // 3.1 Option 1: Live Queue & Token Status
    if (digits === '1') {
      const token = mobile
        ? await first<{
            id: number;
            token_number: string;
            status: string;
            center_id: string;
            center_name?: string;
            created_at: Date;
          }>(
            this.db,
            `select t.id, t.token_number, t.status, t.center_id::text, c.name as center_name, t.created_at
             from tokens t
             join centers c on c.id = t.center_id
             join farmers f on f.id = t.farmer_id
             where f.mobile = $1
             order by t.created_at desc limit 1`,
            mobile,
          )
        : null;

      const p = (IVR_PROMPTS as any)[lang] || IVR_PROMPTS.hi;
      if (!token) {
        return respond({
          step: 'TOKEN_STATUS',
          language: lang,
          speech_code: speechCode,
          audio_speech: p.noToken,
          allowed_keys: ['0', '2', '9'],
        });
      }

      const aheadCount = await first<{ count: number }>(
        this.db,
        `select count(*)::int as count from tokens
         where center_id = $1::uuid and created_at < $2 and lower(status) in ('pending', 'booked', 'arrived', 'waiting')`,
        token.center_id,
        token.created_at,
      );
      const ahead = aheadCount?.count || 0;
      const waitMin = Math.max(3, Math.floor((ahead * 7) / 2));
      const centerName = token.center_name || 'मंडी केंद्र';
      const speech = p.tokenStatus(token.token_number, centerName, ahead, waitMin, token.status);

      return respond({
        step: 'TOKEN_STATUS',
        language: lang,
        speech_code: speechCode,
        token_number: token.token_number,
        center_name: centerName,
        farmers_ahead: ahead,
        wait_minutes: waitMin,
        status: token.status,
        audio_speech: speech,
        allowed_keys: ['0', '9'],
      });
    }

    // 3.2 Option 2: Procurement Slot Booking
    if (digits === '2') {
      const center = farmer?.preferred_center_id
        ? await first<{ id: string; name: string }>(this.db, `select id::text, name from centers where id = $1::uuid`, farmer.preferred_center_id)
        : await first<{ id: string; name: string }>(this.db, `select id::text, name from centers where is_active = true limit 1`);
      const centerName = center?.name || 'निकटतम मंडी';
      const p = (IVR_PROMPTS as any)[lang] || IVR_PROMPTS.hi;
      return respond({
        step: 'SLOT_BOOKED',
        language: lang,
        speech_code: speechCode,
        audio_speech: p.slotBooking(centerName),
        allowed_keys: ['0', '9'],
      });
    }

    // 3.3 Option 3: Running Late Grace Period (15 mins)
    if (digits === '3') {
      const p = (IVR_PROMPTS as any)[lang] || IVR_PROMPTS.hi;
      if (!mobile) {
        return respond({
          step: 'GRACE_EXTENDED',
          language: lang,
          speech_code: speechCode,
          audio_speech: p.noToken,
          allowed_keys: ['0', '9'],
        });
      }
      const token = await first<{ id: number; token_number: string; running_late_used: boolean }>(
        this.db,
        `select t.id, t.token_number, t.running_late_used from tokens t join farmers f on f.id = t.farmer_id where f.mobile = $1 order by t.created_at desc limit 1`,
        mobile,
      );
      if (!token) {
        return respond({
          step: 'GRACE_EXTENDED',
          language: lang,
          speech_code: speechCode,
          audio_speech: p.noToken,
          allowed_keys: ['0', '9'],
        });
      }

      await rows(
        this.db,
        `update tokens set running_late_used = true, grace_until = now() + interval '15 minutes', updated_at = now() where id = $1`,
        token.id,
      );

      return respond({
        step: 'GRACE_EXTENDED',
        language: lang,
        speech_code: speechCode,
        token_number: token.token_number,
        grace_until: '15 मिनट',
        audio_speech: p.graceGranted('15 मिनट (15 mins)'),
        allowed_keys: ['0', '9'],
      });
    }

    // 3.4 Option 4: Statutory MSP Rates (Dynamic from active database benchmarks)
    if (digits === '4') {
      const p = (IVR_PROMPTS as any)[lang] || IVR_PROMPTS.hi;
      const topRates = await rows<{ crop: string; price: number; bonus: number }>(
        this.db,
        `select crop, price_per_quintal::float as price, bonus_per_quintal::float as bonus
           from msp_rates
          where is_active = true and crop in ('Wheat', 'Paddy (Common)', 'Mustard', 'Gram (Chana)', 'Soybean')
          order by price_per_quintal desc limit 5`,
      );

      let dynamicSpeech = p.mspRates;
      if (topRates.length > 0) {
        if (lang === 'hi') {
          const items = topRates.map(r => `${r.crop} ₹${Math.round(r.price + r.bonus)} प्रति क्विंटल`).join('। ');
          dynamicSpeech = `भारत सरकार द्वारा निर्धारित आज के न्यूनतम समर्थन मूल्य हैं: ${items}। भुगतान सीधे डीबीटी बैंक खाते में होगा। मुख्य मेनू के लिए 0 दबाएं।`;
        } else if (lang === 'pa') {
          const items = topRates.map(r => `${r.crop} ₹${Math.round(r.price + r.bonus)} ਪ੍ਰਤੀ ਕੁਇੰਟਲ`).join('। ');
          dynamicSpeech = `ਮੌਜੂਦਾ ਸਰਕਾਰੀ ਐਮਐਸਪੀ ਦਰਾਂ ਹਨ: ${items}। ਮੁੱਖ ਮੇਨੂ ਲਈ 0 ਦਬਾਓ।`;
        } else if (lang === 'mr') {
          const items = topRates.map(r => `${r.crop} ₹${Math.round(r.price + r.bonus)} प्रति क्विंटल`).join('. ');
          dynamicSpeech = `भारत सरकारचे सध्याचे किमान हमीभाव: ${items}। मुख्य मेनूसाठी 0 दाबा.`;
        } else {
          const items = topRates.map(r => `${r.crop} is ₹${Math.round(r.price + r.bonus)} per quintal`).join('. ');
          dynamicSpeech = `Current Government Statutory MSP Rates: ${items}. Direct DBT transfer to your verified bank account. Press 0 for Main Menu.`;
        }
      }

      return respond({
        step: 'MSP_RATES',
        language: lang,
        speech_code: speechCode,
        audio_speech: dynamicSpeech,
        allowed_keys: ['0', '9'],
      });
    }

    // 3.5 Option 9: Mandi Officer / Agent Connect
    if (digits === '9') {
      const p = (IVR_PROMPTS as any)[lang] || IVR_PROMPTS.hi;
      return respond({
        step: 'AGENT_CONNECT',
        language: lang,
        speech_code: speechCode,
        audio_speech: p.agentConnect,
        connected_agent: 'APMC Helpdesk Officer (Ext 104)',
        status: 'CALL_FORWARDED',
        allowed_keys: ['0'],
      });
    }

    // Default fallback: return main menu with notification
    const p = (IVR_PROMPTS as any)[lang] || IVR_PROMPTS.hi;
    return respond({
      step: 'MAIN_MENU',
      language: lang,
      speech_code: speechCode,
      audio_speech: `${p.invalidInput} ${p.mainMenu(farmerName)}`,
      allowed_keys: ['1', '2', '3', '4', '9'],
    });
  }

  @Public()
  @Get('ivr/alerts')
  async alerts(@Query('farmer_id') farmerId?: string, @Query('mobile') mobile?: string) {
    const cleanMobile = mobile ? String(mobile).replace(/^\+91/, '').trim() : null;
    const dbRows = await rows<Record<string, any>>(
      this.db,
      `select n.* from notifications n
       left join farmers f on f.id = n.farmer_id
       where ($1::uuid is null or n.farmer_id = $1) and ($2::text is null or f.mobile = $2)
       order by n.created_at desc limit 20`,
      farmerId ?? null,
      cleanMobile,
    );

    const now = new Date();
    const defaults = [
      {
        id: 1,
        type: 'COUNTER_CALL',
        title: 'टोकन काउंटर बुलावा (Token Counter Call)',
        timestamp: new Date(now.getTime() - 12 * 60000).toISOString(),
        duration: '0:24',
        lang: 'hi-IN',
        transcript:
          'नमस्ते किसान भाई, आपका टोकन अब काउंटर नंबर 2 पर बुलाया गया है। कृपया अपनी तौल पर्ची लेकर तुरंत काउंटर पर पहुंचें।',
        status: 'DELIVERED',
      },
      {
        id: 2,
        type: 'PRODUCE_ACCEPTED',
        title: 'फसल तुलाई व गुणवत्ता पास (Produce Quality Approved)',
        timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
        duration: '0:31',
        lang: 'hi-IN',
        transcript:
          'बधाई हो! आपकी फसल की गुणवत्ता मानकों पर खरी उतरी है और नमी मानक सीमा में दर्ज हुई है। तुलाई सफलतापूर्वक पूरी हो गई है।',
        status: 'DELIVERED',
      },
      {
        id: 3,
        type: 'PAYMENT_DISBURSED',
        title: 'डीबीटी भुगतान प्रेषित (DBT Payment Transferred)',
        timestamp: new Date(now.getTime() - 5 * 3600000).toISOString(),
        duration: '0:36',
        lang: 'hi-IN',
        transcript:
          'प्रिय किसान, आपकी फसल का कुल भुगतान पीएफएमएस द्वारा आपके आधार लिंक बैंक खाते में भेज दिया गया है। यूटीआर संदर्भ संख्या एसएमएस पर देखें।',
        status: 'DELIVERED',
      },
      {
        id: 4,
        type: 'WEATHER_ADVISORY',
        title: 'मंडी मौसम चेतावनी (Mandi Weather Alert)',
        timestamp: new Date(now.getTime() - 24 * 3600000).toISOString(),
        duration: '0:28',
        lang: 'hi-IN',
        transcript:
          'सावधान! आज दोपहर मंडी क्षेत्र में आंधी और बारिश की संभावना है। कृपया अपनी उपज को तिरपाल से ढक कर सुरक्षित शेड में रखें।',
        status: 'DELIVERED',
      },
    ];

    if (!dbRows || dbRows.length === 0) {
      return defaults;
    }

    return dbRows.map((r, i) => {
      const msg = r.message || r.content || 'सूचना प्राप्त हुई';
      return {
        id: r.id || i + 10,
        type: r.notification_type || r.type || 'VOICE_OBD',
        title:
          r.title ||
          (r.notification_type === 'booking'
            ? 'स्लॉट बुकिंग पुष्टि (Booking Confirmed)'
            : 'अन्न सेतु सूचना (AnnSetu Alert)'),
        transcript: msg,
        timestamp: r.created_at ? new Date(r.created_at).toISOString() : now.toISOString(),
        duration: '0:25',
        lang: 'hi-IN',
        status: r.status ? String(r.status).toUpperCase() : 'DELIVERED',
      };
    });
  }
}
