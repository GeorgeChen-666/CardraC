import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next);

export const initI18n = Global => i18n.init({
  supportedLngs: Global.availableLangs.length === 0 ? [Global.currentLang] : Global.availableLangs,
  lng: Global.currentLang,
  resources:
    Global.availableLangs.map(lang => ({
      [lang]: { translation: Global.locales[lang] }
    })).reduce((l1, l2) => Object.assign(l1, l2), {}),
});

export const i18nInstance = i18n;