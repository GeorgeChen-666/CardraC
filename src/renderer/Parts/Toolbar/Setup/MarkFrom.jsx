import { ControlType, FormControl } from './FormControl';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../State/store';
import { layoutSides } from '../../../../shared/constants';


export const MarkFrom = () => {
  const { t } = useTranslation();
  const { Config } = useGlobalStore.selectors;
  const items = [
    { label: t('configDialog.none'), value: '0' },
    { label: t('configDialog.normal'), value: '1' },
    { label: t('configDialog.cross'), value: '2' },
    { label: t('configDialog.complete'), value: '3' },
  ]
  return (<div className={'FormPanel'}>
    <FormControl label={t('configDialog.fCutLine')} width={'145px'} attrKey={'fCutLine'} type={ControlType.RadioGroup}
                 items={items} />
    {Config.sides() === layoutSides.doubleSides &&
      <FormControl label={t('configDialog.bCutLine')} width={'145px'} attrKey={'bCutLine'} type={ControlType.RadioGroup}
                   items={items} />}
    <FormControl label={t('configDialog.color')} width={'130px'} attrKey={'cutlineColor'} type={ControlType.ColorPicker}>
      <FormControl label={t('configDialog.lineWeight')} width={'130px'} attrKey={'lineWeight'} min={0}
                   type={ControlType.NumberInput}>pt
      </FormControl>
    </FormControl>
    <FormControl label={t('configDialog.printOffset')} width={'145px'} attrKey={'printOffsetX'} type={ControlType.NumberInput}>
      <FormControl width={'145px'} attrKey={'printOffsetY'} type={ControlType.NumberInput}>
        mm
      </FormControl>
    </FormControl>
  </div>)
}