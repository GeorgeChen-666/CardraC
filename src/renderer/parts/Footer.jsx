import * as React from 'react';
import Stack from '@mui/material/Stack';
import { useGlobalStore } from '../state/store';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { ChipToggleGroup } from '../componments/ChipToggleGroup';

export const Footer = () => {
  const { t } = useTranslation();
  const fileLength = useGlobalStore(state => state.CardList.length);
  const cardLength = useGlobalStore(state => _.sum(state.CardList.map(c => c.repeat || 1)));
  const selectionLength = useGlobalStore(state => state.CardList.filter(c => c.selected).length);

  const { mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const currentView = Global.currentView();

  const [selected, setSelected] = useState(currentView || 'edit');
  const options = [
    { label: '编辑视图', value: 'edit' },
    { label: '预览视图', value: 'preview' }
  ];
  return (
    <Stack padding={'0 3px'} alignItems={'center'} justifyContent={'space-between'} direction='row' spacing={2}>
      <span>{t('footer.files')} {fileLength} / {t('footer.images')} {cardLength} / {t('footer.selectedFiles')} {selectionLength}</span>
      <span></span>
      <span>
        <ChipToggleGroup
          options={options}
          value={selected}
          onChange={(view) => {
            setSelected(view);
            mergeGlobal({currentView: view})
          }}
        />
      </span>
    </Stack>
  );
};