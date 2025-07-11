import React, { useRef, useState } from 'react';
import { useGlobalStore } from '../../State/store';
import Button from '@mui/material/Button';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Divider } from '@mui/material';
import Tooltip from '@mui/material/Tooltip';
import Badge from '@mui/material/Badge';
import { ReloadDialog } from './ReloadImg/ReloadDialog';
import { callMain } from '../../functions';
import { eleActions } from '../../../public/constants';

export const CompressSelectButton = ({ label, disabled }) => {
  const dialogReloadRef = useRef(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [invalidImages, setInvalidImages] = useState([]);

  const { mergeConfig, reloadLocalImage } = useGlobalStore.getState();
  const { Config: ConfigFn, CardList:CardListFn } = useGlobalStore.selectors;

  const CardList = CardListFn();
  const Config = ConfigFn()
  const handleClick = async(event) => {
    setAnchorEl(event.currentTarget);

    const pathList = [];
    Config.globalBackground?.path && pathList.push(Config.globalBackground?.path);
    CardList.forEach((card, index) => {
      card.face?.path && pathList.push(card.face?.path);
      card.back?.path && pathList.push(card.back?.path);
    });
    const result = await callMain(eleActions.checkImage, { pathList })
    setInvalidImages(result || []);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };


  const compressLevel = Config.compressLevel;
  const setCompressLevel = lv => {
    handleClose();
    mergeConfig({ compressLevel: lv });
  };
  const lvText = ['无', '轻微', '一般', '较强', '强力'];

  return (<>
    <Tooltip title={label}>
      <Button
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleClick}
      >
        <span>Lv{compressLevel}</span>
      </Button>
    </Tooltip>
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
    >
      <MenuItem disabled={disabled} onClick={() => {
        handleClose();
        dialogReloadRef.current.openDialog(invalidImages);
      }}>
        <Badge color='warning' badgeContent={invalidImages.length} max={999}>
          <span style={{ paddingRight: '10px' }}>修正路径</span>
        </Badge>
      </MenuItem>
      <Divider sx={{ my: 0.5 }} />
      {[1, 2, 3, 4].map((lv) => (
        <MenuItem onClick={() => {
          setCompressLevel(lv);
          !disabled && reloadLocalImage();
        }} disabled={compressLevel === lv}>
          压缩等级Lv{lv}:{lvText[lv]}
        </MenuItem>
      ))}
    </Menu>
    <ReloadDialog ref={dialogReloadRef} />
  </>);
};