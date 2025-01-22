import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ChakraProvider,
  theme, Flex,
} from '@chakra-ui/react';
import { ToolBar } from './components/ToolBar/ToolBar';
import { CardEditorList } from './components/Card/CardEditorList';
import { Footer } from './components/Footer';
import { i18nInstance } from './i18n';
import _ from 'lodash';
import { LoadingModal } from './components/LoadingModal';
import { Notification } from './components/Notification';

function App() {

  const [isI18nReady, setIsI18nReady] = useState(false);
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'currentLang',
      'availableLangs',
      'locales',
    ])
  ), shallowEqual);
  useEffect(() => {
    i18nInstance.init({
      supportedLngs: Global.availableLangs,
      lng: Global.currentLang,
      resources:
        Global.availableLangs.map(lang => ({
          [lang]: { translation: Global.locales[lang] }
        })).reduce((l1, l2) => Object.assign(l1, l2), {}),
    });
    setIsI18nReady(true);
  }, []);

  return (
    <>
      {isI18nReady && (<ChakraProvider theme={theme}>
        <LoadingModal />
        <Notification />
        <Flex direction={"column"} height={'100vh'} overflow={'hidden'}>
          <ToolBar />
          <CardEditorList />
          <Footer />
        </Flex>
      </ChakraProvider>)}
    </>
  );
}

export default App;
