import React, { useEffect, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import { editTemplate, getTemplate, setTemplate, deleteTemplate } from '../../../../functions';
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
import { withConfirmation } from '../../../../componments/withConfirmation';
import { useGlobalStore } from '../../../../state/store';
import { initialState } from '../../../../../shared/constants';

const ConfirmIconButton = withConfirmation(IconButton);

export const TemplateMenu = props => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const inputRef = useRef(null);
  const [menuItems,  setMenuItems] = useState([]);
  const [editingId, setEditingId] = useState();
  const editingItem = menuItems.find(item => item.id === editingId) || { id: editingId, TemplateName: 'no name' };
  const {
    mergeConfig
  } = useGlobalStore.getState();
  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
    const templateList = await getTemplate();
    setMenuItems(templateList);
  };
  const handleClose = () => {
    setAnchorEl(null);
  };
  useEffect(() => {
    if(editingId) {
      setTimeout(()=> {
        inputRef.current?.querySelector?.('input')?.focus?.()
      }, 100)
    }
  }, [editingId]);
  return (<>
    {editingId && (<>
      <TextField
        ref={inputRef}
        className={'templateInput'}
        defaultValue={editingItem.TemplateName}
        size="small"
      />
      <IconButton size="small"
                  onClick={async (e) => {
                    const newLabel = inputRef.current?.querySelector?.('input')?.value;
                    if(editingId === '_new_') {
                      await setTemplate({templateName: newLabel})
                    }
                    else {
                      await editTemplate({templateName: newLabel, id:editingId})
                    }
                    setEditingId(null)
                  }}>
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton size="small"
                  onClick={(e) => {
                    setEditingId(null)
                  }}>
        <ClearIcon fontSize="small" />
      </IconButton>
    </>)}
    {!editingId && (<>
      <Button
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleClick}
      >
        {t('configDialog.clickMenuLoadConfig')}
      </Button>
      <Tooltip title={t('configDialog.saveCurrentConfig')}>
        <IconButton size="small"
                    onClick={(e) => {
                      setEditingId('_new_');
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
        <MenuItem key={item.id} onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if(e.target === e.currentTarget) {
            handleClose();
            mergeConfig({
              Config: {...initialState.Config, ...item.Config}
            });
          }
        }}>
          <ListItemText>{item.TemplateName}</ListItemText>
          <Typography>
            <IconButton size="small"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleClose()
                          setEditingId(item.id)
                        }}>
              <EditIcon fontSize="small" />
            </IconButton>
            <ConfirmIconButton size="small"
                               confirmMessage={t('util.confirmDelete')}
                               confirmButtonText={t('button.yes')}
                               cancelButtonText={t('button.no')}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleClose()
                          deleteTemplate({id: item.id});
                        }}>
              <DeleteOutlineIcon fontSize="small" />
            </ConfirmIconButton>
          </Typography>
        </MenuItem>)}
    </Menu>
  </>);
}