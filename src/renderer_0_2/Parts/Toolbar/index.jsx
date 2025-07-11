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
import { useGlobalStore, initialState } from '../../State/store';
import { LangSelectButton } from './LangSelectButton';
import { AboutDialog } from './About/AboutDialog';
import { SetupDialog } from './Setup/SetupDialog';
import { ReloadDialog } from './ReloadImg/ReloadDialog';
import { getImageSrc, openImage } from '../../functions';
import { layoutSides } from '../../../public/constants';
import { CompressSelectButton } from './CompressSelectButton';
import { BulkOperationButton } from './BulkOperationButton';

function IconToolbar() {

  const dialogSetupRef = useRef(null);
  const dialogAboutRef = useRef(null);
  const { t } = useTranslation();
  const {
    saveProject, mergeState,openProject, mergeConfig
  } = useGlobalStore.getState();
  const {Config, CardList } = useGlobalStore.selectors;
  const cardListLength = CardList().length;
  const selectionLength = useGlobalStore(state => state.CardList.filter(c => c.selected).length);
  console.log(selectionLength);
  return (
    <Box
      sx={{
        p: 0.5,
      }}
    >
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<NoteAddIcon />}
        onClick={ () => mergeState({ Config: initialState.Config, CardList:[]}) }
      />
      <GeneralIconButton
        label={t('toolbar.btnOpen')}
        icon={<FindInPageIcon />}
        onClick={ () => {
          openProject();
        }}
      />
      {/*<GeneralIconButton*/}
      {/*  label={t('toolbar.btnReloadImage')}*/}
      {/*  icon={<ReplayIcon />}*/}
      {/*  onClick={ () => dialogReloadRef.current.openDialog() }*/}
      {/*  disabled={cardListLength === 0}*/}
      {/*/>*/}
      <CompressSelectButton
        label={t('toolbar.compressLevel')}
        disabled={cardListLength === 0}
      />

      <GeneralIconButton
        label={t('toolbar.btnSave')}
        icon={<SaveIcon />}
        onClick={saveProject}
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
      {Config.sides() === layoutSides.doubleSides && (
        <GeneralIconButton
          label={t('toolbar.btnGlobalBackground')}
          icon={<img src={getImageSrc(Config.globalBackground())} width={'30px'} height={'30px'} alt='' />}
          onClick={async () => {
            const filePath = await openImage('setGlobalBack');
            mergeConfig({ globalBackground: filePath });
          }}
        />
      )}
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
      <div style={{float:'right'}}>asdsadsa</div>

      <SetupDialog ref={dialogSetupRef} />
      <AboutDialog ref={dialogAboutRef} />
    </Box>
  );
}

export default IconToolbar;