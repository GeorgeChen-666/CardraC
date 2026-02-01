import React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';


export const GeneralIconButton = ({label, icon, onClick,size= 'medium', disabled = false, ...rest}) => {
  if(label === 'fff') {
    console.log(disabled)
  }
  return (
      <Tooltip title={label}>
        <IconButton
          color="inherit"
          size={size}
          onClick={onClick}
          disabled={disabled}
          {...rest}
        >
          {icon}
        </IconButton>
      </Tooltip>
  )
}