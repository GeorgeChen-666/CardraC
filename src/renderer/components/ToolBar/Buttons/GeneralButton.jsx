import React, { useRef } from 'react';
import {
  Tooltip,
  IconButton,
} from '@chakra-ui/react';


export const GeneralButton = ({label,icon, onClick, ...rest}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const tooltipRef = useRef()
  return (
    <Tooltip ref={tooltipRef} label={label} isOpen={isOpen}>
      <IconButton
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        icon={icon}
        onClick={()=> {
          setIsOpen(false);
          setTimeout(() => {
            onClick();
          }, 100);
        }}
        {...rest}
      />
    </Tooltip>
  )
}