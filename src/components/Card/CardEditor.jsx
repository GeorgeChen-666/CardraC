import React, { useContext } from 'react';
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

export const CardEditor = ({ data, index }) => {
  const { dispatch, state } = useContext(StoreContext);
  const {Config} = state;
  const isBackEditing = state.Global.isBackEditing;
  return (<Card className={styles.Card} size={'sm'} padding={2} onClick={(event) => {
    const lastSelection = state.Global.lastSelection;
    const cardList = state.CardList;
    const lastSelectionIndex = state.CardList.findIndex(c => c.id === lastSelection);
    const currentSelectionIndex = state.CardList.findIndex(c => c.id === data.id);
    if (event.shiftKey && lastSelectionIndex + currentSelectionIndex > -1) {
      const newSelectionIds = cardList.filter((c, i) => {
        const ia = [lastSelectionIndex, currentSelectionIndex];
        return (i >= Math.min(...ia) && i <= Math.max(...ia));
      }).map(c => c.id);
      dispatch({ type: Actions.EditGlobal, payload: { selection: new Set(newSelectionIds) } });
    } else {
      if (state.Global.selection.has(data.id)) {
        dispatch({ type: Actions.EditGlobal, payload: { selection: new Set([]), lastSelection: null } });
      } else {
        dispatch({ type: Actions.EditGlobal, payload: { selection: new Set([data.id]), lastSelection: data.id } });
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
          onClick={() => {
            dispatch({ type: Actions.EditCardById, payload: { id: data.id, face: data.back, back: data.face } });
          }}
        />
        <span className={styles.CardDragHandler}><IoIosKeypad /><IoIosKeypad /></span>
        <MenuButton
          size={'xs'}
          as={IconButton}
          aria-label='Options'
          icon={<IoIosMore />}
          variant='outline'
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
        <Image className={styles.CardImage} boxSize={isBackEditing ? '50px' : '160px'} src={data.face}
               fallbackSrc={emptyImg} />
        {Config.sides === 'double sides' && (
          <Image className={styles.CardImage}
                 boxSize={isBackEditing ? '160px' : '50px'}
                 src={data.back}
                 fallbackSrc={emptyImg}
          />
        )}

      </Stack>
    </div>
    <div className={styles.CardBar}>
      <Checkbox isChecked={state.Global.selection.has(data.id)}>#{index + 1}</Checkbox>
      <NumberInput size='xs' maxW={16} defaultValue={1} min={1} onChange={($, value) => {
        dispatch({ type: Actions.EditCardById, payload: { repeat: value } });
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
        dispatch({ type: Actions.RemoveCardById, payload: data.id });
      }}>
        Remove image
      </Button>
    </div>
  </Card>);
};
