import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../../state/store';
import { ControlType, FormControl } from './FormControl';
import { layoutSides } from '../../../../../shared/constants';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';

export const CardForm = () => {
  const { t } = useTranslation();
  const { Config } = useGlobalStore.selectors;

  const { mergeConfig } = useGlobalStore.getState();
  const isBrochure = Config.sides() === layoutSides.brochure;
  const isFoldInHalf = Config.sides() === layoutSides.foldInHalf;
  const cardWidth = Config.cardWidth();
  const cardHeight = Config.cardHeight();
  const foldLineType = Config.foldLineType();

  return (<div className={'FormPanel'}>
    <FormControl label={`${t('configDialog.cardWidth')} / ${t('configDialog.cardHeight')}`} width={'130px'}
                 attrKey={'cardWidth'}
                 type={ControlType.NumberInput} min={0}>
      <Tooltip title={t('configDialog.saveCurrentConfig')}>
        <IconButton size='small'
                    onClick={(e) => {
                      // setEditingId('_new_');
                      mergeConfig({ cardWidth: cardHeight, cardHeight: cardWidth });
                    }}>
          <SwapHorizIcon fontSize='small' />
        </IconButton>
      </Tooltip>
      <FormControl width={'129px'} attrKey={'cardHeight'} type={ControlType.NumberInput} min={0}>
        mm
      </FormControl>
    </FormControl>
    {
      !isBrochure &&
      (<FormControl label={`${t('configDialog.marginX')} / ${t('configDialog.marginY')}`} width={'145px'}
                    attrKey={'marginX'}
                    type={ControlType.NumberInput} min={0}>
        <FormControl width={'145px'} attrKey={'marginY'} type={ControlType.NumberInput} min={0}>
          mm
        </FormControl>
      </FormControl>)
    }
    {
      isFoldInHalf &&
      (<FormControl label={t('configDialog.foldInHalfMargin')} width={'145px'} attrKey={'foldInHalfMargin'}
                    type={ControlType.NumberInput} min={0}>
        mm
      </FormControl>)
    }
    <FormControl label={t('configDialog.bleed')} width={'145px'} attrKey={'bleedX'}
                 type={ControlType.NumberInput} step={0.1} min={0} max={Config.marginX() / 2}>
      <FormControl width={'145px'} attrKey={'bleedY'} type={ControlType.NumberInput} step={0.1} min={0}
                   max={Config.marginY() / 2}>
        mm
      </FormControl>
    </FormControl>
    <FormControl label={t('configDialog.columns_rows')} width={'145px'} attrKey={'rows'}
                 disabled={Config.autoColumnsRows()}
                 type={ControlType.NumberInput} min={(isFoldInHalf && foldLineType === '0') ? 2 : 1}
                 step={(isFoldInHalf && foldLineType === '0') ? 2 : 1}>
      <FormControl width={'145px'} attrKey={'columns'} disabled={Config.autoColumnsRows()}
                   type={ControlType.NumberInput} min={(isFoldInHalf && foldLineType === '1') ? 2 : 1}
                   step={(isFoldInHalf && foldLineType === '1') ? 2 : 1}>
      </FormControl>
      <FormControl label={t('configDialog.auto')} attrKey={'autoColumnsRows'} type={ControlType.Checkbox}></FormControl>
    </FormControl>
    <FormControl label={t('configDialog.scale')} width={'145px'} attrKey={'scale'}
                 type={ControlType.NumberInput} min={1}>
      %
    </FormControl>
    {Config.sides() === layoutSides.brochure &&
      (<FormControl label={t('configDialog.brochureRepeatPerPage')} attrKey={'brochureRepeatPerPage'}
                    type={ControlType.Checkbox}></FormControl>)}
    {Config.sides() !== layoutSides.brochure &&
      (<FormControl label={t('configDialog.marginFilling')} attrKey={'marginFilling'}
                    type={ControlType.Checkbox}></FormControl>)}
    {Config.sides() === layoutSides.doubleSides &&
      (<FormControl label={t('configDialog.avoidDislocation')} attrKey={'avoidDislocation'}
                    type={ControlType.Checkbox}></FormControl>)}
  </div>);
};