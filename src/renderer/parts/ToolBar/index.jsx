import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoIcon from '@mui/icons-material/Info';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { GeneralIconButton } from '../../componments/GeneralIconButton';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../state/store';
import { LangSelectButton } from './LangSelectButton';
import { AboutDialog } from './About/AboutDialog';
import { SetupDialog } from './Setup/SetupDialog';
import { ChatDialog } from './Chat/ChatDialog';
import { clearPreviewCache, openImage, showFileOpenDialog } from '../../functions';
import { exportType, layoutSides } from '../../../shared/constants';
import { CompressSelectButton } from './CompressSelectButton';
import { ImageViewer } from '../edit/ImageViewer';
import { imagePathToImageSrc } from '../../../shared/functions';
import PrintIcon from '@mui/icons-material/Print';
import { PrintDrawer } from './Print/PrintDrawer';

const ExportIcon = ({ label = 'PDF' }) => (
  <svg width='24' height='24' viewBox='0 0 24 24' fill='currentColor'>
    <path d='M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z' />
    <path d='M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6z' />
    <text
      x='14'
      y='12'
      textAnchor='middle'
      fontSize='6'
      fontWeight='900'
      fontFamily='Arial, sans-serif'
      fill='#2E2E2E'
      stroke='#2E2E2E'
      strokeWidth='0.2'
    >
      {label.toUpperCase()}
    </text>
  </svg>
);

export function BaseToolbar({ SubMenu }) {
  const drawerPrintRef = useRef(null);
  const dialogSetupRef = useRef(null);
  const dialogAboutRef = useRef(null);
  const dialogChatRef = useRef(null);
  const imageViewerRef = useRef(null);
  window.imageViewerRef = imageViewerRef;
  window.drawerPrintRef = drawerPrintRef;
  const { t } = useTranslation();
  const {
    saveProject, newProject, openProject, mergeConfig, mergeGlobal, getExportPageCount, exportFile,
  } = useGlobalStore.getState();
  const canUndo = useGlobalStore(state => state.History.canUndo);
  const canRedo = useGlobalStore(state => state.History.canRedo);
  const historyUndo = useGlobalStore(state => state.historyUndo);
  const historyRedo = useGlobalStore(state => state.historyRedo);
  const { Config, Global, CardList } = useGlobalStore.selectors;
  const cardListLength = CardList().length;
  const globalBackground = Config.globalBackground();
  const imageVersion = Global.imageVersion();
  return (
    <Box
      sx={{
        p: 0.5,
      }}
    >
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<NoteAddIcon />}
        onClick={async () => {
          await newProject();
          await getExportPageCount();
          mergeGlobal({ imageVersion: Date.now() });
        }}
      />
      <GeneralIconButton
        label={t('toolbar.btnOpen')}
        icon={<FindInPageIcon />}
        onClick={async () => {
          const selectedFiles = await showFileOpenDialog({ filterExtensions: 'cpnp' });
          if (selectedFiles.length === 0) {
            return;
          }
          openProject({ filePath: selectedFiles[0][0].realPath });
          await getExportPageCount();
          mergeGlobal({ imageVersion: Date.now() });
        }}
      />
      <GeneralIconButton
        label={t('toolbar.btnSave')}
        icon={<SaveIcon />}
        onClick={async () => {
          const selectedFile = await showFileOpenDialog({ filterExtensions: 'cpnp', mode: 'save' });
          if (!selectedFile) {
            return;
          }
          saveProject({ filePath: selectedFile.realPath });
        }}
      />
      <GeneralIconButton
        disabled={!canUndo}
        label={t('toolbar.btnUndo')}
        icon={<UndoIcon />}
        onClick={async () => {
          await clearPreviewCache();
          historyUndo();
        }}
      />
      <GeneralIconButton
        disabled={!canRedo}
        label={t('toolbar.btnRedo')}
        icon={<RedoIcon />}
        onClick={async () => {
          await clearPreviewCache();
          historyRedo();
        }}
      />
      <span style={{ color: '#666', padding: '4px' }}>|</span>
      {[layoutSides.doubleSides, layoutSides.foldInHalf].includes(Config.sides()) && (
        <GeneralIconButton
          label={t('toolbar.btnGlobalBackground')}
          icon={<img src={imagePathToImageSrc(globalBackground?.path, { version: imageVersion })} width={'21px'}
                     height={'21px'} alt='' />}
          onClick={async () => {
            const selectedFiles = await openImage();

            mergeConfig({ globalBackground: selectedFiles?.[0]?.face });
          }}
          onMouseOver={() => imageViewerRef.current?.update?.(globalBackground?.path)}
          onMouseLeave={() => imageViewerRef.current?.close?.()}
        />
      )}
      <CompressSelectButton
        label={t('toolbar.compressLevel')}
        disabled={cardListLength === 0}
      />
      <GeneralIconButton
        label={t('toolbar.btnExport', { format: 'PDF' })}
        icon={<ExportIcon />}
        onClick={async () => {
          const selectedFile = await showFileOpenDialog({ filterExtensions: exportType.pdf, mode: 'save' });
          if (!selectedFile) {
            return;
          }
          exportFile({ filePath: selectedFile.realPath, targetFileType: exportType.pdf });
        }}
      />
      <GeneralIconButton
        label={t('toolbar.btnExport', { format: 'PNG' })}
        icon={<ExportIcon label={'png'} />}
        onClick={async () => {
          const selectedFile = await showFileOpenDialog({ filterExtensions: exportType.zip, mode: 'save' });
          if (!selectedFile) {
            return;
          }
          exportFile({ filePath: selectedFile.realPath, targetFileType: exportType.png });
        }}
      />
      {/*<GeneralIconButton*/}
      {/*  label={t('toolbar.btnExport')}*/}
      {/*  icon={<ExportIcon label={'svg'} />}*/}
      {/*  onClick={() => exportFile(exportType.svg)}*/}
      {/*/>*/}
      <GeneralIconButton
        disabled={cardListLength === 0}
        label={t('toolbar.print')}
        icon={<PrintIcon />}
        onClick={() => {
          drawerPrintRef.current.openDrawer();
        }}
      />
      <span style={{ color: '#666', padding: '4px' }}>|</span>
      <LangSelectButton label={t('toolbar.btnLang')} />
      <GeneralIconButton
        label={t('toolbar.btnConfig')}
        icon={<SettingsIcon />}
        onClick={() => {
          dialogSetupRef.current.openDialog();
        }}
      />
      <GeneralIconButton
        label='Chat'
        icon={<ChatIcon />}
        onClick={() => {
          dialogChatRef.current.openDialog();
        }}
      />
      <GeneralIconButton
        label='GitHub'
        icon={<GitHubIcon />}
        onClick={() => window.open('https://github.com/GeorgeChen-666/CardraC')}
      />
      <GeneralIconButton
        label={t('toolbar.btnAbout')}
        icon={<InfoIcon />}
        onClick={() => {
          dialogAboutRef.current.openDialog();
        }}
      />
      {SubMenu && <SubMenu />}

      <SetupDialog ref={dialogSetupRef} />
      <AboutDialog ref={dialogAboutRef} />
      <ImageViewer ref={imageViewerRef} />
      <ChatDialog ref={dialogChatRef} />
      <PrintDrawer
        ref={drawerPrintRef}
        // onOpenChange={setIsDrawerOpen}
      />
    </Box>
  );
}