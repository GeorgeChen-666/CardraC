import React, { forwardRef, useImperativeHandle } from 'react';
import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';
import { ConfigOverview } from './ConfigOverview';
import { LayoutForm } from './LayoutForm';
import './styles.css';
import { CardForm } from './CardForm';
import { MarkFrom } from './MarkFrom';
import useAutoCalc from './useAutoCalc';

const CustomTabPanel = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
  >
    {value === index && <Box sx={{ p: 1 }}>{children}</Box>}
  </div>
)

export const SetupDialog = forwardRef(({},ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(0);
  const handleChange = (event, newValue) => {
    setValue(newValue);
  };
  const cancelRef = React.useRef()
  useImperativeHandle(ref, () => ({
    openDialog: () => setOpen(true),
  }));

  useAutoCalc();

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
      {t('configDialog.setup')}:
    </DialogTitle>
    <DialogContent sx={{height: '450px'}}>
      <ConfigOverview />
      <Box
        sx={{ flexGrow: 1, display: 'flex' }}
      >
        <Box>
          <Tabs orientation="vertical" value={value} onChange={handleChange}>
            <Tab label={t('configDialog.layout')} />
            <Tab label={t('configDialog.card')} />
            <Tab label={t('configDialog.mark')} />
          </Tabs>
        </Box>
        <CustomTabPanel value={value} index={0}>
          <LayoutForm />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={1}>
          <CardForm />
        </CustomTabPanel>
        <CustomTabPanel value={value} index={2}>
          <MarkFrom />
        </CustomTabPanel>
      </Box>
    </DialogContent>
    <DialogActions>
      <Button ref={cancelRef} onClick={() => setOpen(false)}>
        OK
      </Button>
    </DialogActions>
  </Dialog>);
})