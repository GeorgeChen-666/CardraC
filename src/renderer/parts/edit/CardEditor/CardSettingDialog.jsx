import Dialog from '@mui/material/Dialog';
import { DialogActions, DialogContent, DialogTitle } from '@mui/material';
import React, { forwardRef, useImperativeHandle, useEffect, useCallback } from 'react';
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
  const editedCards = useGlobalStore(state =>
    state.CardList.filter(c => idList.includes(c.id))
  ) || [];
  const { Config } = useGlobalStore.selectors;
  const sides = Config.sides();
  const marginX = Config.marginX();
  const marginY = Config.marginY();
  const isDoubleSidedMode = [layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides);
  const hasIndependentSettings = sides !== layoutSides.brochure;

  useEffect(() => {
    if (editedCards.length === 1 && open) {
      setBleed(editedCards[0]?.config?.bleed || {});
    }
  }, [editedCards, open]);

  useEffect(() => {
    if (open && !hasIndependentSettings) {
      setOpen(false);
      setIdList([]);
    }
  }, [open, hasIndependentSettings]);

  useImperativeHandle(ref, () => ({
    openDialog: (ids) => {
      if (!hasIndependentSettings) return;
      setIdList(ids);
      setOpen(true);
    },
  }), [hasIndependentSettings]);

  const handleBleedChange = useCallback((path) => (e, v) => {
    setBleed(prev => ({
      ...prev,
      [path]: Math.round(v * 100) / 100,
    }));
  }, []);

  return (
    <Dialog open={open && hasIndependentSettings}>
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
          <NumberInput
            value={bleed.faceBleedX}
            min={0}
            max={marginX / 2}
            step={0.1}
            width={160}
            label={t('configDialog.bleed')}
            disabled={false}
            onChange={handleBleedChange('faceBleedX')}
          />
          <NumberInput
            value={bleed.faceBleedY}
            min={0}
            max={marginY / 2}
            step={0.1}
            width={160}
            disabled={false}
            onChange={handleBleedChange('faceBleedY')}
          />
          mm
        </div>
        {isDoubleSidedMode && (
          <div className={'CardSettingInputRow'}>
            <FormLabel>{t('cardEditor.back')}</FormLabel>
            <NumberInput
              value={bleed.backBleedX}
              min={0}
              max={marginX / 2}
              step={0.1}
              width={160}
              label={t('configDialog.bleed')}
              disabled={false}
              onChange={handleBleedChange('backBleedX')}
            />
            <NumberInput
              value={bleed.backBleedY}
              min={0}
              max={marginY / 2}
              step={0.1}
              width={160}
              disabled={false}
              onChange={handleBleedChange('backBleedY')}
            />
            mm
          </div>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => {
          setOpen(false);
          editCardsConfig(idList, { bleed });
        }}>
          {t('button.ok')}
        </Button>
      </DialogActions>
    </Dialog>
  );
});
