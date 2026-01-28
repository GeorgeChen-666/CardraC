import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { version } from '../../../../functions';
import { DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import Button from '@mui/material/Button';

export const AboutDialog = forwardRef(({},ref) => {
  const [open, setOpen] = React.useState(false);
  const cancelRef = React.useRef()
  useImperativeHandle(ref, () => ({
    openDialog: () => setOpen(true),
  }));
  const [v, setV] = useState('')
  useEffect(() => {
    (async()=> {
      setV(await version());
    })()
  }, []);
  return (<Dialog
    fullWidth={true}
    maxWidth={'xs'}
    onClose={() => setOpen(false)}
    open={open}
  >
    <DialogTitle>
      About Cardrac
    </DialogTitle>
    <DialogContent>
      <DialogContentText>
        <p>Cardrac</p>
        <p>Version: {v}</p>
        <p>Author: GeorgeChen</p>
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button ref={cancelRef} onClick={() => setOpen(false)}>
        OK
      </Button>
    </DialogActions>
  </Dialog>);
})