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
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { getImageSrc, getNotificationTrigger, openImage } from '../../functions';
import { layoutSides } from '../../../public/constants';

export default memo(({ data, index }) => {
  const dispatch = useDispatch();
  const imageViewerRef = window.imageViewerRef;
  const { t } = useTranslation();
  const [, dropRef] = useDrop({
    accept: 'Card',
    hover({ id: draggedId }) {
      if (draggedId !== data.id) {
        dispatch(Actions.DragHoverMove({ to: index }));
      }
    },
    drop: () => {
      dispatch(Actions.SelectedCardsMove());
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

  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'sides',
    ])
  ), shallowEqual);
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isBackEditing'
    ])
  ), shallowEqual);
  const [
    faceUrl,
    backUrl,
  ] = [
    getImageSrc(data?.face),
    getImageSrc(data?.back),
  ];
  const onSelectCard = useCallback((event) => {
    if(event.target.nodeName === 'INPUT') return;
    if (event.shiftKey) {
      dispatch(Actions.CardShiftSelect(data.id));
    } else if(event.ctrlKey || event.target.nodeName === 'SPAN') {
      dispatch(Actions.CardCtrlSelect(data.id));
    } else {
      dispatch(Actions.CardSelect(data.id));
    }
  }, [data.id]);
  const isBackEditing = Global.isBackEditing;
  return (<Card ref={node => previewRef(dropRef(node))} style={{ display: (isDragging ? 'none' : 'unset') }}
                className={'Card'} size={'sm'} padding={2}
                onMouseUp={onSelectCard}>
    <div className={'CardBar'}>
      <Menu>
        <IconButton
          size={'xs'}
          isDisabled={Config.sides !== layoutSides.doubleSides}
          icon={<IoIosSwap />}
          variant='outline'
          onClick={(e) => {
            e.stopPropagation();
            dispatch(Actions.CardEditById({ id: data.id, face: data.back, back: data.face }));
          }}
        />
        <span ref={dragRef} className={'CardDragHandler'}
              onMouseDown={e => {
                if (!data.selected) {
                  dispatch(Actions.CardSelect(data.id));
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
          <MenuItem onClick={async (e) => {
            e.stopPropagation();
            const filePath = await openImage('setCardFace');
            filePath && dispatch(Actions.CardEditById({ id: data.id, face: filePath }));
          }}>
            {t('cardEditor.face')}
          </MenuItem>
          <MenuItem onClick={async (e) => {
            e.stopPropagation();
            dispatch(Actions.CardEditById({ id: data.id, face: null }));
          }}>
            {t('cardEditor.clearFace')}
          </MenuItem>
          {Config.sides === layoutSides.doubleSides && (<>
            <MenuItem onClick={async (e) => {
              e.stopPropagation();
              const filePath = await openImage('setCardBack');
              filePath && dispatch(Actions.CardEditById({ id: data.id, back: filePath }));
            }}>
              {t('cardEditor.back')}
            </MenuItem>
            <MenuItem onClick={async (e) => {
              e.stopPropagation();
              dispatch(Actions.CardEditById({ id: data.id, back: null }));
            }}>
              {t('cardEditor.clearBack')}
            </MenuItem>
          </>)}
        </MenuList>
      </Menu>
    </div>
    <div className={'CardMain'}>
      <Stack direction='row' justifyContent={'center'}>
        <Image className={'CardImage'}
               boxSize={isBackEditing ? '50px' : '160px'}
               onMouseOver={() => {
                 imageViewerRef.current.update(data?.face?.path);
               }}
               src={faceUrl}
                />
        {Config.sides === 'double sides' && (
          <Image className={'CardImage'}
                 boxSize={isBackEditing ? '160px' : '50px'}
                 onMouseOver={() => {
                   imageViewerRef.current.update(data?.back?.path);
                 }}
                 src={backUrl}
                 
          />
        )}

      </Stack>
    </div>
    <div className={'CardBar'}>
      <Checkbox isChecked={data.selected} onClick={onSelectCard}>#{index + 1}</Checkbox>
      {Config.sides !==layoutSides.brochure && (<NumberInput size='xs' maxW={16} value={data.repeat} min={1} max={999}
                                                             onClick={(e) => e.stopPropagation()}
                                                             onChange={($, value) => {
                                                               dispatch(Actions.CardEditById({ id: data.id, repeat: isNaN(value) ? 1 : value }));
                                                             }}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>)}
    </div>
    <div>
      <Button width='100%' size='sm' onClick={() => {
        dispatch(Actions.CardRemoveByIds([data.id]));
        imageViewerRef.current.update();
      }}>
        {t('cardEditor.btnRemove')}
      </Button>
    </div>
  </Card>);
});
