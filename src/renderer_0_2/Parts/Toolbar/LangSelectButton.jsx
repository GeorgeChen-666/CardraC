import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { i18nInstance } from '../../i18n';
import { getResourcesPath } from '../../functions';
import { useGlobalStore } from '../../State/store';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';

export const LangSelectButton = ({ label }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  const { mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const availableLangs = Global.availableLangs();
  const currentLang = Global.currentLang();
  return (<>
    <Button
      label={label}
      endIcon={<KeyboardArrowDownIcon />}
      onClick={handleClick}
    >
      <img style={{ height: '21px' }} src={getResourcesPath(`/public/language-icons/${currentLang}.svg`)} />
    </Button>
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
    >
     {availableLangs.filter(lan => lan !== currentLang).map(lan =>
       <MenuItem
         key={lan}
         onClick={
           () => {
             handleClose();
             i18nInstance.changeLanguage(lan);
             mergeGlobal({ currentLang: lan });
           }
         }
       ><img style={{ height: '25px' }} src={getResourcesPath(`/public/language-icons/${lan}.svg`)} alt={lan} />{lan}
       </MenuItem>)}
    </Menu>
  </>);
};
