import React from 'react';
import {
  ChakraProvider,
  Box,
  GridItem,
  Grid,
  theme,
} from '@chakra-ui/react';
import {StoreProvider} from './store'
import {ToolBar} from './components/ToolBar/ToolBar';
import {CardEditorList} from './components/Card/CardEditorList';
import { Footer } from './components/Footer';

function App() {
  return (
    <StoreProvider>
      <ChakraProvider theme={theme}>
        <Box>
          <Grid
            templateAreas={`"header"
                    "main"
                    "footer"`}
            gridTemplateRows={'50px 1fr 30px'}
            minH="100vh"
            gap='1'
            color='blackAlpha.700'
            fontWeight='bold'
          >
            <GridItem pl='2' area={'header'}>
              <ToolBar />
            </GridItem>
            <GridItem pl='2' area={'main'}>
              <CardEditorList />
            </GridItem>
            <GridItem pl='2' area={'footer'}>
              <Footer />
            </GridItem>
          </Grid>
        </Box>
      </ChakraProvider>
    </StoreProvider>
  );
}

export default App;
