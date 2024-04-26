import React, { memo, useCallback } from 'react';
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
import { IoIosMore, IoIosSwap, IoIosKeypad } from 'react-icons/io';
import './styles.css';
import { Actions } from '../../store';
import { emptyImg } from '../ToolBar/ExportPdf';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { useDrag, useDrop } from 'react-dnd';

export default memo(({ data, index }) => {
  const [, dropRef] = useDrop({
    accept: 'Card',
    hover({ id: draggedId }) {
      if (draggedId !== data.id) {
        dispatch(Actions.MoveDragHover({to:index}));
      }
    },
    drop: () => {
      dispatch(Actions.MoveSelectedCards({to:index}));
    },
  });

  const [{ isDragging }, dragRef, previewRef] = useDrag({
    item: { id: data.id, originalIndex: index },
    isDragging: (monitor) => data.selected || monitor.getItem().id === data.id,
    type: 'Card',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });
  console.log('rending', index, isDragging);
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'sides',
    ])
  ), shallowEqual);
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isBackEditing',
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  const onSelectCard = useCallback((event) => {
    if (event.shiftKey) {
      dispatch(Actions.ShiftSelectCard(data.id));
    } else {
      dispatch(Actions.SelectCard(data.id));
    }
  }, [data.id])
  const isBackEditing = Global.isBackEditing;
  return (<Card ref={node => previewRef(dropRef(node))} style={{ display: (isDragging ? 'none': 'unset') }} className={'Card'} size={'sm'} padding={2}
                onClick={onSelectCard}>
    <div className={'CardBar'}>
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
          }}
        />
        <span ref={dragRef} className={'CardDragHandler'}
              onMouseDown={e=>{
                if(!data.selected) {
                  dispatch(Actions.SelectCard(data.id));
                }
              }}
              onClick={e => e.stopPropagation()}
        ><IoIosKeypad /><IoIosKeypad /></span>
        <MenuButton
          size={'xs'}
          as={IconButton}
          aria-label='Options'
          icon={<IoIosMore />}
          variant='outline'
          onClick={e => e.stopPropagation()}
        />
        <MenuList>
          <MenuItem>
            Background..
          </MenuItem>
          <MenuItem>
            Duplicate
          </MenuItem>
        </MenuList>
      </Menu>
    </div>
    <div className={'CardMain'}>
      <Stack direction='row' justifyContent={'center'}>
        <Image className={'CardImage'} boxSize={isBackEditing ? '50px' : '160px'} src={data.face?.path}
               fallbackSrc={emptyImg.path} />
        {Config.sides === 'double sides' && (
          <Image className={'CardImage'}
                 boxSize={isBackEditing ? '160px' : '50px'}
                 src={data.back?.path}
                 fallbackSrc={emptyImg.path}
          />
        )}

      </Stack>
    </div>
    <div className={'CardBar'}>
      <Checkbox isChecked={data.selected} onClick={onSelectCard}>#{index + 1}</Checkbox>
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
      }}>
        Remove image
      </Button>
    </div>
  </Card>);
});
