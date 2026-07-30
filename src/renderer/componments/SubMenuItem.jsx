// SubMenuItem.jsx
import React, { useState } from 'react';
import MenuItem from '@mui/material/MenuItem';
import Popover from '@mui/material/Popover';
import ArrowRightIcon from '@mui/icons-material/ArrowRight';

export const SubMenuItem = ({ label, children, onClose }) => {
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMouseEnter = (e) => {
    setAnchorEl(e.currentTarget);
  };

  const handleMouseLeave = (e) => {
    if (!e.relatedTarget?.closest?.('.sub-menu-popover')) {
      setAnchorEl(null);
    }
  };

  const handleChildClick = () => {
    setAnchorEl(null);
    onClose?.();
  };

  return (
    <>
      <MenuItem
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}
      >
        {label}
        <ArrowRightIcon fontSize="small" />
      </MenuItem>

      <Popover
        className="sub-menu-popover"
        sx={{ pointerEvents: 'none' }}
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        onClose={() => setAnchorEl(null)}
        disableRestoreFocus
      >
        <div
          style={{ pointerEvents: 'auto' }}
          onMouseLeave={() => setAnchorEl(null)}
        >
          {React.Children.map(children, child =>
            React.cloneElement(child, {
              onClick: (...args) => {
                child.props.onClick?.(...args);
                handleChildClick();
              }
            })
          )}
        </div>
      </Popover>
    </>
  );
};
