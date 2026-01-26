import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import React, { forwardRef, useImperativeHandle, useEffect } from 'react';
import { useGlobalStore } from '../../../state/store';
import { useTranslation } from 'react-i18next';
import { NumberInput } from '../../../componments/NumberInput';
import FormLabel from '@mui/material/FormLabel';
import Button from '@mui/material/Button';
import './style.css';
import { layoutSides } from '../../../../shared/constants';

export const CardSettingDialog = forwardRef(({}, ref) => {
  const { t } = useTranslation();
  const [bleed, setBleed] = React.useState({});
  const [open, setOpen] = React.useState(false);
  const [idList, setIdList] = React.useState([]);
  const { editCardsConfig } = useGlobalStore.getState();
  const editedCards = useGlobalStore(state => state.CardList.filter(c => idList.includes(c.id))) || [];
  const { Config } = useGlobalStore.selectors;
  const sides = Config.sides();
  const marginX = Config.marginX();
  const marginY = Config.marginY();
  useEffect(() => {
    if (editedCards.length === 1 && open) {
      setBleed(editedCards[0]?.config?.bleed || {});
    }
  }, [open, editedCards.length]);
  useImperativeHandle(ref, () => ({
    openDialog: (ids) => {
      setIdList(ids);
      setOpen(true);
    },
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
        <span>{marginX} / {marginY}</span>
      </div>
      <div className={'CardSettingInputRow'}>
        <FormLabel>{t('cardEditor.face')}</FormLabel>
        <BleedNumberInput path={'faceBleedX'} max={marginX / 2} label={t('configDialog.bleed')} />
        <BleedNumberInput path={'faceBleedY'} max={marginY / 2} />
        mm
      </div>
      {
        sides !== layoutSides.oneSide && <div className={'CardSettingInputRow'}>
          <FormLabel>{t('cardEditor.back')}</FormLabel>
          <BleedNumberInput path={'backBleedX'} max={marginX / 2} label={t('configDialog.bleed')} />
          <BleedNumberInput path={'backBleedY'} max={marginY / 2} />
          mm
        </div>
      }
    </DialogContent>
    <DialogActions>
      <Button onClick={() => {
        setOpen(false);
        editCardsConfig(idList, { bleed });
      }}>
        OK
      </Button>
    </DialogActions>
  </Dialog>);
});