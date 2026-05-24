import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Box, Divider, TextField } from '@mui/material';
import Button from '@mui/material/Button';
import { GuideDialog } from './GuideDialog';
import { callMain, getPrinters } from '../../../functions';
import { eleActions } from '../../../../shared/constants';
import { useGlobalStore } from '../../../state/store';
import { NumberInput } from '../../../componments/NumberInput';
import MenuItem from '@mui/material/MenuItem';
import { useTranslation } from 'react-i18next';
import './styles.css'

export const PrintDrawer = forwardRef(({ onOpenChange }, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [printConfig, setPrintConfig] = React.useState({});
  const dialogGuideRef = useRef(null);
  const cancelRef = React.useRef();
  const { Global } = useGlobalStore.selectors;

  const {
    printPages
  } = useGlobalStore.getState();

  const exportPageCount = Global.exportPageCount();
  const [pageStart, setPageStart] = React.useState(1);
  const [pageEnd, setPageEnd] = React.useState(exportPageCount);
  const [pageFilter, setPageFilter] = React.useState('all');
  const [printers, setPrinters] = React.useState([]);
  const [defaultPrinter, setDefaultPrinter] = React.useState(null);

  useEffect(() => {
    setPageStart(1);
    setPageEnd(exportPageCount);
  }, [exportPageCount]);
  useImperativeHandle(ref, () => ({
    openDrawer: async () => {
      console.log('openDrawer called'); //添加日志
      setOpen(true);
      onOpenChange?.(true);
      const { printConfig } = await callMain(eleActions.loadPrintConfig);
      console.log('loadPrintConfig', printConfig)
      setPrintConfig(printConfig);
      setPageStart(1);
      setPageFilter('all');
      const { printers } = await getPrinters();
      setPrinters(printers);
      if(printConfig?.defaultPrinter) {
        setDefaultPrinter(printConfig.defaultPrinter);
      } else {
        printers.forEach((p) => p.isDefault && setDefaultPrinter(p.name));
      }
      console.log('printers', printers)
    },
    closeDrawer: async () => {
      console.log('closeDrawer called'); //添加日志
      setOpen(false);
      onOpenChange?.(false);
    },
    isOpen: open,
  }));

  const handleMouseDown = (e) => {
    e.stopPropagation();
  };

  const handleClose = () => {
    console.log('handleClose called'); //添加日志
    setOpen(false);
    onOpenChange?.(false);
  };

  const updatePrintConfig = (args) => {
    setPrintConfig((prevState) => {
      const result = {...prevState, ...args}
      callMain(eleActions.savePrintConfig, {printConfig: result})
      return result
    });

  }
  return (
    <Box
      className={'print-drawer'}
      onMouseDown={handleMouseDown}
      sx={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        width: 500,
        boxShadow: '0 8px 16px rgba(0,0,0,0.1)',
        display: open?'flex':'none',
        flexDirection: 'column',
        zIndex: 1200,
        backgroundColor: '#2E2E2E',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 225ms cubic-bezier(0, 0, 0.2, 1)',
      }}
    >
      {/* 内容区域 */}
      <Box sx={{
        p: 3,
        flexGrow: 1,
        overflow: 'auto',
        minHeight: 0,
      }}>
        <div>
          <div>
            <div className={'inputLine'}>
              <TextField
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                sx={{ width: 260 }} label={t('configPrintDialog.targetPrinter')} select size='small'
                onChange={(e, v) => {
                  setDefaultPrinter(v?.props?.value);
                  updatePrintConfig({ defaultPrinter: v?.props?.value });
                }}
                value={defaultPrinter}
              >
                {
                  printers
                    .map(p => ({ label: p?.name, value: p?.name }))
                    .map(item => (<MenuItem value={item.value}>{item.label}</MenuItem>))
                }
              </TextField>
            </div>
            <div className={'inputLine'}>
              <NumberInput
                value={pageStart}
                min={1} max={pageEnd}
                step={1}
                width={145} label={t('configPrintDialog.pageRange')}
                onChange={(e, v) => {
                  setPageStart(v);
                }}
              />
              <NumberInput
                value={pageEnd}
                min={pageStart} max={pageEnd}
                step={1}
                width={145}
                onChange={(e, v) => {
                  setPageEnd(v);
                }}
              />
            </div>
            <div className={'inputLine'}>
              <TextField
                slotProps={{
                  inputLabel: {
                    shrink: true,
                  },
                }}
                sx={{ width: 260 }} label={t('configPrintDialog.printFilter')} select size='small'
                onChange={(e, v) => {
                  setPageFilter(v?.props?.value);
                }}
                value={pageFilter}
              >
                {[
                  { label: t('configPrintDialog.printFilter_all'), value: 'all' },
                  { label: t('configPrintDialog.printFilter_odd'), value: 'odd' },
                  { label: t('configPrintDialog.printFilter_even'), value: 'even' },
                ].map(item => (<MenuItem value={item.value}>{item.label}</MenuItem>))}
              </TextField>
            </div>
          </div>
        </div>
        <div>
          <div>{t('configPrintDialog.printParams')}</div>
          <div className={'inputLine'}>
            <div style={{ textAlign: 'right' }}>
              <Button
                size='small'
                onClick={() => {
                  dialogGuideRef.current.openDialog();
                }}
              >{t('configPrintDialog.adjustOffsetGuide')}</Button>
            </div>
            <NumberInput
              value={printConfig.offsetX}
              min={0} max={50}
              step={0.1}
              width={145} label={t('configDialog.offsetXY')}
              onChange={(e, v) => {
                updatePrintConfig({ offsetX: v });
              }}
            />
            <NumberInput
              value={printConfig.offsetY}
              min={0} max={50}
              step={0.1}
              width={145}
              onChange={(e,v) => {
                updatePrintConfig({offsetY:v});
              }}
            />
            mm
          </div>
          <div className={'inputLine'}>
            <NumberInput
              value={printConfig.scaleX}
              min={1} max={200}
              step={0.1}
              width={145} label={t('configDialog.scaleXY')}
              onChange={(e,v) => {
                updatePrintConfig({scaleX:v});
              }}
            />
            <NumberInput
              value={printConfig.scaleY}
              min={1} max={200}
              step={0.1}
              width={145}
              onChange={(e,v) => {
                updatePrintConfig({scaleY:v});
              }}
            />
            %
          </div>
        </div>
      </Box>

      <Divider />

      <Box sx={{
        p: 2,
        display: 'flex',
        gap: 1,
        justifyContent: 'flex-end',
        flexShrink: 0,
      }}>
        <Button ref={cancelRef} onClick={() => {
          handleClose();
          const pageList = ((start, end, isOdd = 0) =>
            new Array(end - start + 1)
              .fill(0).map((_, i) => i + start)
              .filter((_, i) => (i % 2 === isOdd) || isOdd === 2)
          )(pageStart, pageEnd, ['odd', 'even', 'all'].indexOf(pageFilter));
          printPages({ pageList, printConfig });
        }} variant='contained'>
          {t('button.print')}
        </Button>
        <Button ref={cancelRef} onClick={handleClose}>
          {t('button.cancel')}
        </Button>
      </Box>
      <GuideDialog ref={dialogGuideRef} updatePrintConfig={updatePrintConfig} />
    </Box>
  );
});

