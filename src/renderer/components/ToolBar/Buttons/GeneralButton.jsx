import React from 'react';
import {
  Tooltip,
  IconButton,
} from '@chakra-ui/react';


export const GeneralButton = ({label,icon,onClick}) => (
  <Tooltip label={label}>
    <IconButton
      icon={icon}
      onClick={onClick}
    />
  </Tooltip>
)