import React from 'react';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';


export const GeneralIconButton = ({label, icon, onClick,size= 'medium', ...rest}) => {
  return (
      <Tooltip title={label}>
        <IconButton
          color="inherit"
          size={size}
          onClick={onClick}
          {...rest}
        >
          {icon}
        </IconButton>
      </Tooltip>
  )
}