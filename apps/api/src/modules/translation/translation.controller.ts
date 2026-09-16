import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/access';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { env } from '../../config/env';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const requestSchema = z.object({
  texts: z.array(z.string().min(1).max(1000)).min(1).max(100),
  target: z.string().min(2).max(15),
  source: z.string().min(2).max(10).default('en'),
});

// Common agricultural & portal dictionary for 0ms instantaneous load
const AGRICULTURAL_DICTIONARY: Record<string, Record<string, string>> = {
  'AnnSetu': {
    hi: 'अन्नसेतु', pa: 'ਅੰਨਸੇਤੂ', mr: 'अन्नसेतू', bn: 'অন্নসেতু', ta: 'அன்னசேது',
    te: 'అన్నసేతు', gu: 'અન્નસેતુ', kn: 'ಅನ್ನಸೇತು', ml: 'അന്നസേതു', or: 'ଅନ୍ନସେତୁ',
    as: 'অন্নসেতু', ur: 'ان سیتو', ne: 'अन्नसेतु', sa: 'अन्नसेतुः', gom: 'अन्नसेतू',
    mai: 'अन्नसेतु', doi: 'अन्नसेतु', sd: 'ان سيتو', sat: 'ᱟᱱᱱᱥᱮᱛᱩ', 'mni-Mtei': 'ꯑꯟꯅꯁꯦꯇꯨ',
    brx: 'अन्नसेतु', ks: 'अन्नसेतु'
  },
  'Kisan Portal': {
    hi: 'किसान पोर्टल', pa: 'ਕਿਸਾਨ ਪੋਰਟਲ', mr: 'शेतकरी पोर्टल', bn: 'কৃষক পোর্টাল', ta: 'விவசாயி போர்டல்',
    te: 'రైతు పోర్టల్', gu: 'ખેડૂત પોર્ટલ', kn: 'ರೈತ ಪೋರ್ಟಲ್', ml: 'കർഷക പോർട്ടൽ', or: 'କୃଷକ ପୋର୍ଟାଲ୍',
    as: 'কৃষক পৰ্টেল', ur: 'کسان پورٹل', ne: 'किसान पोर्टल', sa: 'कृषक पोर्टल', gom: 'शेतकार पोर्टल',
    mai: 'किसान पोर्टल', doi: 'किसान पोर्टल', sd: 'ڪسان پورٽل', sat: 'ᱠᱤᱥᱟᱹᱬ ᱯᱳᱨᱴᱟᱞ', 'mni-Mtei': 'ꯀꯤꯁꯥꯟ ꯄꯣꯔꯇꯦꯜ',
    brx: 'किसान पोर्टल', ks: 'किसान पोर्टल'
  },
  'Dashboard': {
    hi: 'डैशबोर्ड', pa: 'ਡੈਸ਼ਬੋਰਡ', mr: 'डॅशबोर्ड', bn: 'ড্যাশবোর্ড', ta: 'டாஷ்போர்டு',
    te: 'డాష్‌బోర్డ్', gu: 'ડેશબોર્ડ', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್', ml: 'ഡാഷ്‌ബോർഡ്', or: 'ଡ୍ୟାସବୋର୍ଡ',
    as: 'ডেচবৰ্ড', ur: 'ڈیش بورڈ', ne: 'ड्यासबोर्ड', sa: 'डैशबोर्ड', gom: 'डॅशबोर्ड',
    mai: 'डैशबोर्ड', doi: 'डैशबोर्ड', sd: 'ڊيش بورڊ', sat: 'ᱰᱮᱥᱵᱚᱨᱰ', 'mni-Mtei': 'ꯗꯦꯁꯕꯣꯔꯗ',
    brx: 'डैशबोर्ड', ks: 'डैशबोर्ड'
  },
  'Book Slot': {
    hi: 'स्लॉट बुक करें', pa: 'ਸਲਾਟ ਬੁੱਕ ਕਰੋ', mr: 'स्लॉट बुक करा', bn: 'স্লট বুক করুন', ta: 'ஸ்லாட் முன்பதிவு செய்க',
    te: 'స్లాట్ బుక్ చేయండి', gu: 'સ્લોટ બુક કરો', kn: 'ಸ್ಲಾಟ್ ಬುಕ್ ಮಾಡಿ', ml: 'സ്ലോട്ട് ബുക്ക് ചെയ്യുക', or: 'ସ୍ଲଟ୍ ବୁକ୍ କରନ୍ତୁ',
    as: 'স্লট বুক কৰক', ur: 'سلاٹ بک کریں', ne: 'स्लट बुक गर्नुहोस्', sa: 'स्थानं आरक्षयतु', gom: 'स्लॉट बुक करात',
    mai: 'स्लॉट बुक करू', doi: 'स्लॉट बुक करो', sd: 'سلاٽ بڪ ڪريو', sat: 'ᱥᱞᱳᱴ ᱵᱩᱠ ᱢᱮ', 'mni-Mtei': 'ꯁ꯭ꯂꯣꯠ ꯕꯨꯛ ꯇꯧꯕꯤꯌꯨ',
    brx: 'स्लॉट बुक खालाम', ks: 'स्लॉट बुक करिव'
  },
  'Live Queue': {
    hi: 'लाइव कतार', pa: 'ਲਾਈਵ ਕਤਾਰ', mr: 'थेट रांग', bn: 'লাইভ সারি', ta: 'நேரலை வரிசை',
    te: 'లైవ్ క్యూ', gu: 'લાઈવ કતાર', kn: 'ಲೈವ್ ಕ್ಯೂ', ml: 'തത്സമയ ക്യൂ', or: 'ଲାଇଭ୍ ଧାଡ଼ି',
    as: 'লাইভ শাৰী', ur: 'لائیو قطار', ne: 'लाइभ लाम', sa: 'प्रत्यक्षपङ्क्तिः', gom: 'लायव्ह रांक',
    mai: 'लाइव कतार', doi: 'लाइव कतार', sd: 'لائيو قطار', sat: 'ᱞᱟᱭᱤᱵᱷ ᱛᱷᱟᱨ', 'mni-Mtei': 'ꯂꯥꯏꯕ ꯀ꯭ꯌꯨ',
    brx: 'लाइव कतार', ks: 'लाइव कतार'
  },
  'Procurement': {
    hi: 'खरीद', pa: 'ਖਰੀਦ', mr: 'खरेदी', bn: 'সংগ্রহ', ta: 'கொள்முதல்',
    te: 'సేకరణ', gu: 'ખરીદી', kn: 'ಖರೀದಿ', ml: 'സംഭരണം', or: 'କ୍ରୟ',
    as: 'ক্ৰয়', ur: 'خریداری', ne: 'खरीद', sa: 'क्रयणम्', gom: 'खरेदी',
    mai: 'खरीद', doi: 'खरीद', sd: 'خريداري', sat: 'ᱠᱤᱨᱤᱧ', 'mni-Mtei': 'ꯄ꯭ꯔꯣꯛꯌꯨꯔꯃꯦꯟꯇ',
    brx: 'बायनाय', ks: 'खरीद'
  },
  'Procurement Status': {
    hi: 'खरीद की स्थिति', pa: 'ਖਰੀਦ ਦੀ ਸਥਿਤੀ', mr: 'खरेदी स्थिती', bn: 'সংগ্রহ স্থিতি', ta: 'கொள்முதல் நிலை',
    te: 'సేకరణ స్థితి', gu: 'ખરીદી સ્થિતિ', kn: 'ಖರೀದಿ ಸ್ಥಿತಿ', ml: 'സംഭരണ ​​നില', or: 'କ୍ରୟ ସ୍ଥିତି',
    as: 'ক্ৰয়ৰ অৱস্থা', ur: 'خریداری کی حالت', ne: 'खरीद स्थिति', sa: 'क्रयणस्थितिः', gom: 'खरेदी स्थिती',
    mai: 'खरीद स्थिति', doi: 'खरीद दी स्थिति', sd: 'خريداري جي حالت', sat: 'ᱠᱤᱨᱤᱧ ᱥᱛᱤᱛᱤ', 'mni-Mtei': 'ꯄ꯭ꯔꯣꯛꯌꯨꯔꯃꯦꯟꯇ ꯁ꯭ꯇꯦꯇꯁ',
    brx: 'खरीद की स्थिति', ks: 'खरीद स्थिति'
  },
  'Payment Status': {
    hi: 'भुगतान की स्थिति', pa: 'ਭੁਗਤਾਨ ਸਥਿਤੀ', mr: 'पेमेंट स्थिती', bn: 'পেমেন্ট স্থিতি', ta: 'பணம் செலுத்தும் நிலை',
    te: 'చెల్లింపు స్థితి', gu: 'ચુકવણી સ્થિતિ', kn: 'ಪಾವತಿ ಸ್ಥಿತಿ', ml: 'പേയ്‌മെന്റ് നില', or: 'ଦେୟ ସ୍ଥିତି',
    as: 'পৰিশোধৰ অৱস্থা', ur: 'ادائیگی کی حالت', ne: 'भुक्तानी स्थिति', sa: 'भुगतानस्थितिः', gom: 'पेमेंट स्थिती',
    mai: 'भुगतान स्थिति', doi: 'भुगतान दी स्थिति', sd: 'ادائيگي جي حالت', sat: 'ᱯᱮᱢᱮᱱᱴ ᱥᱛᱤᱛᱤ', 'mni-Mtei': 'ꯄꯦꯃꯦꯟꯇ ꯁ꯭ꯇꯦꯇꯁ',
    brx: 'भुगतान स्थिति', ks: 'भुगतान स्थिति'
  },
  'My Profile': {
    hi: 'मेरी प्रोफ़ाइल', pa: 'ਮੇਰੀ ਪ੍ਰੋਫਾਈਲ', mr: 'माझे प्रोफाइल', bn: 'আমার প্রোফাইল', ta: 'என் சுயவிவரம்',
    te: 'నా ప్రొఫైల్', gu: 'મારી પ્રોફાઇલ', kn: 'ನನ್ನ ಪ್ರೊಫೈಲ್', ml: 'എന്റെ പ്രൊഫൈൽ', or: 'ମୋର ପ୍ରୋଫାଇଲ୍',
    as: 'মোৰ প্ৰফাইল', ur: 'میرا پروفائل', ne: 'मेरो प्रोफाइल', sa: 'मम विवरणम्', gom: 'म्हजी प्रोफायल',
    mai: 'हमर प्रोफाइल', doi: 'मेरी प्रोफाइल', sd: 'منهنجي پروفائل', sat: 'ᱤᱧᱟᱜ ᱯᱨᱳᱯᱷᱟᱭᱤᱞ', 'mni-Mtei': 'ꯑꯩꯒꯤ ꯄ꯭ꯔꯣꯐꯥꯏꯜ',
    brx: 'आंनि प्रोफाइल', ks: 'मेरो प्रोफाइल'
  },
  'Logout': {
    hi: 'लॉगआउट', pa: 'ਲਾਗਆਉਟ', mr: 'लॉगआउट', bn: 'লগআউট', ta: 'வெளியேறு',
    te: 'లాగౌట్', gu: 'લૉગઆઉટ', kn: 'ಲಾಗ್‌ಔಟ್', ml: 'ലോഗ്ഔട്ട്', or: 'ଲଗ୍ ଆଉଟ୍',
    as: 'লগআউট', ur: 'لاگ آوٹ', ne: 'लगआउट', sa: 'निर्गमनम्', gom: 'लॉगआउट',
    mai: 'लॉगआउट', doi: 'लॉगआउट', sd: 'لاگ آئوٽ', sat: 'ᱞᱚᱜᱽ ᱟᱣᱩᱴ', 'mni-Mtei': 'ꯂꯣꯒꯑꯥꯎꯠ',
    brx: 'लॉगआउट', ks: 'लॉगआउट'
  },
  'Farmer': {
    hi: 'किसान', pa: 'ਕਿਸਾਨ', mr: 'शेतकरी', bn: 'কৃষক', ta: 'விவசாயி',
    te: 'రైతు', gu: 'ખેડૂત', kn: 'ರೈತ', ml: 'കർഷകൻ', or: 'କୃଷକ',
    as: 'কৃষক', ur: 'کسان', ne: 'किसान', sa: 'कृषकः', gom: 'शेतकार',
    mai: 'किसान', doi: 'किसान', sd: 'ڪسان', sat: 'ᱠᱤᱥᱟᱹᱬ', 'mni-Mtei': 'ꯀꯤꯁꯥꯟ',
    brx: 'आबादारी', ks: 'किसान'
  },
  'Queue Token': {
    hi: 'कतार टोकन', pa: 'ਕਤਾਰ ਟੋਕਨ', mr: 'रांग टोकन', bn: 'সারি টোকেন', ta: 'வரிசை டோக்கன்',
    te: 'క్యూ టోకెన్', gu: 'કતાર ટોકન', kn: 'ಕ್ಯೂ ಟೋಕನ್', ml: 'ക്യൂ ടോക്കൺ', or: 'ଧାଡ଼ି ଟୋକନ୍',
    as: 'শাৰী টোকেন', ur: 'قطار ٹوکن', ne: 'लाम टोकन', sa: 'पङ्क्तिटोकन', gom: 'रांक टोकन',
    mai: 'कतार टोकन', doi: 'कतार टोकन', sd: 'قطار ٽوڪن', sat: 'ᱛᱷᱟᱨ ᱴᱳᱠᱮᱱ', 'mni-Mtei': 'ꯀ꯭ꯌꯨ ꯇꯣꯀꯦꯟ',
    brx: 'कतार टोकन', ks: 'कतार टोकन'
  },
  'Gate Entry': {
    hi: 'गेट प्रवेश', pa: 'ਗੇਟ ਐਂਟਰੀ', mr: 'गेट प्रवेश', bn: 'গেট এন্ট্রি', ta: 'நுழைவு வாயில்',
    te: 'గేట్ ప్రవేశం', gu: 'ગેટ પ્રવેશ', kn: 'ಗೇಟ್ ಪ್ರವೇಶ', ml: 'ഗേറ്റ് പ്രവേശനം', or: 'ଗେଟ୍ ପ୍ରବେଶ',
    as: 'গেট প্ৰৱেশ', ur: 'گیٹ انٹری', ne: 'गेट प्रवेश', sa: 'द्वारप्रवेशः', gom: 'गेट प्रवेश',
    mai: 'गेट प्रवेश', doi: 'गेट प्रवेश', sd: 'گيٽ داخلا', sat: 'ᱫᱩᱣᱟᱹᱨ ᱵᱚᱞᱚᱱ', 'mni-Mtei': 'ꯒꯦꯠ ꯆꯪꯕ',
    brx: 'गेट प्रवेश', ks: 'गेट अंदर'
  },
  'Weighing': {
    hi: 'तौल / वजन', pa: 'ਤੋਲਾਈ', mr: 'वजन तपासणी', bn: 'ওজন পরিমাপ', ta: 'எடை போடுதல்',
    te: 'తూకం వేయుట', gu: 'વજન માપણી', kn: 'ತೂಕ ತಪಾಸಣೆ', ml: 'ഭാരം അളക്കൽ', or: 'ଓଜନ ମାପ',
    as: 'ওজন জোখা', ur: 'وزن کرنا', ne: 'तौलिनु', sa: 'तोलनम्', gom: 'वजन',
    mai: 'तौल', doi: 'तोल', sd: 'وزن', sat: 'ᱛᱩᱞᱟᱹ', 'mni-Mtei': 'ꯑꯔꯨꯝꯕ ꯆꯥꯡ ꯌꯦꯡꯕ',
    brx: 'जजन', ks: 'तोल'
  },
  'Quality Check': {
    hi: 'गुणवत्ता जांच', pa: 'ਗੁਣਵੱਤਾ ਜਾਂਚ', mr: 'गुणवत्ता तपासणी', bn: 'গুণমান পরীক্ষা', ta: 'தர சோதனை',
    te: 'నాణ్యత తనిఖీ', gu: 'ગુણવત્તા ચકાસણી', kn: 'ಗುಣಮಟ್ಟ ಪರಿಶೀಲನೆ', ml: 'ഗുണനിലവാര പരിശോധന', or: 'ଗୁଣବତ୍ତା ଯାଞ୍ଚ',
    as: 'গুণমান পৰীক্ষা', ur: 'معیار کی جانچ', ne: 'गुणस्तर परीक्षण', sa: 'गुणवत्तापरीक्षणम्', gom: 'गुणवत्ता तपासणी',
    mai: 'गुणवत्ता जांच', doi: 'गुणवत्ता जांच', sd: 'معيار جي چڪاس', sat: 'ᱜᱩᱱ ᱯᱩᱨᱠᱷᱟᱹ', 'mni-Mtei': 'ꯀ꯭ꯕꯥꯂꯤꯇꯤ ꯆꯦꯛ',
    brx: 'गुणवत्ता नायबिजिरनाय', ks: 'क्वालिटी जांच'
  },
  'Lot Accepted': {
    hi: 'लॉट स्वीकृत', pa: 'ਲਾਟ ਸਵੀਕਾਰ ਕੀਤੀ', mr: 'लॉट स्वीकारला', bn: 'লট গৃহীত', ta: 'லாட் ஏற்றுக்கொள்ளப்பட்டது',
    te: 'లాట్ ఆమోదించబడింది', gu: 'લોટ સ્વીકારાયેલ', kn: 'ಲಾಟ್ ಅಂಗೀಕರಿಸಲಾಗಿದೆ', ml: 'ലോട്ട് സ്വീകരിച്ചു', or: 'ଲଟ୍ ଗ୍ରହଣ ହେଲା',
    as: 'লট গ্ৰহণ কৰা হ’ল', ur: 'لاٹ منظور', ne: 'लट स्वीकृत', sa: 'स्वीकृतम्', gom: 'लॉट मान्य',
    mai: 'लॉट स्वीकृत', doi: 'लॉट मंजूर', sd: 'لاٽ قبول', sat: 'ᱞᱚᱴ ᱟᱸᱜᱚᱪ', 'mni-Mtei': 'ꯂꯣꯠ ꯌꯥꯔꯦ',
    brx: 'लॉट आजावबाय', ks: 'लॉट मंजूर'
  },
  'Rejected': {
    hi: 'अस्वीकृत / खारिज', pa: 'ਰੱਦ ਕੀਤਾ ਗਿਆ', mr: 'नाकारले', bn: 'প্রত্যাখ্যাত', ta: 'நிராகரிக்கப்பட்டது',
    te: 'తిరస్కరించబడింది', gu: 'અસ્વીકાર', kn: 'ತಿರಸ್ಕರಿಸಲಾಗಿದೆ', ml: 'നിരസിച്ചു', or: 'ପ୍ରତ୍ୟାଖ୍ୟାତ',
    as: 'প্ৰত্যাখ্যাত', ur: 'مسترد', ne: 'अस्वीकृत', sa: 'अस्वीकृतम्', gom: 'नाकारलें',
    mai: 'अस्वीकृत', doi: 'खारिज', sd: 'رد ٿيل', sat: 'ᱵᱟᱹᱜᱤᱭᱟᱜ', 'mni-Mtei': 'ꯌꯥꯗꯦ',
    brx: 'नेवसिबाय', ks: 'खारिज'
  },
  'Gross Weight': {
    hi: 'सकल वजन (Gross)', pa: 'ਕੁੱਲ ਵਜ਼ਨ', mr: 'एकूण वजन', bn: 'মোট ওজন', ta: 'மொத்த எடை',
    te: 'మొత్తం బరువు', gu: 'કુલ વજન', kn: 'ಒಟ್ಟು ತೂಕ', ml: 'മൊത്തം ഭാരം', or: 'ମୋଟ ଓଜନ',
    as: 'মুঠ ওজন', ur: 'مجموعی وزن', ne: 'कुल तौल', sa: 'सकलभारः', gom: 'एकूण वजन',
    mai: 'सकल वजन', doi: 'कुल वजन', sd: 'مجموعي وزن', sat: 'ᱡᱚᱛᱚ ᱛᱩᱞᱟᱹ', 'mni-Mtei': 'ꯑꯄꯨꯟꯕ ꯑꯔꯨꯝꯕ',
    brx: 'सकल वजन', ks: 'कुल वजन'
  },
  'Tare Weight': {
    hi: 'खाली वजन (Tare)', pa: 'ਖਾਲੀ ਟਰਾਲੀ ਵਜ਼ਨ', mr: 'रिकामे वजन', bn: 'খালি ওজন', ta: 'வெற்று எடை',
    te: 'ఖాళీ బరువు', gu: 'ખાલી વાહન વજન', kn: 'ಖಾಲಿ ವಾಹನ ತೂಕ', ml: 'ശൂന്യ ഭാരം', or: 'ଖାଲି ଓଜନ',
    as: 'খালী ওজন', ur: 'خالی وزن', ne: 'खाली तौल', sa: 'रिक्तभारः', gom: 'रिकामें वजन',
    mai: 'खाली वजन', doi: 'खाली वजन', sd: 'خالي وزن', sat: 'ᱠᱷᱟᱹᱞᱤ ᱛᱩᱞᱟᱹ', 'mni-Mtei': 'ꯍꯥꯡꯕ ꯑꯔꯨꯝꯕ',
    brx: 'खाली वजन', ks: 'खाली वजन'
  },
  'Net Weight': {
    hi: 'शुद्ध वजन (Net)', pa: 'ਸ਼ੁੱਧ ਵਜ਼ਨ', mr: 'निव्वळ वजन', bn: 'নেট ওজন', ta: 'நிகர எடை',
    te: 'నికర బరువు', gu: 'ચોખ્ખું વજન', kn: 'ನಿವ್ವಳ ತೂಕ', ml: 'അറ്റ ​​ഭാരം', or: 'ଶୁଦ୍ଧ ଓଜନ',
    as: 'প্ৰকৃত ওজন', ur: 'خالص وزن', ne: 'शुद्ध तौल', sa: 'शुद्धभारः', gom: 'निव्वळ वजन',
    mai: 'शुद्ध वजन', doi: 'शुद्ध वजन', sd: 'صاف وزن', sat: 'ᱟᱥᱚᱞ ᱛᱩᱞᱟᱹ', 'mni-Mtei': 'ꯑꯁꯦꯡꯕ ꯑꯔꯨꯝꯕ',
    brx: 'शुद्ध वजन', ks: 'असली वजन'
  },
  'Moisture': {
    hi: 'नमी (Moisture)', pa: 'ਨਮੀ ਦੀ ਮਾਤਰਾ', mr: 'ओलावा प्रमाण', bn: 'আর্দ্রতা', ta: 'ஈரப்பதம்',
    te: 'తేమ శాతం', gu: 'ભેજ પ્રમાણ', kn: 'ತೇವಾಂಶ', ml: 'ഈർപ്പത്തിന്റെ അളവ്', or: 'ଆର୍ଦ୍ରତା',
    as: 'আৰ্দ্ৰতা', ur: 'نمی', ne: 'ओस / चिसो', sa: 'आर्द्रता', gom: 'ओलावा',
    mai: 'नमी', doi: 'नमी', sd: 'نمي', sat: 'ᱫᱟᱜ ᱨᱮᱭᱟᱜ ᱞᱮᱠᱷᱟ', 'mni-Mtei': 'ꯏꯁꯤꯡ ꯂꯩꯕ',
    brx: 'सिदोबनाय', ks: 'नमी'
  },
  'Nodal Officer Portal': {
    hi: 'नोडल अधिकारी पोर्टल', pa: 'ਨੋਡਲ ਅਧਿਕਾਰੀ ਪੋਰਟਲ', mr: 'नोडल अधिकारी पोर्टल', bn: 'নোডাল অফিসার পোর্টাল', ta: 'நோடல் அதிகாரி போர்டல்',
    te: 'నోడల్ అధికారి పోర్టల్', gu: 'નોડલ અધિકારી પોર્ટલ', kn: 'ನೋಡಲ್ ಅಧಿಕಾರಿ ಪೋರ್ಟಲ್', ml: 'നോഡൽ ഓഫീസർ പോർട്ടൽ', or: 'ନୋଡାଲ୍ ଅଧିକାରୀ ପୋର୍ଟାଲ୍',
    as: 'ন’ডেল বিষয়া পৰ্টেল', ur: 'نوڈل آفیسر پورٹل', ne: 'नोडल अधिकारी पोर्टल', sa: 'नोडल-अधिकारी-पोर्टल', gom: 'नोडल अधिकारी पोर्टल',
    mai: 'नोडल अधिकारी पोर्टल', doi: 'नोडल अधिकारी पोर्टल', sd: 'نوڊل آفيسر پورٽل', sat: 'ᱱᱳᱰᱟᱞ ᱚᱯᱷᱤᱥᱚᱨ ᱯᱳᱨᱴᱟᱞ', 'mni-Mtei': 'ꯅꯣꯗꯜ ꯑꯣꯐꯤꯁꯔ ꯄꯣꯔꯇꯦꯜ',
    brx: 'नोडल अफिसार पोर्टल', ks: 'नोडल अफसर पोर्टल'
  },
  'Mandi Congestion Monitor': {
    hi: 'मंडी भीड़ निगरानी', pa: 'ਮੰਡੀ ਭੀੜ ਨਿਗਰਾਨੀ', mr: 'मंडी गर्दी नियंत्रण', bn: 'মান্ডি ভিড় ট্র্যাকার', ta: 'மண்டி நெரிசல் கண்காணிப்பு',
    te: 'మండీ రద్దీ పర్యవేక్షణ', gu: 'મંડી ભીડ મોનિટર', kn: 'ಮಂಡಿ ದಟ್ಟಣೆ ಮಾನಿಟರ್', ml: 'മണ്ഡി തിരക്ക് നിരീക്ഷണം', or: 'ମଣ୍ଡି ଭିଡ଼ ନିରୀକ୍ଷଣ',
    as: 'মণ্ডী ভিৰ নিৰীক্ষণ', ur: 'منڈی رش مانیٹر', ne: 'मण्डी भीड मनिटर', sa: 'मण्डीसङ्कुलतानियन्त्रणम्', gom: 'मंडी गर्दी नियंत्रण',
    mai: 'मंडी भीड़ निगरानी', doi: 'मंडी भीड़ निगरानी', sd: 'منڊي هجوم مانيٽر', sat: 'ᱢᱟᱱᱰᱤ ᱵᱷᱤᱲ ᱢᱚᱱᱤᱴᱚᱨ', 'mni-Mtei': 'ꯃꯟꯗꯤ ꯀꯪꯖꯦꯁꯟ ꯃꯣꯅꯤꯇꯔ',
    brx: 'मंडी भीड़ निगरानी', ks: 'मंडी भीड़ मानिटर'
  },
  'Smart Demand Prediction': {
    hi: 'स्मार्ट मांग पूर्वानुमान', pa: 'ਸਮਾਰਟ ਮੰਗ ਭਵਿੱਖਬਾਣੀ', mr: 'स्मार्ट मागणी अंदाज', bn: 'স্মার্ট চাহিদা পূর্বাভাস', ta: 'ஸ்மார்ட் தேவை கணிப்பு',
    te: 'స్మార్ట్ డిమాండ్ అంచనా', gu: 'સ્માર્ટ માંગ આગાહી', kn: 'ಸ್ಮಾರ್ಟ್ ಬೇಡಿಕೆ ಮುನ್ಸೂಚನೆ', ml: 'സ്മാർട്ട് ഡിമാൻഡ് പ്രവചനം', or: 'ସ୍ମାର୍ଟ ଚାହିଦା ପୂର୍ବାନୁମାନ',
    as: 'স্মাৰ্ট চাহিদা পূৰ্বাভাস', ur: 'سمارٹ ڈیمانڈ پیشگوئی', ne: 'स्मार्ट माग पूर्वानुमान', sa: 'स्मार्ट-माङ्ग-पूर्वानुमानम्', gom: 'स्मार्ट मागणी अंदाज',
    mai: 'स्मार्ट मांग पूर्वानुमान', doi: 'स्मार्ट मांग पूर्वानुमान', sd: 'سمارٽ گهرج جي اڳڪٿي', sat: 'ᱥᱢᱟᱨᱴ ᱠᱷᱚᱡᱽ ᱟᱱᱫᱟᱡᱽ', 'mni-Mtei': 'ꯁ꯭ꯃꯥꯔꯠ ꯗꯤꯃꯥꯟꯗ ꯄ꯭ꯔꯤꯗꯤꯛꯁꯟ',
    brx: 'स्मार्ट दाबि सिगां मिथिनाय', ks: 'स्मार्ट मांग अंदाजा'
  },
  'Smart Slot Allocation': {
    hi: 'स्मार्ट स्लॉट आवंटन', pa: 'ਸਮਾਰਟ ਸਲਾਟ ਵੰਡ', mr: 'स्मार्ट स्लॉट वाटप', bn: 'স্মার্ট স্লট বরাদ্দ', ta: 'ஸ்மார்ட் ஸ்லாட் ஒதுக்கீடு',
    te: 'స్మార్ట్ స్లాట్ కేటాయింపు', gu: 'સ્માર્ટ સ્લોટ ફાળવણી', kn: 'ಸ್ಮಾರ್ಟ್ ಸ್ಲಾಟ್ ಹಂಚಿಕೆ', ml: 'സ്മാർട്ട് സ്ലോട്ട് വിഹിതം', or: 'ସ୍ମାର୍ଟ ସ୍ଲଟ୍ ବଣ୍ଟନ',
    as: 'স্মাৰ্ট স্লট আবণ্টন', ur: 'سمارٹ سلاٹ الاٹمنٹ', ne: 'स्मार्ट स्लट बाँडफाँड', sa: 'स्मार्ट-स्थान-आवंटनम्', gom: 'स्मार्ट स्लॉट वाटप',
    mai: 'स्मार्ट स्लॉट आवंटन', doi: 'स्मार्ट स्लॉट आवंटन', sd: 'سمارٽ سلاٽ مختص', sat: 'ᱥᱢᱟᱨᱴ ᱥᱞᱳᱴ ᱦᱟᱹᱴᱤᱧ', 'mni-Mtei': 'ꯁ꯭ꯃꯥꯔꯠ ꯁ꯭ꯂꯣꯠ ꯌꯦꯟꯊꯣꯛꯄ',
    brx: 'स्मार्ट स्लॉट राननाय', ks: 'स्मार्ट स्लॉट आवंटन'
  },
  'Master Registry': {
    hi: 'मास्टर किसान रजिस्ट्री', pa: 'ਮਾਸਟਰ ਕਿਸਾਨ ਰਜਿਸਟਰੀ', mr: 'मास्टर शेतकरी नोंदणी', bn: 'মাস্টার কৃষক রেজিস্ট্রি', ta: 'முதன்மை விவசாயி பதிவேடு',
    te: 'మాస్టర్ రైతు రిజిస్ట్రీ', gu: 'માસ્ટર ખેડૂત રજિસ્ટ્રી', kn: 'ಮಾಸ್ಟರ್ ರೈತ ನೋಂದಣಿ', ml: 'മാസ്റ്റർ കർഷക രജിസ്ട്രി', or: 'ମାଷ୍ଟର କୃଷକ ପଞ୍ଜିକରଣ',
    as: 'মাষ্টাৰ কৃষক পঞ্জীয়ন', ur: 'ماسٹر کسان رجسٹری', ne: 'मास्टर किसान दर्ता', sa: 'मुख्य-कृषक-पञ्जिका', gom: 'मास्टर शेतकार नोंदणी',
    mai: 'मास्टर किसान रजिस्ट्री', doi: 'मास्टर किसान रजिस्ट्री', sd: 'ماسٽر هارين جي رجسٽري', sat: 'ᱢᱟᱥᱴᱟᱨ ᱠᱤᱥᱟᱹᱬ ᱨᱮᱡᱤᱥᱴᱨᱤ', 'mni-Mtei': 'ꯃꯥꯁꯇꯔ ꯀꯤꯁꯥꯟ ꯔꯦꯖꯤꯁꯇ꯭ꯔꯤ',
    brx: 'मास्टार आबादारी रेजिस्टरी', ks: 'मास्टर किसान रजिस्ट्री'
  },
  'Total Bookings': {
    hi: 'कुल बुकिंग', pa: 'ਕੁੱਲ ਬੁਕਿੰਗਾਂ', mr: 'एकूण बुकिंग', bn: 'মোট বুকিং', ta: 'மொத்த முன்பதிவுகள்',
    te: 'మొత్తం బుకింగ్‌లు', gu: 'કુલ બુકિંગ', kn: 'ಒಟ್ಟು ಬುಕಿಂಗ್', ml: 'ആകെ ബുക്കിംഗുകൾ', or: 'ମୋଟ ବୁକିଂ',
    as: 'মুঠ বুকিং', ur: 'کل بکنگ', ne: 'कुल बुकिङ', sa: 'कुलारक्षणम्', gom: 'एकूण बुकिंग',
    mai: 'कुल बुकिंग', doi: 'कुल बुकिंग', sd: 'ڪل بڪنگ', sat: 'ᱡᱚᱛᱚ ᱵᱩᱠᱤᱝ', 'mni-Mtei': 'ꯑꯄꯨꯟꯕ ꯕꯨꯛ ꯇꯧꯕ',
    brx: 'गासै बुकिंग', ks: 'कुल बुकिंग'
  },
  'Completed': {
    hi: 'पूर्ण / भुगतान संपन्न', pa: 'ਮੁਕੰਮਲ ਹੋਇਆ', mr: 'पूर्ण झाले', bn: 'সম্পন্ন', ta: 'முடிந்தது',
    te: 'పూర్తయింది', gu: 'પૂર્ણ થયેલ', kn: 'ಪೂರ್ಣಗೊಂಡಿದೆ', ml: 'പൂർത്തിയായി', or: 'ସମ୍ପୂର୍ଣ୍ଣ ହେଲା',
    as: 'সম্পূৰ্ণ হ’ল', ur: 'مکمل', ne: 'सम्पन्न', sa: 'सम्पन्नम्', gom: 'पूर्ण जालें',
    mai: 'पूरा भेल', doi: 'पूरा होया', sd: 'مڪمل ٿيو', sat: 'ᱪᱟᱵᱟᱭᱮᱱᱟ', 'mni-Mtei': 'ꯂꯣꯏꯔꯦ',
    brx: 'जोबबाय', ks: 'मुकम्मल'
  },
  'In Queue': {
    hi: 'कतार में', pa: 'ਕਤਾਰ ਵਿੱਚ', mr: 'रांगेत', bn: 'সারিতে আছে', ta: 'வரிசையில்',
    te: 'క్యూలో ఉంది', gu: 'કતારમાં', kn: 'ಸಾಲಿನಲ್ಲಿ', ml: 'ക്യൂവിൽ', or: 'ଧାଡ଼ିରେ',
    as: 'শাৰীত', ur: 'قطار میں', ne: 'लाममा', sa: 'पङ्क्तौ', gom: 'रांकेंत',
    mai: 'कतार मे', doi: 'कतार च', sd: 'قطار ۾', sat: 'ᱛᱷᱟᱨ ᱨᱮ', 'mni-Mtei': 'ꯀ꯭ꯌꯨꯗ ꯂꯩꯔꯤ',
    brx: 'सारियाव', ks: 'कतार मंज़'
  },
  'Active Mandis': {
    hi: 'सक्रिय मंडियां', pa: 'ਸਰਗਰਮ ਮੰਡੀਆਂ', mr: 'सक्रिय मंड्या', bn: 'সক্রিয় মান্ডি', ta: 'செயலில் உள்ள மண்டிகள்',
    te: 'యాక్టివ్ మండీలు', gu: 'સક્રિય મંડીઓ', kn: 'ಸಕ್ರಿಯ ಮಂಡಿಗಳು', ml: 'സജീവ മണ്ടികൾ', or: 'ସକ୍ରିୟ ମଣ୍ଡି',
    as: 'সক্ৰিয় মণ্ডী', ur: 'فعال منڈیاں', ne: 'सक्रिय मण्डीहरू', sa: 'सक्रियविपणयः', gom: 'सक्रिय मंड्यो',
    mai: 'सक्रिय मंडी सभ', doi: 'सक्रिय मंडियां', sd: 'متحرڪ منڊيون', sat: 'ᱪᱟᱹᱞᱩ ᱢᱟᱱᱰᱤ ᱠᱚ', 'mni-Mtei': 'ꯍꯧꯔꯤꯕ ꯃꯟꯗꯤꯁꯤꯡ',
    brx: 'सावथ्रो मंडीफोर', ks: 'चालू मंडियां'
  }
};

@Controller('translate')
export class TranslationController {
  constructor(@Inject(RedisService) private readonly redis: RedisService) {}

  @Public()
  @Post()
  async translate(@Body() body: unknown) {
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Invalid translation request');
    const { texts, target: rawTarget, source } = parsed.data;

    const target = this.normalizeTargetCode(rawTarget);
    if (target === source || (source === 'en' && target === 'en')) {
      return { source, target, translations: texts };
    }

    const translations: string[] = new Array(texts.length);
    const missing: Array<{ index: number; text: string; key: string }> = [];

    // 1. Check Redis cache
    for (let index = 0; index < texts.length; index += 1) {
      const text = texts[index].trim();
      if (!text) {
        translations[index] = texts[index];
        continue;
      }

      // Check pre-seeded instant dictionary
      const dictEntry = AGRICULTURAL_DICTIONARY[text]?.[target];
      if (dictEntry) {
        translations[index] = dictEntry;
        continue;
      }

      const key = this.cacheKey(source, target, text);
      const cached = await this.redis.get(key).catch(() => null);
      if (cached && cached !== text) {
        translations[index] = cached;
      } else {
        missing.push({ index, text, key });
      }
    }

    // 2. Translate missing phrases through our multi-tier engine
    if (missing.length > 0) {
      const translatedMap = await this.translateMissingTexts(missing.map((m) => m.text), source, target);

      for (let i = 0; i < missing.length; i += 1) {
        const item = missing[i];
        const raw = translatedMap.get(item.text) || item.text;
        const value = this.decodeHtml(raw);
        translations[item.index] = value;

        // CRITICAL: Only cache successful translations in Redis!
        // Never cache untranslated source text into Redis.
        if (value && value.trim().toLowerCase() !== item.text.toLowerCase()) {
          await this.redis.set(item.key, value, 'EX', 60 * 60 * 24 * 30).catch(() => undefined);
        }
      }
    }

    return { source, target, translations };
  }

  @Public()
  @Post('tts')
  async tts(@Body() body: Record<string, any>) {
    const text = String(body?.text ?? '').trim();
    const language = String(body?.language ?? 'hi').toLowerCase().slice(0, 2);
    const gender = String(body?.gender ?? 'female');

    if (!text) throw new BadRequestException('Text is required for TTS synthesis');

    // If Bhashini credentials and inference pipeline are configured, generate AI4Bharat neural audio
    if (env.BHASHINI_API_KEY && env.BHASHINI_INFERENCE_URL) {
      try {
        const bhashiniRes = await fetch(env.BHASHINI_INFERENCE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': env.BHASHINI_API_KEY,
            ...(env.BHASHINI_USER_ID ? { 'userID': env.BHASHINI_USER_ID } : {}),
          },
          body: JSON.stringify({
            pipelineTasks: [
              {
                taskType: 'tts',
                config: {
                  language: { sourceLanguage: language },
                  gender,
                  samplingRate: 22050,
                },
              },
            ],
            inputData: {
              input: [{ source: text }],
            },
          }),
        });

        if (bhashiniRes.ok) {
          const payload = (await bhashiniRes.json()) as {
            pipelineResponse?: Array<{
              taskType?: string;
              audio?: Array<{ audioContent?: string }>;
            }>;
          };
          const ttsTask = payload.pipelineResponse?.find((t) => t.taskType === 'tts');
          const audioBase64 = ttsTask?.audio?.[0]?.audioContent;
          if (audioBase64) {
            return {
              provider: 'bhashini',
              audioContent: audioBase64,
              format: 'wav',
            };
          }
        }
      } catch {
        // Fall back to client synthesis signal
      }
    }

    return {
      provider: 'client_fallback',
      audioContent: null,
      message: 'Use client Web Speech API with Bhashini phonetic formatting',
    };
  }

  private normalizeTargetCode(target: string): string {
    const code = target.trim();
    if (code === 'kok') return 'gom'; // Konkani ISO/Google language code
    if (code === 'mni') return 'mni-Mtei'; // Manipuri Meetei Mayek
    return code;
  }

  private async translateMissingTexts(texts: string[], source: string, target: string): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const remaining: string[] = [];

    // Tier 1: Bhashini (Digital India / AI4Bharat Anuvadini / ULCA Pipeline)
    if (env.BHASHINI_API_KEY && env.BHASHINI_INFERENCE_URL) {
      try {
        const bhashiniRes = await fetch(env.BHASHINI_INFERENCE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': env.BHASHINI_API_KEY,
            ...(env.BHASHINI_USER_ID ? { 'userID': env.BHASHINI_USER_ID } : {}),
          },
          body: JSON.stringify({
            pipelineTasks: [
              {
                taskType: 'translation',
                config: {
                  language: {
                    sourceLanguage: source,
                    targetLanguage: target,
                  },
                },
              },
            ],
            inputData: {
              input: texts.map((t) => ({ source: t })),
            },
          }),
        });

        if (bhashiniRes.ok) {
          const payload = (await bhashiniRes.json()) as {
            pipelineResponse?: Array<{
              taskType?: string;
              output?: Array<{ source?: string; target?: string }>;
            }>;
          };
          const translationTask = payload.pipelineResponse?.find((t) => t.taskType === 'translation');
          const outputList = translationTask?.output || [];
          outputList.forEach((item, idx) => {
            if (item?.target && item.target !== texts[idx]) {
              results.set(texts[idx], item.target);
            }
          });
        }
      } catch {
        // Fall through to next tier
      }
    }

    // Tier 2: Try Google Cloud Translation v2 API if key is present
    if (env.GOOGLE_TRANSLATE_API_KEY) {
      try {
        const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${env.GOOGLE_TRANSLATE_API_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            q: texts,
            source,
            target,
            format: 'text',
          }),
        });
        if (res.ok) {
          const payload = (await res.json()) as { data?: { translations?: Array<{ translatedText: string }> } };
          const list = payload.data?.translations ?? [];
          list.forEach((item, idx) => {
            if (item?.translatedText && item.translatedText !== texts[idx]) {
              results.set(texts[idx], item.translatedText);
            }
          });
        }
      } catch {
        // Fall through to next tier
      }
    }

    // Determine what's still missing
    for (const text of texts) {
      if (!results.has(text)) {
        remaining.push(text);
      }
    }

    if (!remaining.length) return results;

    // Tier 2: Google GTX Neural Client (Batch translation with newline delimiter)
    // Works reliably for: hi, pa, mr, bn, ta, te, gu, kn, ml, or, as, ur, ne, sa, gom, mai, doi, sd, sat, mni-Mtei
    const batchSize = 25;
    const stillUnresolved: string[] = [];

    for (let i = 0; i < remaining.length; i += batchSize) {
      const chunk = remaining.slice(i, i + batchSize);
      try {
        const combined = chunk.join('\n');
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(combined)}`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        });

        if (res.ok) {
          const data = (await res.json()) as Array<Array<[string, string]>>;
          const translatedCombined = (data[0] || []).map((s) => s[0]).join('');
          const splitLines = translatedCombined.split('\n');

          if (splitLines.length === chunk.length) {
            chunk.forEach((original, idx) => {
              const trans = splitLines[idx]?.trim();
              if (trans && trans !== original) {
                results.set(original, trans);
              } else {
                stillUnresolved.push(original);
              }
            });
          } else {
            // Line count mismatch: handle individually
            stillUnresolved.push(...chunk);
          }
        } else {
          // GTX returned non-ok (e.g. 400 for minority language)
          stillUnresolved.push(...chunk);
        }
      } catch {
        stillUnresolved.push(...chunk);
      }
    }

    if (!stillUnresolved.length) return results;

    // Tier 3: MyMemory Translation API & Regional Dialect Fallbacks (e.g. for brx, ks)
    for (const text of stillUnresolved) {
      if (results.has(text)) continue;

      try {
        // MyMemory query
        const mmTarget = target === 'mni-Mtei' ? 'mni' : target;
        const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(source)}|${encodeURIComponent(mmTarget)}`;
        const mmRes = await fetch(mmUrl);
        if (mmRes.ok) {
          const mmData = (await mmRes.json()) as { responseData?: { translatedText?: string } };
          const mmText = mmData.responseData?.translatedText?.trim();
          if (mmText && mmText !== text && !mmText.startsWith('MYMEMORY WARNING')) {
            results.set(text, mmText);
            continue;
          }
        }
      } catch {
        // Continue to regional fallback
      }

      // Tier 4: Regional dialect script fallback
      // For Bodo (brx): official script is Devanagari, closely aligned with Hindi/Assamese
      if (target === 'brx') {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (res.ok) {
            const data = (await res.json()) as Array<Array<[string, string]>>;
            const translated = (data[0] || []).map((s) => s[0]).join('').trim();
            if (translated && translated !== text) {
              results.set(text, translated);
              continue;
            }
          }
        } catch {
          // Ignore
        }
      }

      // For Kashmiri (ks): fallback to Hindi/Urdu
      if (target === 'ks') {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(source)}&tl=hi&dt=t&q=${encodeURIComponent(text)}`;
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
          if (res.ok) {
            const data = (await res.json()) as Array<Array<[string, string]>>;
            const translated = (data[0] || []).map((s) => s[0]).join('').trim();
            if (translated && translated !== text) {
              results.set(text, translated);
              continue;
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    return results;
  }

  private cacheKey(source: string, target: string, text: string) {
    return `translate:${source}:${target}:${createHash('sha256').update(text).digest('hex')}`;
  }

  private decodeHtml(value: string) {
    return value
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'")
      .replaceAll('&apos;', "'");
  }
}
