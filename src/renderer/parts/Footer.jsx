import * as React from 'react';
import Stack from '@mui/material/Stack';
import { useGlobalStore } from '../state/store';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { ChipToggleGroup } from '../componments/ChipToggleGroup';
import { clearPreviewCache } from '../functions';
import { BackendTasksIndicator } from '../componments/BackendTasksIndicator';

export const Footer = () => {
  const { t } = useTranslation();
  const fileLength = useGlobalStore(state => state.CardList.length);
  const cardLength = useGlobalStore(state => _.sum(state.CardList.map(c => parseInt(c.repeat) || 1)));

  const { mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const currentView = Global.currentView();

  const options = [
    { label: t('footer.editView'), value: 'edit' },
    { label: t('footer.previewView'), value: 'preview' }
  ];
  return (
    <Stack padding={'0 3px'} marginBottom={'3px'} alignItems={'center'} justifyContent={'space-between'} direction='row' spacing={2}>
      <span>{t('footer.files')} {fileLength} / {t('footer.images')} {cardLength}</span>
      <BackendTasksIndicator />
      <span></span>
      <span>
        <ChipToggleGroup
          options={options}
          value={currentView || 'edit'}
          onChange={async (view) => {
            await clearPreviewCache();
            mergeGlobal({currentView: view})
          }}
        />
      </span>
    </Stack>
  );
};