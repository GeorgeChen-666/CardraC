import { HStack, Input, Radio, RadioGroup } from '@chakra-ui/react';
import React from 'react';
import { Control, ControlType } from './Control';
import './styles.css';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

export const MarkForm = () => {
  const { t } = useTranslation();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'fCutLine',
      'fCutlineColor',
      'fCutlineThinkness',
      'bCutLine',
      'bCutlineColor',
      'bCutlineThinkness',
      'sides'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  return (<div className={'FormPanel'}>
    <Control label={t('configDialog.fCutLine')}>
      <RadioGroup
        defaultValue={Config.fCutLine}
        onChange={(value) => dispatch(Actions.ConfigEdit({fCutLine:value}))}>
        <HStack>
          <Radio value={'0'}>{t('configDialog.none')}</Radio>
          <Radio value={'1'}>{t('configDialog.normal')}</Radio>
          <Radio value={'2'}>{t('configDialog.cross')}</Radio>
          <Radio value={'3'}>{t('configDialog.complete')}</Radio>
        </HStack>
      </RadioGroup>
    </Control>
    {Config.sides === 'double sides' && <Control label={t('configDialog.bCutLine')}>
      <RadioGroup defaultValue={Config.bCutLine}
                  onChange={(value) => dispatch(Actions.ConfigEdit({bCutLine:value}))}>
        <HStack>
          <Radio value={'0'}>{t('configDialog.none')}</Radio>
          <Radio value={'1'}>{t('configDialog.normal')}</Radio>
          <Radio value={'2'}>{t('configDialog.cross')}</Radio>
          <Radio value={'3'}>{t('configDialog.complete')}</Radio>
        </HStack>
      </RadioGroup>
    </Control>}
    <Control label={t('configDialog.color')}>
      <HStack>
        <Input name={'cutlineColor'} width={'80px'} type={'color'} defaultValue={Config.cutlineColor}
               onChange={(e) => dispatch(Actions.ConfigEdit({cutlineColor:e.target.value}))} />
        <Control
          label={t('configDialog.lineWeight')}
          attrKey={'lineWeight'}
          type={ControlType.NumberInput}
          style={{ width: '90px' }}
        >pt</Control>
      </HStack>
    </Control>
  </div>)
}