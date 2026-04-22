import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// withConfirmation/index.jsx
export const withConfirmation = (WrappedComponent) => {
  return React.forwardRef(function WithConfirmation(props, ref) {  // ✅ 添加 forwardRef
    const {
      onClick,
      confirmMessage = 'Confirm?',
      confirmButtonText = 'Yes',
      cancelButtonText = 'No',
      skipConfirm = false,
      ...otherProps
    } = props;

    const [open, setOpen] = React.useState(false);
    const [clickArgs, setClickArgs] = React.useState(null);
    const buttonRef = React.useRef(null);  // ✅ 内部 ref

    React.useImperativeHandle(ref, () => ({
      click: () => buttonRef.current?.click(),
      element: buttonRef.current
    }));

    const handleOpen = (e, ...args) => {
      e.preventDefault();
      e.stopPropagation();
      if (skipConfirm) {
        if (typeof onClick === 'function') {
          onClick(e, ...args);
        }
        return;
      }
      setClickArgs([e, ...args]);
      setOpen(true);
    };

    const handleClose = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setClickArgs(null);
    };

    const handleConfirm = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (typeof onClick === 'function' && clickArgs) {
        onClick(...clickArgs);
      }
      setOpen(false);
      setClickArgs(null);
    };

    return (
      <>
        <WrappedComponent
          {...otherProps}
          ref={buttonRef}  // ✅ 转发到真实按钮
          onClick={handleOpen}
        />
        <Dialog
          open={open}
          onClose={handleClose}
        >
          <DialogContent>
            <DialogContentText>
              {confirmMessage}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>{cancelButtonText}</Button>
            <Button onClick={handleConfirm} color="primary" autoFocus>
              {confirmButtonText}
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  });
};
