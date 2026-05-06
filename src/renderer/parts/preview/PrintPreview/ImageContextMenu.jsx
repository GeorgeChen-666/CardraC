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

export const ImageContextMenu = ({ anchorPosition, onClose, imageElement, setFrame }) => {
  const open = Boolean(anchorPosition);
  const { t } = useTranslation();
  const {
    getExportPageCount, cardEditByIndex, CardList, Global
  } = useGlobalStore.getState();
  const handleCopy = async () => {
    if (imageElement) {
      const [index, side] = imageElement.dataset.cardMark.split('.')
        .map((v, i) => i ? v : +v);
      const oldImageData = CardList[index];
      await navigator.clipboard.writeText(JSON.stringify(oldImageData?.[side] || emptyImg));
    }
    onClose();
  };

  const handlePaste = async () => {
    if (imageElement) {
      const text = await navigator.clipboard.readText();
      if(text) {
        const [index, side] = imageElement.dataset.cardMark.split('.')
          .map((v, i) => i ? v : +v);
        try {
          const imageData = JSON.parse(text);
          if(imageData) {
            cardEditByIndex(index, side, imageData);
            await clearPreviewCache();
            await getExportPageCount();
            setFrame(ov => ov + 1)
          }
        }
        catch (e) {

        }
      }
    }
    onClose();
  };

  const handleClear = async () => {
    if (imageElement) {
      const [index, side] = imageElement.dataset.cardMark.split('.')
        .map((v, i) => i ? v : +v);
      cardEditByIndex(index, side, null);
      await clearPreviewCache();
      setFrame(ov => ov + 1)
    }
    onClose();
  };

  const handleReplace = async () => {
    if (imageElement) {
      const [index, side] = imageElement.dataset.cardMark.split('.')
        .map((v, i) => i ? v : +v);
      const [ cardData ] = await openImage(false);
      const imageData = cardData?.face;
      if(imageData) {
        cardEditByIndex(index, side, imageData);
        await clearPreviewCache();
        await getExportPageCount();
        setFrame(ov => ov + 1)
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
      slotProps={{
        paper: {
          sx: { minWidth: 180 }
        }
      }}
    >
      <MenuItem onClick={handleCopy}>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.copy')}</ListItemText>
      </MenuItem>

      <MenuItem onClick={handlePaste}>
        <ListItemIcon>
          <ContentPasteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.paste')}</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleClear}>
        <ListItemIcon>
          <ClearIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.clear')}</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleReplace}>
        <ListItemIcon>
          <ImageIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t('printPreview.contextMenu.replace')}</ListItemText>
      </MenuItem>

    </Menu>
  );
};
