import React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export const withConfirmation = (WrappedComponent) => {
  return function WithConfirmation(props) {
    const {
      onClick,
      confirmMessage = 'Confirm?',
      confirmButtonText = 'Yes',
      cancelButtonText = 'No',
      ...otherProps
    } = props;

    const [open, setOpen] = React.useState(false);
    const [clickArgs, setClickArgs] = React.useState(null);

    const handleOpen = (...args) => {
      setClickArgs(args);
      setOpen(true);
    };

    const handleClose = () => {
      setOpen(false);
      setClickArgs(null);
    };

    const handleConfirm = () => {
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
  };
};