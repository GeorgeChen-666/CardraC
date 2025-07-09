import React, { memo, useCallback } from 'react';
import {
  // Button,
  // Card,
  // Checkbox,
  IconButton,
  Image,
  // Menu,
  MenuButton,
  // MenuItem,
  MenuList,
  NumberDecrementStepper,
  NumberIncrementStepper,
  // NumberInput,
  NumberInputField,
  NumberInputStepper,
  Stack,
} from '@chakra-ui/react';
import Card from '@mui/material/Card';
import './styles.css';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { getImageSrc, openImage } from '../../functions';
import { layoutSides } from '../../../public/constants';
import { useStore } from '../../State/store';
import { GeneralIconButton } from '../../Componments/GeneralIconButton';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import { NumberInput } from '../../Componments/NumberInput';

const useMenuState = (items) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);
  const onOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const onClose = () => {
    setAnchorEl(null);
  };
  // return [open, anchorEl, onOpen, onClose]
  return {
    onOpen,
    MenuElement: (<Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
    >
      {items.map((option) => (
        <MenuItem key={option.label} onClick={(e) => {
          e.stopPropagation();
          option?.onClick?.();
          onClose();
        }}>
          {option.label}
        </MenuItem>
      ))}
    </Menu>),
  };
};

export default memo(({ data, index }) => {
  const imageViewerRef = window.imageViewerRef;
  const { t } = useTranslation();
  const {
    selectors: {
      Config, Global, CardList,
    },
    cardEditById, cardRemoveByIds,mergeGlobal, cardSelect, cardShiftSelect, cardCtrlSelect, dragHoverMove, dragCardsMove
  } = useStore.getState();
  const sides = Config.sides();
  const selected = CardList[index].selected() || false;
  const isBackEditing = Global.isBackEditing();
  const { onOpen, MenuElement } = useMenuState([
    {
      label: t('cardEditor.face'), onClick: async () => {
        const filePath = await openImage('setCardFace');
        cardEditById({ id: data.id, face: filePath });
      },
    },
    {
      label: t('cardEditor.clearFace'), onClick: () => {
        cardEditById({ id: data.id, face: null });
      },
    },
    {
      label: t('cardEditor.back'), onClick: async () => {
        const filePath = await openImage('setCardFace');
        cardEditById({ id: data.id, back: filePath });
      },
    },
    {
      label: t('cardEditor.clearBack'), onClick: () => {
        cardEditById({ id: data.id, back: null });
      },
    },
  ]);
  const [, dropRef] = useDrop({
    accept: 'Card',
    hover({ id: draggedId }) {
      if (draggedId !== data.id) {
        dragHoverMove(index);
      }
    },
    drop: () => {
      dragCardsMove();
    },
  });

  const [{ isDragging }, dragRef, previewRef] = useDrag({
    item: { id: data.id, originalIndex: index },
    isDragging: (monitor) => selected || monitor.getItem().id === data.id,
    type: 'Card',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [
    faceUrl,
    backUrl,
  ] = [
    getImageSrc(data?.face),
    getImageSrc(data?.back),
  ];
  const onSelectCard =(event) => {
    if (event.type === 'change' || event.target.nodeName.toLowerCase() === 'svg' || event.target.classList.contains('MuiBackdrop-root')) return;
    if (event.shiftKey) {
      cardShiftSelect(data.id)
    } else if (event.ctrlKey || event.target.type === 'checkbox') {
      cardCtrlSelect(data.id)
    } else {
      cardSelect(data.id);
    }
  };
  return (<Card ref={node => previewRef(dropRef(node))} sx={{ display: (isDragging ? 'none' : 'unset') }}
                className={'Card'} onClick={onSelectCard}>
    <div className={'CardBar'}>
      <GeneralIconButton
        // label={t('cardEditor.swap')}
        icon={<SwapHorizIcon fontSize={'small'} />}
        size={'small'}
        onClick={(e) => {
          e.stopPropagation();
          cardEditById({ id: data.id, face: data.back, back: data.face })
        }}
      />
      <span ref={dragRef} className={'CardDragHandler'}
            onMouseDown={e => {
              e.stopPropagation();
              if (!selected) {
                // cardSelect(data.id);
              }
            }}
            onClick={e => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize={'small'} />
        <DragIndicatorIcon fontSize={'small'} />
      </span>
      <GeneralIconButton
        // label={t('cardEditor.swap')}
        icon={<MoreHorizIcon fontSize={'small'} />}
        size={'small'}
        onClick={onOpen}
      />
      {MenuElement}
    </div>
    <div className={'CardMain'}>
      <Stack direction='row' justifyContent={'center'}>
        <Image className={'CardImage'}
               boxSize={isBackEditing ? '50px' : '160px'}
               onMouseOver={() => {
                 // imageViewerRef.current.update(data?.face?.path);
               }}
          // onMouseLeave={() => imageViewerRef.current?.close?.()}
               src={faceUrl}
        />
        {[layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides) && (
          <Image className={'CardImage'}
                 boxSize={isBackEditing ? '160px' : '50px'}
                 onMouseOver={() => {
                   // imageViewerRef.current.update(data?.back?.path);
                 }}
            // onMouseLeave={() => imageViewerRef.current?.close?.()}
                 src={backUrl}

          />
        )}

      </Stack>
    </div>
    <div className={'CardBar'}>
      <div>
        <Checkbox
          checked={selected}
          onChange={onSelectCard}
        />
        <span>#{index + 1} {selected}</span>
      </div>

      {Config.sides !== layoutSides.brochure && (
        <NumberInput width='50px' step={1} value={data.repeat} min={1} max={999}
                     onClick={(e) => e.stopPropagation()}
                     onChange={($, value) => {
                       cardEditById({ id: data.id, repeat: isNaN(value) ? 1 : value });
                       // dispatch(Actions.CardEditById({ id: data.id, repeat: isNaN(value) ? 1 : value }));
                     }} />)}
    </div>
    <div>
      <Button
        fullWidth
        onClick={(e) => {
          e.stopPropagation();
          cardRemoveByIds([data.id]);
          // dispatch(Actions.CardRemoveByIds([data.id]));
          // imageViewerRef.current.update();
        }}
      >
        {t('cardEditor.btnRemove')}
      </Button>
    </div>
  </Card>);
});
