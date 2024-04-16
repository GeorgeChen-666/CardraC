import React, { memo, useEffect } from 'react';
import {
  Card,
  Button,
  Stack,
  Image,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  IconButton,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Checkbox,
} from '@chakra-ui/react';
import { IoIosOpen, IoIosMore, IoIosSwap, IoIosKeypad } from 'react-icons/io';
import styles from './styles.module.css';
import { StoreContext, Actions } from '../../store';
import { emptyImg } from '../ToolBar/ExportPdf';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';

export default memo(({ data, index }) => {
  console.log('rending', index);
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'sides',
    ])
  ), shallowEqual);
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isBackEditing',
      'lastSelection',
      'selection',
    ])
  ), shallowEqual);
  const newSelectionIds = useSelector((state) => {
    const lastSelection = state.pnp.Global.lastSelection;
    const lastSelectionIndex = state.pnp.CardList.findIndex(c => c.id === lastSelection);
    const currentSelectionIndex = state.pnp.CardList.findIndex(c => c.id === data.id);
    if(lastSelectionIndex + currentSelectionIndex > -1) {
      return state.pnp.CardList.filter((c, i) => {
        const ia = [lastSelectionIndex, currentSelectionIndex];
        return (i >= Math.min(...ia) && i <= Math.max(...ia));
      }).map(c => c.id)
    } else {
      return [];
    }
  }, shallowEqual);
  const dispatch = useDispatch();
  const isBackEditing = Global.isBackEditing;
  return (<Card className={styles.Card} size={'sm'} padding={2} onClick={(event) => {
    if (event.shiftKey && newSelectionIds.length > 0) {
      dispatch(Actions.EditGlobal({ selection: new Set(newSelectionIds) }));
    } else {
      if (Global.selection.has(data.id)) {
        dispatch(Actions.EditGlobal({ selection: new Set([]), lastSelection: null }));
      } else {
        dispatch(Actions.EditGlobal({ selection: new Set([data.id]), lastSelection: data.id }));
      }
    }
  }}>
    <div className={styles.CardBar}>
      <Menu>
        <IconButton
          size={'xs'}
          isDisabled={Config.sides === 1}
          aria-label='Options'
          icon={<IoIosSwap />}
          variant='outline'
          onClick={(e) => {
            e.stopPropagation();
            dispatch(Actions.EditCardById({ id: data.id, face: data.back, back: data.face }));
            //dispatch({ type: Actions.EditCardById, payload: { id: data.id, face: data.back, back: data.face } });
          }}
        />
        <span className={styles.CardDragHandler} onClick={e=>e.stopPropagation()}><IoIosKeypad /><IoIosKeypad /></span>
        <MenuButton
          size={'xs'}
          as={IconButton}
          aria-label='Options'
          icon={<IoIosMore />}
          variant='outline'
          onClick={e => e.stopPropagation()}
        />
        <MenuList>
          <MenuItem icon={<IoIosOpen />} command='⌘T'>
            New Tab
          </MenuItem>
        </MenuList>
      </Menu>
    </div>
    <div className={styles.CardMain}>
      <Stack direction='row' justifyContent={'center'}>
        <Image className={styles.CardImage} boxSize={isBackEditing ? '50px' : '160px'} src={data.face?.path}
               fallbackSrc={emptyImg.path} />
        {Config.sides === 'double sides' && (
          <Image className={styles.CardImage}
                 boxSize={isBackEditing ? '160px' : '50px'}
                 src={data.back?.path}
                 fallbackSrc={emptyImg.path}
          />
        )}

      </Stack>
    </div>
    <div className={styles.CardBar}>
      <Checkbox isChecked={Global.selection.has(data.id)}>#{index + 1}</Checkbox>
      <NumberInput size='xs' maxW={16} defaultValue={1} min={1}
                   onClick={(e) => e.stopPropagation()}
                   onChange={($, value) => {
                     dispatch(Actions.EditCardById({ id: data.id, repeat: value }));
                   }}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
    </div>
    <div>
      <Button width='100%' size='sm' onClick={() => {
        dispatch(Actions.RemoveCardByIds([data.id]));
        //dispatch({ type: Actions.RemoveCardById, payload: data.id });
      }}>
        Remove image
      </Button>
    </div>
  </Card>);
});
