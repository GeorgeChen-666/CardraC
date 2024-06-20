import React, { useRef } from 'react';
import { IconButton } from '@chakra-ui/react';
import { IoIosAdd } from 'react-icons/io';
import { Actions } from '../../store';
import './styles.css';
import { openMultiImage } from '../../functions';
import { useDispatch } from 'react-redux';

export const AddCard = () => {
  const dispatch = useDispatch();
  const inputRef = useRef();
  return (<div className={'Card'}>
    <IconButton
      fontSize={100}
      height={286}
      width={'100%'}
      icon={<IoIosAdd />}
      variant='outline'
      onClick={async () => {
        if (process?.versions?.electron) {
          const imageData = await openMultiImage('CardAddByFaces');
          dispatch(Actions.CardAddByFaces([...imageData]));
        } else {
          inputRef.current?.click();
        }
      }}
    />
  </div>);
};