import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { useGlobalStore } from '../../State/store';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../Componments/NumberInput';
import FormLabel from '@mui/material/FormLabel';
import Button from '@mui/material/Button';
import './style.css';
import { layoutSides } from '../../../public/constants';

export const CardSettingDialog = forwardRef(({}, ref) => {
  const { t } = useTranslation();
  const [bleed, setBleed] = React.useState({});
  const [open, setOpen] = React.useState(false);
  const { selectedCardsConfig } = useGlobalStore.getState();
  const selectedCards = useGlobalStore(state => state.CardList.filter(c => c.selected)) || [];
  const { Config } = useGlobalStore.selectors;
  const sides = Config.sides();
  useEffect(() => {
    if (selectedCards.length === 1 && open) {
      setBleed(selectedCards[0]?.config?.bleed || {});
    }
  }, [open, selectedCards.length]);
  useImperativeHandle(ref, () => ({
    openDialog: () => setOpen(true),
  }));
  const BleedNumberInput = ({path, max=999, label=''}) => {
    return (<NumberInput
      value={bleed[path]} min={0} max={max}
      step={0.1}
      width={160} label={label} disabled={false}
      onChange={(e, v) => {
        setBleed(prev => ({
          ...prev,
          [path]: Math.round(v * 100) / 100,
        }));
      }}
    />);
  };
  return (<Dialog open={open}>
    <DialogTitle>
      {t('cardEditor.spicalConfig')}
    </DialogTitle>
    <DialogContent>
      <div className={'CardSettingInputRow'}>
        <span>{`${t('configDialog.marginX')} / ${t('configDialog.marginY')}`}</span>
        <span>{Config.marginX()} / {Config.marginY()}</span>
      </div>
      <div className={'CardSettingInputRow'}>
        <FormLabel>{t('cardEditor.face')}</FormLabel>
        <BleedNumberInput path={'faceBleedX'} max={Config.marginX() / 2} label={t('configDialog.bleed')} />
        <BleedNumberInput path={'faceBleedY'} max={Config.marginY() / 2} />
        mm
      </div>
      {
        sides !== layoutSides.oneSide && <div className={'CardSettingInputRow'}>
          <FormLabel>{t('cardEditor.back')}</FormLabel>
          <BleedNumberInput path={'backBleedX'} max={Config.marginX() / 2} label={t('configDialog.bleed')} />
          <BleedNumberInput path={'backBleedY'} max={Config.marginY() / 2} />
          mm
        </div>
      }
    </DialogContent>
    <DialogActions>
      <Button onClick={() => {
        setOpen(false);
        selectedCardsConfig({ bleed });
      }}>
        OK
      </Button>
    </DialogActions>
  </Dialog>);
});