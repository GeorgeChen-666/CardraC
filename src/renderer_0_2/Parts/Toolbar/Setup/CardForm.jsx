import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../State/store';
import { ControlType, FormControl } from './FormControl';
import { layoutSides } from '../../../../public/constants';
export const CardForm = () => {
  const { t } = useTranslation();
  const { selectors: { Config } } = useGlobalStore.getState();

  const isBrochure = Config.sides() === layoutSides.brochure;
  const isFoldInHalf = Config.sides() === layoutSides.foldInHalf;

  return (<div className={'FormPanel'}>
    <FormControl label={`${t('configDialog.cardWidth')} / ${t('configDialog.cardHeight')}`} width={'145px'} attrKey={'cardWidth'}
                 type={ControlType.NumberInput} min={0}>
      <FormControl width={'145px'} attrKey={'cardHeight'} type={ControlType.NumberInput} min={0}>
        mm
      </FormControl>
    </FormControl>
    {
      !isBrochure &&
      (<FormControl label={`${t('configDialog.marginX')} / ${t('configDialog.marginY')}`} width={'145px'} attrKey={'marginX'}
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
      <FormControl width={'145px'} attrKey={'bleedY'} type={ControlType.NumberInput} step={0.1} min={0} max={Config.marginY / 2}>
        mm
      </FormControl>
    </FormControl>
    <FormControl label={t('configDialog.columns_rows')} width={'145px'} attrKey={'rows'} disabled={Config.autoColumnsRows()}
                 type={ControlType.NumberInput} min={isFoldInHalf ? 2 : 1} step={isFoldInHalf ? 2 : 1}>
      <FormControl width={'145px'} attrKey={'columns'} disabled={Config.autoColumnsRows()} type={ControlType.NumberInput} min={0}>
      </FormControl>
      <FormControl label={t('configDialog.auto')} attrKey={'autoColumnsRows'} type={ControlType.Checkbox}></FormControl>
    </FormControl>
    <FormControl label={t('configDialog.scale')} width={'145px'} attrKey={'scale'}
                 type={ControlType.NumberInput} min={1}>
      %
    </FormControl>
    {Config.sides() === layoutSides.brochure &&
      (<FormControl label={t('configDialog.brochureRepeatPerPage')} attrKey={'brochureRepeatPerPage'} type={ControlType.Checkbox}></FormControl>)}
    {Config.sides() !== layoutSides.brochure &&
      (<FormControl label={t('configDialog.marginFilling')} attrKey={'marginFilling'} type={ControlType.Checkbox}></FormControl>)}
    {Config.sides() === layoutSides.doubleSides &&
      (<FormControl label={t('configDialog.avoidDislocation')} attrKey={'avoidDislocation'} type={ControlType.Checkbox}></FormControl>)}
  </div>)
}