import './styles.css';
import { Card } from '@chakra-ui/react';
import React from 'react';
import { useDrop } from 'react-dnd';
import { Actions } from '../../store';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

export const CardDragTarget = ({index}) => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  const [, dropRef] = useDrop({
    accept: 'Card',
    drop: () => {
      dispatch(Actions.SelectedCardsMove());
    },
  });
  return (<Card ref={dropRef} className={'Card'} size={'sm'} padding={2}>{t('cardEditor.lblHere')}</Card>)
}