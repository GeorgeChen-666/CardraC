import i18n from 'i18next';
import Backend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

i18n
  .use(Backend)
  .use(LanguageDetector)
  .use(initReactI18next);

  // .init({
  //   supportedLngs: ['zh', 'en'],
  //   lng: 'zh',
  //   fallbackLng: 'en',
  //   backend: {
  //     loadPath: getResourcesPath('/public/locales/{{lng}}.json'),
  //   },
  //   // debug: true,
  // });
export const i18nInstance = i18n;