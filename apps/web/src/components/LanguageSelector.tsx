import { Globe } from 'lucide-react';
import { useTranslation } from '../context/TranslationContext';
import { SUPPORTED_LANGUAGES, languageByCode, speakText } from '../utils/i18n';
import toast from 'react-hot-toast';

interface LanguageSelectorProps {
  className?: string;
  theme?: 'dark' | 'light';
}

export default function LanguageSelector({ className = '', theme = 'light' }: LanguageSelectorProps) {
  const { language, setLanguage, translating } = useTranslation();

  const handleLangChange = (code: string) => {
    setLanguage(code);
    const selected = languageByCode(code);
    toast.success(`Language set to ${selected?.nativeName || code}`);
    speakText(`AnnSetu platform language set to ${selected?.name || code}`, selected.speechCode);
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-offset-1 ${
        isDark
          ? 'bg-white/10 border-white/15 text-white hover:bg-white/15'
          : 'bg-white border-slate-300 text-slate-800 shadow-sm hover:border-emerald-500'
      } ${className}`}
      data-no-translate="true"
    >
      <Globe className={`w-3.5 h-3.5 shrink-0 ${isDark ? 'text-blue-100' : 'text-emerald-700'}`} />
      <select
        value={language}
        onChange={(e) => handleLangChange(e.target.value)}
        aria-label="Select language"
        className={`bg-transparent text-xs font-semibold focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 cursor-pointer ${
          isDark ? 'text-white' : 'text-slate-800'
        }`}
      >
        {SUPPORTED_LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} className="bg-slate-900 text-white py-1">
            {l.nativeName} ({l.name})
          </option>
        ))}
      </select>
      {translating && (
        <span className={`text-[10px] animate-pulse ${isDark ? 'text-blue-200' : 'text-emerald-600'}`}>
          ...
        </span>
      )}
    </div>
  );
}
