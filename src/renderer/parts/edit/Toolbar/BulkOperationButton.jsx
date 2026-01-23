import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Link from '@mui/material/Link';
import { useGlobalStore } from '../../../state/store';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import { openImage, openMultiImage } from '../../../functions';
import { NumberInput } from '../../../componments/NumberInput';
import './style.css'

export const BulkOperationButton = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [repeat, setRepeat] = useState(1);
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const {
    selectedCardsRemove,
    selectedCardsDuplicate,
    selectedCardsEdit,
    selectedCardsFillBackWithEach,
    selectedCardsSwap,
  } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const selectionLength = useGlobalStore(state => state.CardList.filter(c => c.selected).length);
  return (<>
    <Button
      sx={{ visibility: selectionLength === 0 ? 'hidden' : 'visible', marginLeft: '20px' }}
      endIcon={<KeyboardArrowDownIcon />}
      onClick={handleClick}
    >
      {t('toolbar.bulkMenu.labelSelection')}
    </Button>
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
    >
      <MenuItem onClick={() => {
        handleClose();
        selectedCardsRemove();
      }}>
        {t('toolbar.bulkMenu.menuRemove')}
      </MenuItem>
      <MenuItem onClick={() => {
        handleClose();
        selectedCardsDuplicate();
      }}>
        {t('toolbar.bulkMenu.duplidate')}
      </MenuItem>
      <MenuItem onClick={async () => {
        handleClose();
        const filePath = await openImage('fillBackground');
        selectedCardsEdit({ back: filePath });
      }}>
        {t('toolbar.bulkMenu.menuFillBackground')}
      </MenuItem>
      <MenuItem onClick={async () => {
        handleClose();
        const filePaths = await openMultiImage('SelectedCardFillBackWithEachBack');
        filePaths?.length > 0 && selectedCardsFillBackWithEach(filePaths);
      }}>
        {t('toolbar.bulkMenu.menuFillMultiBackground')}
      </MenuItem>
      <MenuItem onClick={() => {
      }}>
        {t('toolbar.bulkMenu.menuSetCount')}
        <NumberInput width='70px' step={1} value={repeat} min={1} max={999}
                     onClick={(e) => e.stopPropagation()}
                     onChange={(e, value) => {
                       e.stopPropagation();
                       setRepeat(isNaN(value) ? 1 : value);
                       // cardEditById({ id: data.id, repeat: isNaN(value) ? 1 : value });
                     }} />
        <Link href='#' onClick={() => {
          handleClose();
          selectedCardsEdit({ repeat });
          // mergeConfig({ autoConfigFlip: false });
        }}>OK</Link>
      </MenuItem>
      <MenuItem onClick={() => {
        handleClose();
        selectedCardsSwap();
      }}>
        {t('toolbar.bulkMenu.menuSwap')}
      </MenuItem>
    </Menu>
  </>);
};
