import * as React from 'react';
import Stack from '@mui/material/Stack';
import { EditToolbar } from './edit/Toolbar';
import { CardList } from './edit/Card/CardList';
import { Footer } from './Footer';
import { LoadingModal } from './LoadingModal';
import { Notification } from './Notification';
import { useGlobalStore } from '../state/store';
import { PreviewToolbar } from './preview/ToolBar';
import { PrintPreview } from './preview/PrintPreview';
import { useRef } from 'react';

export const Main = () => {
  const { Global } = useGlobalStore.selectors;
  const currentView = Global.currentView() || 'edit';
  const printPreviewRef = useRef(null);

  React.useEffect(() => {
    window.printPreviewRef = printPreviewRef;
  }, []);

  return (<>
    <Stack height={'100vh'}>
      {currentView === 'edit' && (<>
        <EditToolbar />
        <CardList />
      </>)}
      {currentView === 'preview' && (<>
        <PreviewToolbar previewRef={printPreviewRef} />
        <PrintPreview ref={printPreviewRef} />
      </>)}
      <Footer />
    </Stack>
    <LoadingModal />
    <Notification />
  </>)
}
