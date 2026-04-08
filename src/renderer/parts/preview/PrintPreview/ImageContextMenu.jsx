import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ClearIcon from '@mui/icons-material/Clear';
import ImageIcon from '@mui/icons-material/Image';
import { clearPreviewCache, getImageSrc, openImage } from '../../../functions';
import { useGlobalStore } from '../../../state/store';

export const ImageContextMenu = ({ anchorPosition, onClose, imageElement }) => {
  const open = Boolean(anchorPosition);
  const {
    cardEditById, CardList, Global
  } = useGlobalStore.getState();
  const handleCopy = async () => {
    if (imageElement) {
      const [id, path] = imageElement.id.split('.');
      const oldImageData = CardList.find(d => d.id === id);
      await navigator.clipboard.writeText(JSON.stringify(oldImageData[path]));
    }
    onClose();
  };

  const handlePaste = () => {
    if (imageElement) {
      navigator.clipboard.readText().then(text => {
        if(text) {
          const [id, path] = imageElement.id.split('.');
          try {
            const imageData = JSON.parse(text);
            if(imageData) {
              const oldImageData = CardList.find(d => d.id === id);
              const imageUrl = getImageSrc(imageData, { version: Global.imageVersion, quality: 'high' });
              cardEditById({ ...oldImageData, [path]: imageData });
              clearPreviewCache({ pageIndex: Global.exportPreviewIndex });
              imageElement.setAttribute('href', imageUrl);
            }
          }
          catch (e) {

          }

        }
      });
    }
    onClose();
  };

  const handleClear = () => {
    if (imageElement) {
      const [id, path] = imageElement.id.split('.');
      const oldImageData = CardList.find(d => d.id === id);
      cardEditById({ ...oldImageData, [path]: null });
      clearPreviewCache({ pageIndex: Global.exportPreviewIndex });
      imageElement.setAttribute('href', '');
    }
    onClose();
  };

  const handleReplace = async () => {
    if (imageElement) {
      const [id, path] = imageElement.id.split('.')
      const [ cardData ] = await openImage(false);
      const imageData = cardData?.face;
      if(imageData) {
        const oldImageData = CardList.find(d => d.id === id);
        const imageUrl = getImageSrc(imageData, { version: Global.imageVersion, quality: 'high' });
        cardEditById({ ...oldImageData, [path]: imageData });
        clearPreviewCache({ pageIndex: Global.exportPreviewIndex });
        imageElement.setAttribute('href', imageUrl);
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
