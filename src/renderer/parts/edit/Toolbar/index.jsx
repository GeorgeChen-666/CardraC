import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import ChatIcon from '@mui/icons-material/Chat';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoIcon from '@mui/icons-material/Info';
import {GeneralIconButton} from '../../../componments/GeneralIconButton'
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../state/store';
import { LangSelectButton } from './LangSelectButton';
import { AboutDialog } from './About/AboutDialog';
import { SetupDialog } from './Setup/SetupDialog';
import { ChatDialog } from './Chat/ChatDialog';
import Switch from '@mui/material/Switch';
import { getImageSrc, openImage } from '../../../functions';
import { exportType, layoutSides, initialState } from '../../../../shared/constants';
import { CompressSelectButton } from './CompressSelectButton';
import { BulkOperationButton } from './BulkOperationButton';
import { FormControlLabel } from '@mui/material';
import { ImageViewer } from '../ImageViewer';

export function EditToolbar() {

  const dialogSetupRef = useRef(null);
  const dialogAboutRef = useRef(null);
  const dialogChatRef = useRef(null);
  const imageViewerRef = useRef(null);
  window.imageViewerRef = imageViewerRef;
  const { t } = useTranslation();
  const {
    saveProject, mergeState,openProject, mergeConfig, mergeGlobal, exportFile
  } = useGlobalStore.getState();
  const {Config, Global, CardList } = useGlobalStore.selectors;
  const cardListLength = CardList().length;
  const globalBackground = Config.globalBackground()
  const isBackEditing = Global.isBackEditing();
  const isShowOverView = Global.isShowOverView();
  return (
    <Box
      sx={{
        p: 0.5,
      }}
    >
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<NoteAddIcon />}
        onClick={() => mergeState({ Config: initialState.Config, CardList: [] })}
      />
      <GeneralIconButton
        label={t('toolbar.btnOpen')}
        icon={<FindInPageIcon />}
        onClick={() => openProject()}
      />
      <GeneralIconButton
        label={t('toolbar.btnSave')}
        icon={<SaveIcon />}
        onClick={() => saveProject()}
      />
      <span style={{ color: '#666', padding: '4px' }}>|</span>
      {Config.sides() === layoutSides.doubleSides && (
        <GeneralIconButton
          label={t('toolbar.btnGlobalBackground')}
          icon={<img src={getImageSrc(globalBackground)} width={'30px'} height={'30px'} alt='' />}
          onClick={async () => {
            const filePath = await openImage('setGlobalBack');
            mergeConfig({ globalBackground: filePath });
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
        label={t('toolbar.btnExport')}
        icon={<PictureAsPdfIcon />}
        onClick={() => exportFile(exportType.pdf)}
      />
      <GeneralIconButton
        label={t('toolbar.btnExport')}
        icon={<PhotoLibraryIcon />}
        onClick={() => exportFile(exportType.png)}
      />
      <span style={{color: '#666', padding:'4px'}}>|</span>
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

      <BulkOperationButton />
      <div style={{ float: 'right' }}>
        <FormControlLabel
          control={<Switch checked={isShowOverView} onChange={() => mergeGlobal({ isShowOverView: !isShowOverView })} />}
          label={t('toolbar.lblShowOverviewWindow')} />
        {Config.sides() === layoutSides.doubleSides && (
          <FormControlLabel
            control={<Switch checked={isBackEditing} onChange={() => mergeGlobal({ isBackEditing: !isBackEditing })} />}
            label={t('toolbar.lblSwitchView')} />
        )}
      </div>

      <SetupDialog ref={dialogSetupRef} />
      <AboutDialog ref={dialogAboutRef} />
      <ImageViewer ref={imageViewerRef} />
      <ChatDialog ref={dialogChatRef} />
    </Box>
  );
}