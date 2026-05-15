import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './en.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'cwc-i18n-lng',
      caches: ['localStorage'],
    },
  });

// Keep <html lang> in sync with i18next so screen readers announce the right
// language. Sync once on init, then on every change.
const syncHtmlLang = (lng: string) => {
  if (typeof document !== 'undefined' && lng) {
    document.documentElement.lang = lng;
  }
};
syncHtmlLang(i18n.resolvedLanguage ?? i18n.language ?? 'en');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;