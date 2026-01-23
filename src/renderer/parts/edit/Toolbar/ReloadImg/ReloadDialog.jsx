import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import SearchIcon from '@mui/icons-material/Search';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import './style.css'

import { useTranslation } from 'react-i18next';
import { eleActions } from '../../../../../shared/constants';
import { callMain } from '../../../../functions';
import { useGlobalStore } from '../../../../state/store';
import IconButton from '@mui/material/IconButton';

export const ReloadDialog = forwardRef(({},ref) => {
  const { t } = useTranslation();
  const { Config: ConfigFn, CardList: CardListFn } = useGlobalStore.selectors;
  const { mergeState, reloadLocalImage } = useGlobalStore.getState();
  const [open, setOpen] = React.useState(false);
  const [invalidImages, setInvalidImages] = useState([]);
  const [confirmCallBack, setConfirmCallBack] = useState([]);
  const cancelRef = React.useRef()
  useImperativeHandle(ref, () => ({
    openDialog: (ivm, cb) => {
      setOpen(true);
      setInvalidImages(ivm);
      setConfirmCallBack(cb)
    },
  }));
  const [newImagePath, setNewImagePath] = useState({});
  const Config = ConfigFn();
  const CardList = CardListFn();
  useEffect(() => {
    if(open) {
      (async () => {
        // setReloadProgress(0);
        setNewImagePath({})
      })();
    }
  }, [open]);
  const dataList = useMemo(() => invalidImages.map(p => ({
    path: p,
    newPath: newImagePath[p]
  })), [newImagePath, invalidImages]);
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
                <TableCell>
                  <IconButton onClick={async () => {
                    const path = row.path;
                    const getFileName = path => decodeURI(new URL(path).pathname.split('/').pop());
                    const newPath = await callMain(eleActions.getImagePath);
                    if(newPath) {
                      setNewImagePath(last => ({...last, [path]: newPath}));
                      const pathFileName = getFileName(path);
                      if(pathFileName === getFileName(newPath)) {
                        const replaceFrom = path.replace(pathFileName, '');
                        const replaceTo = newPath.replace(pathFileName, '');
                        const emptyInvalidImages = invalidImages.filter(p => !Object.keys(newImagePath).includes(p));
                        const newPathList = emptyInvalidImages.map(p => p.replace(replaceFrom, replaceTo));
                        const result = await callMain(eleActions.checkImage, { pathList: newPathList });
                        newPathList.forEach((p, index) => {
                          if(!result.includes(p)) {
                            setNewImagePath(last => ({...last, [emptyInvalidImages[index]]: p}));
                          }
                        });
                      }
                    }
                  }}>
                    <SearchIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </DialogContent>
    <DialogActions>
      <Button ref={cancelRef} onClick={() => {
        setOpen(false);
        const fillNewPath = (image) => {
          if(image && image.path && newImagePath[image.path]) {
            image.path = newImagePath[image.path];
            delete image.mtime;
          }
        }
        fillNewPath(Config.globalBackground);
        CardList.forEach((c, index) => {
          fillNewPath(c.face);
          fillNewPath(c.back)
        });
        mergeState({ Config, CardList: [...CardList] });
        reloadLocalImage();
      }}>
        OK
      </Button>
    </DialogActions>
  </Dialog>)
})