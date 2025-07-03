import React, { useRef } from 'react';
import Box from '@mui/material/Box';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import ReplayIcon from '@mui/icons-material/Replay';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import GitHubIcon from '@mui/icons-material/GitHub';
import InfoIcon from '@mui/icons-material/Info';
import {GeneralIconButton} from '../../Componments/GeneralIconButton'
import { useTranslation } from 'react-i18next';
import { useStore, initialState } from '../../State/store';
import { LangSelectButton } from './LangSelectButton';
import { AboutDialog } from './About/AboutDialog';
import { SetupDialog } from './Setup/SetupDialog';

function IconToolbar() {
  const dialogSetupRef = useRef(null);
  const dialogAboutRef = useRef(null);
  const { t } = useTranslation();
  const fillState = useStore(state => state.fillState);
  const mergeState = useStore(state => state.mergeState);
  const openProject = useStore(state => state.openProject);
  return (
    <Box
      sx={{
        p: 0.5,
      }}
    >
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<NoteAddIcon />}
        onClick={ () => fillState(initialState) }
      />
      <GeneralIconButton
        label={t('toolbar.btnOpen')}
        icon={<FindInPageIcon />}
        onClick={ () => {
          openProject();
        }}
      />
      <GeneralIconButton
        label={t('toolbar.btnReloadImage')}
        icon={<ReplayIcon />}
        onClick={ () => mergeState({ Global: {
            loadingText: new Date().getTime()
          } }) }
      />
      <GeneralIconButton
        label={t('toolbar.btnSave')}
        icon={<SaveIcon />}
        // onClick={}
      />
      <LangSelectButton label={t('toolbar.btnLang')} />
      <GeneralIconButton
        label={t('toolbar.btnConfig')}
        icon={<SettingsIcon />}
        onClick={() => {
          dialogSetupRef.current.openDialog();
        }}
      />
      <GeneralIconButton
        label={t('toolbar.btnExport')}
        icon={<PictureAsPdfIcon />}
        // onClick={}
      />
      <GeneralIconButton
        label='GitHub'
        icon={<GitHubIcon />}
        // onClick={}
      />
      <GeneralIconButton
        label={t('toolbar.btnAbout')}
        icon={<InfoIcon />}
        onClick={() => {
          dialogAboutRef.current.openDialog();
        }}
      />
      <SetupDialog ref={dialogSetupRef} />
      <AboutDialog ref={dialogAboutRef} />
    </Box>
  );
}

export default IconToolbar;