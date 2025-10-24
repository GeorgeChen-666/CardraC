
import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle, DialogContentText } from '@mui/material';
import React, { forwardRef, useImperativeHandle } from 'react';
import { useGlobalStore } from '../../State/store';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../Componments/NumberInput';
import FormLabel from '@mui/material/FormLabel';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import './style.css'


export const CardSettingDialog = forwardRef(({}, ref) => {
  const { Global } = useGlobalStore.selectors;
  const isLoading = Global.isLoading();
  const isInProgress = Global.isInProgress();
  const progress = Global.progress();
  const loadingText = Global.loadingText();
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  useImperativeHandle(ref, () => ({
    openDialog: () => setOpen(true),
  }));
  return (<Dialog open={open}>
    <DialogTitle>
      独立设置
    </DialogTitle>
    <DialogContent>
      <div className={'CardSettingInputRow'}>
        <FormLabel>正面</FormLabel>
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} label={'横向出血'} disabled={false}
                     onChange={() => {}}
        />
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} label={'纵向出血'} disabled={false}
                     onChange={() => {}}
        />
        mm
        {/*<Link href='#' onClick={() => {*/}
        {/*  // mergeConfig({ autoConfigFlip: false });*/}
        {/*}}>OK</Link>*/}
      </div>
      <div className={'CardSettingInputRow'}>
        <FormLabel>背面</FormLabel>
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} label={'横向出血'} disabled={false}
                     onChange={() => {}}
        />
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} label={'纵向出血'} disabled={false}
                     onChange={() => {}}
        />
        mm
        {/*<Link href='#' onClick={() => {*/}
        {/*  // mergeConfig({ autoConfigFlip: false });*/}
        {/*}}>OK</Link>*/}
      </div>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setOpen(false)}>
        OK
      </Button>
    </DialogActions>
  </Dialog>)
})