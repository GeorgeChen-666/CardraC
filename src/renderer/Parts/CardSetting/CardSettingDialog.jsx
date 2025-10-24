
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
      {t('cardEditor.spicalConfig')}
    </DialogTitle>
    <DialogContent>
      <div className={'CardSettingInputRow'}>
        <FormLabel>{t('cardEditor.face')}</FormLabel>
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} label={t('configDialog.bleed')} disabled={false}
                     onChange={() => {}}
        />
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} disabled={false}
                     onChange={() => {}}
        />
        mm
      </div>
      <div className={'CardSettingInputRow'}>
        <FormLabel>{t('cardEditor.back')}</FormLabel>
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} label={t('configDialog.bleed')} disabled={false}
                     onChange={() => {}}
        />
        <NumberInput value={123} min={0} max={999}
                     step={1}
                     width={160} disabled={false}
                     onChange={() => {}}
        />
        mm
      </div>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setOpen(false)}>
        OK
      </Button>
    </DialogActions>
  </Dialog>)
})