import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { getResourcesPath, getTemplate } from '../../../functions';
import TextField from '@mui/material/TextField';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useTranslation } from 'react-i18next';
import EditIcon from '@mui/icons-material/Edit';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/Save';
import CheckIcon from '@mui/icons-material/Check';
import ClearIcon from '@mui/icons-material/Clear';
import { ListItemText } from '@mui/material';
import './styles.css'
import Tooltip from '@mui/material/Tooltip';

export const TemplateMenu = props => {
  const { t } = useTranslation();
  const defaultMenuLabel = t('configDialog.clickMenuLoadConfig');
  const [menuLabel, setMenuLabel] = useState(defaultMenuLabel);
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const [menuItems,  setMenuItems] = useState([]);
  const [editingId, setEditingId] = useState('test');
  const editingItem = menuItems.find(item => item.id === editingId) || { id: editingId, TemplateName: 'no name' };
  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
    const templateList = await getTemplate();
    setMenuItems(templateList);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };

  return (<>
    {editingId && (<>
      <TextField
        className={'templateInput'}
        defaultValue={editingItem.TemplateName}
        size="small"
      />
      <IconButton size="small"
                  onClick={(e) => {
                  }}>
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton size="small"
                  onClick={(e) => {
                  }}>
        <ClearIcon fontSize="small" />
      </IconButton>
    </>)}
    {!editingId && (<>
      <Button
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleClick}
      >
        {menuLabel}
      </Button>
      <Tooltip title={t('configDialog.saveCurrentConfig')}>
        <IconButton size="small"
                    onClick={(e) => {
                      setEditingId(new Date().getTime().toString());
                    }}>
          <SaveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </>)}

    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={handleClose}
      className={'templateMenu'}
    >
      {menuItems.map(item =>
        <MenuItem key={item.id}>
          <ListItemText>{item.TemplateName}</ListItemText>
          <Typography>
            <IconButton size="small"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          handleClose()
                          setEditingId(item.id)
                        }}>
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => { e.stopPropagation(); }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Typography>
        </MenuItem>)}
    </Menu>
  </>);
}