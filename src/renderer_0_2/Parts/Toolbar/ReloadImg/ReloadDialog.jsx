import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import { styled } from '@mui/material/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import './style.css'

import { useTranslation } from 'react-i18next';
import { eleActions } from '../../../../public/constants';
import { callMain } from '../../../functions';
import { useGlobalStore } from '../../../State/store';

export const ReloadDialog = forwardRef(({},ref) => {
  const { t } = useTranslation();
  const { Config: ConfigFn, CardList: CardListFn } = useGlobalStore.selectors;
  const { mergeConfig } = useGlobalStore.getState();
  const [open, setOpen] = React.useState(false);
  const cancelRef = React.useRef()
  useImperativeHandle(ref, () => ({
    openDialog: () => setOpen(true),
  }));
  const [newImagePath, setNewImagePath] = useState({});
  const [invalidImages, setInvalidImages] = useState([]);
  const Config = ConfigFn();
  const CardList = CardListFn();
  useEffect(() => {
    if(open) {
      (async () => {
        // setReloadProgress(0);
        setInvalidImages([])
        const pathList = [];
        Config.globalBackground?.path && pathList.push(Config.globalBackground?.path);
        CardList.forEach((card, index) => {
          card.face?.path && pathList.push(card.face?.path);
          card.back?.path && pathList.push(card.back?.path);
        });
        const result = await callMain(eleActions.checkImage, { pathList })
        if((result || []).length > 0) {
          setInvalidImages(result);
        }
      })();
    }
  }, [open]);
  const dataList = useMemo(() => invalidImages.map(p => ({
    path: p,
    newPath: newImagePath[p]
  })), [newImagePath, invalidImages])
  return (<Dialog
    fullWidth={true}
    maxWidth={'md'}
    onClose={(event, reason) => {
      if (reason === 'backdropClick') {
        return;
      }
      setOpen(false);
    }}
    open={open}
  >
    <DialogTitle id="alert-dialog-title">
      {t('configDialog.reloadImageWizard')}
    </DialogTitle>
    <DialogContent sx={{height: '450px'}}>
      <TableContainer className={'reloadTableDiv'} component={Paper}>
        <Table sx={{ minWidth: 650 }} size="small" aria-label="a dense table">
          <TableHead>
            <TableRow>
              <TableCell>{t('configDialog.reloadImageTableColumn1')}</TableCell>
              <TableCell>{t('configDialog.reloadImageTableColumn2')}</TableCell>
              <TableCell className={'opCol'}>{t('configDialog.reloadImageTableColumn3')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {dataList.map((row) => (
              <TableRow key={row.path}>
                <TableCell>{row.path}</TableCell>
                <TableCell>{row.newPath}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </DialogContent>
    <DialogActions>
      <Button ref={cancelRef} onClick={() => setOpen(false)}>
        OK
      </Button>
    </DialogActions>
  </Dialog>)
})