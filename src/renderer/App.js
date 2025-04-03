import React from 'react';
import { ChakraProvider, Flex, theme } from '@chakra-ui/react';
import { ToolBar } from './components/ToolBar/ToolBar';
import { CardEditorList } from './components/Card/CardEditorList';
import { Footer } from './components/Footer';
import { LoadingModal } from './components/LoadingModal';
import { Notification } from './components/Notification';

function App() {
  return (
    <ChakraProvider theme={theme}>
      <LoadingModal />
      <Notification />
      <Flex direction={"column"} height={'100vh'} overflow={'hidden'}>
        <ToolBar />
        <CardEditorList />
        <Footer />
      </Flex>
    </ChakraProvider>
  );
}

export default App;
