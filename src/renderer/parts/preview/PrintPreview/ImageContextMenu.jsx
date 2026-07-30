import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ClearIcon from '@mui/icons-material/Clear';
import ImageIcon from '@mui/icons-material/Image';
import { clearPreviewCache, openImage } from '../../../functions';
import { useGlobalStore } from '../../../state/store';
import { emptyImg } from '../../../../shared/constants';
import { useTranslation } from 'react-i18next';

export const ImageContextMenu = ({ anchorPosition, onClose, imageElement }) => {
  const open = Boolean(anchorPosition);
  const { t } = useTranslation();
  const {
    getExportPageCount, cardEditByIndex
  } = useGlobalStore.getState();
  const CardList = useGlobalStore(state => state.CardList);

  // 提取 index, side
  const [index, side] = React.useMemo(() => {
    if (!imageElement?.dataset?.cardMark) return [null, null];
    return imageElement.dataset.cardMark.split('.').map((v, i) => i ? v : +v);
  }, [imageElement]);

  // 判断当前位置图片是否为空
  const disabled = React.useMemo(() => {
    if (index === null || !side) return true;
    const card = CardList[index];
    return !card?.[side]?.path;
  }, [CardList, index, side]);

  const handleCopy = async () => {
    if (index !== null) {
      const oldImageData = CardList[index];
      await navigator.clipboard.writeText(JSON.stringify(oldImageData?.[side] || emptyImg));
    }
    onClose();
  };

  const handlePaste = async () => {
    if (index !== null) {
      const text = await navigator.clipboard.readText();
      if (text) {
        try {
          const imageData = JSON.parse(text);
          if (imageData) {
            cardEditByIndex(index, side, imageData);
            await clearPreviewCache();
            await getExportPageCount();
          }
        } catch (e) {}
      }
    }
    onClose();
  };

  const handleClear = async () => {
    if (index !== null) {
      cardEditByIndex(index, side, null);
      await clearPreviewCache();
    }
    onClose();
  };

  const handleReplace = async () => {
    if (index !== null) {
      const [cardData] = await openImage(false, false);
      const imageData = cardData?.face;
      if (imageData) {
        cardEditByIndex(index, side, imageData);
        await clearPreviewCache();
        await getExportPageCount();
      }
    }
    onClose();
  };

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={anchorPosition}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      <MenuItem onClick={handleCopy} disabled={disabled}>
        <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.copy')}</ListItemText>
      </MenuItem>

      <MenuItem onClick={handlePaste}>
        <ListItemIcon><ContentPasteIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.paste')}</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleClear} disabled={disabled}>
        <ListItemIcon><ClearIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.clear')}</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleReplace}>
        <ListItemIcon><ImageIcon fontSize="small" /></ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.replace')}</ListItemText>
      </MenuItem>
    </Menu>
  );
};
