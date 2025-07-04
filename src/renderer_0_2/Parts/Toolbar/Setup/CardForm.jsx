import React, { useEffect, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../State/store';
import { ControlType, FormControl } from './FormControl';
import { layoutSides } from '../../../../public/constants';
export const CardForm = () => {
  const { t } = useTranslation();
  const { selectors: { Config }, mergeConfig } = useStore.getState();

  const isBrochure = Config.sides() === layoutSides.brochure;
  const isFoldInHalf = Config.sides() === layoutSides.foldInHalf;
  const marginFilling = Config.marginFilling();
  const bleedX = Config.bleedX();
  const bleedY = Config.bleedY();
  const cardWidth = Config.cardWidth();
  const cardHeight = Config.cardHeight();
  const marginX = Config.marginX();
  const marginY = Config.marginY();
  const pageSize = Config.pageSize();
  const autoColumnsRows = Config.autoColumnsRows();
  const pageWidth = Config.pageWidth();
  const pageHeight = Config.pageHeight();
  const foldInHalfMargin = Config.foldInHalfMargin();
  const landscape = Config.landscape();
  const sides = Config.sides();

  useEffect(() => {
    if (autoColumnsRows) {
      const pWidth = landscape ? pageHeight : pageWidth;
      const pHeight = (landscape ? pageWidth : pageHeight) - foldInHalfMargin;
      const autoColumns = parseInt((pWidth * 0.95) / (cardWidth * (isBrochure ? 2 : 1) + marginX));
      let autoRows = parseInt((pHeight * 0.95) / (cardHeight + marginY));
      autoRows = autoRows - ((autoRows % 2 === 1 && isFoldInHalf) ? 1 : 0);
      const newConfig = { columns: autoColumns, rows: autoRows };
      mergeConfig(newConfig);
    }
  }, [
    marginFilling,
    autoColumnsRows,
    pageSize,
    pageWidth,
    pageHeight,
    cardWidth,
    cardHeight,
    marginX,
    marginY,
    landscape,
    foldInHalfMargin,
    sides,
  ]);

  useEffect(() => {
    if(bleedX > marginX / 2) {
      mergeConfig({ bleedX: marginX / 2 })
    }
    if(bleedY > marginY / 2) {
      mergeConfig({ bleedY: marginY / 2 })
    }
  }, [marginX, marginY, bleedX, bleedY]);
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