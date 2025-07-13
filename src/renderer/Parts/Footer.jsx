import * as React from 'react';
import Stack from '@mui/material/Stack';
import { useGlobalStore } from '../State/store';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

export const Footer = () => {
  const { t } = useTranslation();
  const fileLength = useGlobalStore(state => state.CardList.length);
  const cardLength = useGlobalStore(state => _.sum(state.CardList.map(c => c.repeat || 1)));
  const selectionLength = useGlobalStore(state => state.CardList.filter(c => c.selected).length);
  return (
    <Stack direction="row" spacing={2}>
      <span>{t('footer.files')} {fileLength} / {t('footer.images')} {cardLength} / {t('footer.selectedFiles')} {selectionLength}</span>
      <span></span>
      <span></span>
    </Stack>
  )
}