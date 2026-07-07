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
import '../../ToolBar/style.css'
import { emptyImgPath, layoutSides } from '../../../../shared/constants';
import { SubMenuItem } from '../../../componments/SubMenuItem';

export const BulkOperationButton = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [repeat, setRepeat] = useState(1);
  const dialogCardSettingRef = window.dialogCardSettingRef;
  const handleClick = (event) => {
    setRepeat(1);
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const {
    selectedCardsRemove,
    selectedCardsDuplicate,
    selectedCardsEdit,
    selectedCardsEditEach,
    selectedCardsSwap,
  } = useGlobalStore.getState();
  const { Config } = useGlobalStore.selectors;
  const sides = Config.sides();
  const isDoubleSidedMode = [layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides);
  const hasIndependentSettings = sides !== layoutSides.brochure;
  const selectionIds = useGlobalStore(state => state.CardList.filter(c => c.selected).map(c => c.id));
  const selectionLength = selectionIds.length;
  return (<>
    <Button
      sx={{ visibility: selectionLength === 0 ? 'hidden' : 'visible', marginLeft: '20px' }}
      endIcon={<KeyboardArrowDownIcon />}
      onClick={handleClick}
    >
      {t('toolbar.bulkMenu.labelSelection', { count: selectionLength })}
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
      <SubMenuItem label={ t('cardEditor.face') } onClose={handleClose}>
        <MenuItem onClick={async () => {
          handleClose();
          const [ imageData ] = await openImage();
          imageData && selectedCardsEdit({ face: imageData?.face });
        }}>
          {t('toolbar.bulkMenu.menuFillFace')}
        </MenuItem>
        <MenuItem onClick={async () => {
          handleClose();
          const imageDataList = await openMultiImage();
          if (!imageDataList?.length) return;

          let imageIndex = 0;
          selectedCardsEditEach((card) => {
            const newFace = imageDataList[imageIndex]?.face;
            imageIndex++;
            return { ...card, face: newFace };
          });
        }}>
          {t('toolbar.bulkMenu.menuFillMultiFace')}
        </MenuItem>
        <MenuItem onClick={async () => {
          handleClose();
          selectedCardsEdit({ face: emptyImgPath });
        }}>
          {t('cardEditor.clearFace')}
        </MenuItem>
      </SubMenuItem>
      {isDoubleSidedMode && <SubMenuItem label={ t('cardEditor.back') } onClose={handleClose}>
        <MenuItem onClick={async () => {
          handleClose();
          const [ imageData ] = await openImage();
          imageData && selectedCardsEdit({ back: imageData?.face });
        }}>
          {t('toolbar.bulkMenu.menuFillBack')}
        </MenuItem>
        <MenuItem onClick={async () => {
          handleClose();
          const imageDataList = await openMultiImage();
          if (!imageDataList?.length) return;

          let imageIndex = 0;
          selectedCardsEditEach((card) => {
            const newBack = imageDataList[imageIndex]?.face;
            imageIndex++;
            return { ...card, back: newBack };
          });
        }}>
          {t('toolbar.bulkMenu.menuFillMultiBack')}
        </MenuItem>
        <MenuItem onClick={async () => {
          handleClose();
          selectedCardsEdit({ back: emptyImgPath });
        }}>
          {t('cardEditor.clearBack')}
        </MenuItem>
      </SubMenuItem>}

      {isDoubleSidedMode && <MenuItem onClick={() => {
        handleClose();
        selectedCardsSwap();
      }}>
        {t('toolbar.bulkMenu.menuSwap')}
      </MenuItem>}
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
        }}>{t('button.ok')}</Link>
      </MenuItem>
      {hasIndependentSettings && <MenuItem onClick={() => {
        handleClose();
        dialogCardSettingRef?.current?.openDialog(selectionIds);
      }}>
        {t('cardEditor.spicalConfig')}
      </MenuItem>}
    </Menu>
  </>);
};
