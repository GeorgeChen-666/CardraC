import React, { useRef, useContext } from 'react';
import { IconButton } from '@chakra-ui/react';
import { IoIosAdd } from 'react-icons/io';
import { StoreContext, Actions } from '../../store';
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
          //dispatch({ type: Actions.AddCardByFace, payload: [...filePaths] });
        } else {
          inputRef.current?.click();
        }
      }}
    />
    <input
      ref={inputRef}
      style={{ position: 'fixed', top: '-900px' }}
      type='file'
      multiple={true}
      accept='image/jpeg,image/png'
      onChange={() => {
        console.log(inputRef.current?.files);
        // dispatch({
        //   type: Actions.AddCardByFace,
        //   payload: [...inputRef.current?.files].map(f => URL.createObjectURL(f)),
        // });
        inputRef.current.value = '';
      }}
    />
  </div>);
};