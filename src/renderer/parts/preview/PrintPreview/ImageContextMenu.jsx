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

export const ImageContextMenu = ({ anchorPosition, onClose, imageElement, setFrame }) => {
  const open = Boolean(anchorPosition);
  const {
    cardEditById, CardList, Global
  } = useGlobalStore.getState();
  const handleCopy = async () => {
    if (imageElement) {
      const [id, path] = imageElement.dataset.cardMark.split('.');
      const oldImageData = CardList.find(d => d.id === id);
      await navigator.clipboard.writeText(JSON.stringify(oldImageData[path]));
    }
    onClose();
  };

  const handlePaste = async () => {
    if (imageElement) {
      const text = await navigator.clipboard.readText();
      if(text) {
        const [id, path] = imageElement.dataset.cardMark.split('.');
        try {
          const imageData = JSON.parse(text);
          if(imageData) {
            const oldImageData = CardList.find(d => d.id === id);
            cardEditById({ ...oldImageData, [path]: imageData });
            await clearPreviewCache();
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
      const [id, path] = imageElement.dataset.cardMark.split('.');
      const oldImageData = CardList.find(d => d.id === id);
      cardEditById({ ...oldImageData, [path]: null });
      await clearPreviewCache();
      setFrame(ov => ov + 1)
    }
    onClose();
  };

  const handleReplace = async () => {
    if (imageElement) {
      const [id, path] = imageElement.dataset.cardMark.split('.')
      const [ cardData ] = await openImage(false);
      const imageData = cardData?.face;
      if(imageData) {
        const oldImageData = CardList.find(d => d.id === id);
        cardEditById({ ...oldImageData, [path]: imageData });
        await clearPreviewCache();
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
        <ListItemText>复制</ListItemText>
      </MenuItem>

      <MenuItem onClick={handlePaste}>
        <ListItemIcon>
          <ContentPasteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>黏贴</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleClear}>
        <ListItemIcon>
          <ClearIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>清除</ListItemText>
      </MenuItem>

      <MenuItem onClick={handleReplace}>
        <ListItemIcon>
          <ImageIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>替换图像</ListItemText>
      </MenuItem>

    </Menu>
  );
};
