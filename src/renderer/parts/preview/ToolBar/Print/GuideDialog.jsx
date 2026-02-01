import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import { callMain, version } from '../../../../functions';
import {
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Step,
  StepContent,
  StepLabel,
  Stepper,
} from '@mui/material';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { eleActions } from '../../../../../shared/constants';
import { NumberInput } from '../../../../componments/NumberInput';
import { fixFloat } from '../../../../../main/ele_action/handlers/file_render/Utils';
import { useTranslation } from 'react-i18next';



export const GuideDialog = forwardRef(({ updatePrintConfig },ref) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = React.useState(0);
  const [size1, setSize1] = React.useState(15);
  const [size2, setSize2] = React.useState(15);
  const [size3, setSize3] = React.useState(15);
  const [size4, setSize4] = React.useState(15);
  const steps = [
    {
      label: t('configPrintDialog.guideStep1_title'),
      description: t('configPrintDialog.guideStep1_body'),
      buttons: {
        next: {
          label: t('configPrintDialog.guideStep1_button1'),
          onClick: async () => {
            const rs = await callMain(eleActions.adjustGuidePrint);
            if(rs) {
              setActiveStep((prevActiveStep) => prevActiveStep + 1);
            }
          }
        },
        last: {
          label:t('configPrintDialog.guideStep1_button2'),
          onClick: async () => {
            setActiveStep((prevActiveStep) => prevActiveStep + 1);
          }
        }
      },
    },
    {
      label: t('configPrintDialog.guideStep2_title'),
      description: (<div>
        <p>{t('configPrintDialog.guideStep2_body')}</p>
        <p>
          <NumberInput
            value={size1}
            min={0} max={50}
            step={0.1}
            width={300} label={t('configPrintDialog.guideStep2_body_field1')}
            onChange={(e,v) => {
              setSize1(v)
            }}
          />mm
        </p>
        <p>
          <NumberInput
            value={size2}
            min={0} max={50}
            step={0.1}
            width={300} label={t('configPrintDialog.guideStep2_body_field2')}
            onChange={(e,v) => {
              setSize2(v)
            }}
          />mm
        </p>
        <p>
          <NumberInput
            value={size3}
            min={0} max={50}
            step={0.1}
            width={300} label={t('configPrintDialog.guideStep2_body_field3')}
            onChange={(e,v) => {
              setSize3(v)
            }}
          />mm
        </p>
        <p>
          <NumberInput
            value={size4}
            min={0} max={50}
            step={0.1}
            width={300} label={t('configPrintDialog.guideStep2_body_field4')}
            onChange={(e,v) => {
              setSize4(v)
            }}
          />mm
        </p>
      </div>),
      buttons: {
        next: {
          label: t('configPrintDialog.guideStep2_button1'),
        },
        last: {
          label: t('button.prev'),
        },
      },
    },
    {
      label: t('configPrintDialog.guideStep3_title'),
      description: t('configPrintDialog.guideStep3_body', {x:fixFloat((size3 - size1) / 2), y: fixFloat((size4 - size2) / 2)}),
      buttons: {
        next: {
          label: t('configPrintDialog.guideStep3_button1'),
          onClick: () => {
            updatePrintConfig({ offsetX: fixFloat((size3 - size1) / 2), offsetY: fixFloat((size4 - size2) / 2) })
            setOpen(false);
          }
        },
        last: {
          label: t('button.prev')
        }
      },
    },
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const [open, setOpen] = React.useState(false);
  const cancelRef = React.useRef()
  useImperativeHandle(ref, () => ({
    openDialog: () => {
      setActiveStep(0);
      setOpen(true);
      setSize1(15);
      setSize2(15);
      setSize3(15);
      setSize4(15);
    },
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
    onClose={(event, reason) => {
      if (reason === 'backdropClick') {
        return;
      }
      setOpen(false);
    }}
    open={open}
  >
    <DialogTitle>
      {t('configPrintDialog.adjustOffsetGuide')}
    </DialogTitle>
    <DialogContent>
      <DialogContentText>
        <Box sx={{ maxWidth: 400 }}>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  sx={{
                    '& .MuiStepLabel-labelContainer .MuiStepLabel-label': {
                      color: '#1976d2'
                    }
                  }}
                >
                  {step.label}
                </StepLabel>
                <StepContent>
                  <Typography>{step.description}</Typography>
                  <Box sx={{ mb: 2 }}>
                    <Button
                      variant="contained"
                      onClick={step.buttons.next.onClick || handleNext}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      {step.buttons.next.label}
                    </Button>
                    <Button
                      onClick={step.buttons.last.onClick || handleBack}
                      sx={{ mt: 1, mr: 1 }}
                    >
                      {step.buttons.last.label}
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Box>
      </DialogContentText>
    </DialogContent>
    <DialogActions>
      <Button ref={cancelRef} onClick={() => setOpen(false)}>
        {t('button.close')}
      </Button>
    </DialogActions>
  </Dialog>);
})