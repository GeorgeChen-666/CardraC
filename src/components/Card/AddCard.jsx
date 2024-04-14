import React, { useRef, useContext, useEffect } from 'react';
import { IconButton } from '@chakra-ui/react';
import { IoIosAdd } from 'react-icons/io';
import { StoreContext, Actions } from '../../store';
import styles from './styles.module.css';

const { ipcRenderer } = require('electron');

export const AddCard = () => {
  const { state, dispatch } = useContext(StoreContext);
  const inputRef = useRef();
  useEffect(() => {
    const onFileOpen = (event, filePaths) => {
      dispatch({ type: Actions.AddCardByFace, payload: [...filePaths] });
    };
    ipcRenderer.on('addCardReturn', onFileOpen);
    return () => ipcRenderer.off('addCardReturn', onFileOpen);
  }, []);
  return (<div className={styles.Card}>
    <IconButton
      fontSize={100}
      height={286}
      width={'100%'}
      aria-label='Options'
      icon={<IoIosAdd />}
      variant='outline'
      onClick={() => {
        if (process?.versions?.electron) {
          ipcRenderer.send('open-image', {
            properties: ['multiSelections'],
            returnChannel: 'addCardReturn'
          });
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
        dispatch({
          type: Actions.AddCardByFace,
          payload: [...inputRef.current?.files].map(f => URL.createObjectURL(f)),
        });
        inputRef.current.value = '';
      }}
    />
  </div>);
};