import styles from './styles.module.css';
import { Card } from '@chakra-ui/react';
import React from 'react';
import { useDrop } from 'react-dnd';
import { Actions } from '../../store';
import { useDispatch } from 'react-redux';

export const CardDragTarget = ({index}) => {
  const dispatch = useDispatch();
  const [, dropRef] = useDrop({
    accept: 'Card',
    drop: () => {
      dispatch(Actions.MoveSelectedCards({to:index}));
    },
  });
  return (<Card ref={dropRef} className={styles.Card} size={'sm'} padding={2}>here...</Card>)
}