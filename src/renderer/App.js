import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  ChakraProvider,
  Box,
  GridItem,
  Grid,
  theme,
} from '@chakra-ui/react';
import { ToolBar } from './components/ToolBar/ToolBar';
import { CardEditorList } from './components/Card/CardEditorList';
import { Footer } from './components/Footer';
import { i18nInstance } from './i18n';
import _ from 'lodash';
import { LoadingModal } from './components/LoadingModal';

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
        <Box>
          <Grid
            templateAreas={`"header"
                    "main"
                    "footer"`}
            gridTemplateRows={'50px 1fr 30px'}
            height='100vh'
            gap='1'
            color='blackAlpha.700'
            fontWeight='bold'
            overflow={'hidden'}
          >
            <GridItem pl='2' area={'header'}>
              <ToolBar />
            </GridItem>
            <GridItem pl='2' area={'main'} overflow={'auto'}>
              <CardEditorList />
            </GridItem>
            <GridItem pl='2' area={'footer'}>
              <Footer />
            </GridItem>
          </Grid>
        </Box>
      </ChakraProvider>)}
    </>
  );
}

export default App;
