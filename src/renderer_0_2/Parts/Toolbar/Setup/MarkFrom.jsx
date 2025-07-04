import { ControlType, FormControl } from './FormControl';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../../../State/store';
import { layoutSides } from '../../../../public/constants';


export const MarkFrom = () => {
  const { t } = useTranslation();
  const { selectors: { Config }, mergeConfig } = useStore.getState();
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
  </div>)
}