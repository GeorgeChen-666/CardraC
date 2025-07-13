import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoIcon from '@mui/icons-material/Info';
import {GeneralIconButton} from '../../Componments/GeneralIconButton'
import { useTranslation } from 'react-i18next';
import { useGlobalStore, initialState } from '../../State/store';
import { LangSelectButton } from './LangSelectButton';
import { AboutDialog } from './About/AboutDialog';
import { SetupDialog } from './Setup/SetupDialog';
import Switch from '@mui/material/Switch';
import { getImageSrc, openImage } from '../../functions';
import { layoutSides } from '../../../public/constants';
import { CompressSelectButton } from './CompressSelectButton';
import { BulkOperationButton } from './BulkOperationButton';
import { FormControlLabel } from '@mui/material';
import { ImageViewer } from '../ImageViewer';

function IconToolbar() {

  const dialogSetupRef = useRef(null);
  const dialogAboutRef = useRef(null);
  const imageViewerRef = useRef(null);
  window.imageViewerRef = imageViewerRef;
  const { t } = useTranslation();
  const {
    saveProject, mergeState,openProject, mergeConfig, mergeGlobal, exportPdf
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
          onMouseOver={() => imageViewerRef.current?.update?.(globalBackground)}
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
        onClick={() => exportPdf()}
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
    </Box>
  );
}

export default IconToolbar;