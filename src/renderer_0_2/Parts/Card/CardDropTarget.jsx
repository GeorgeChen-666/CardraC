import { useTranslation } from 'react-i18next';
import { useDrop } from 'react-dnd';
import React from 'react';
import Card from '@mui/material/Card';
import { useStore } from '../../State/store';

export default ({index}) => {
  const { t } = useTranslation();
  const {
    dragCardsMove
  } = useStore.getState();
  const [, dropRef] = useDrop({
    accept: 'Card',
    drop: () => {
      dragCardsMove();
      console.log('111')
    },
  });
  return (<Card ref={dropRef} className={'Card'} size={'sm'} padding={2}>{t('cardEditor.lblHere')}</Card>)
}