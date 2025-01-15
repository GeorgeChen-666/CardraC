import {
  Checkbox, Input, Radio, RadioGroup,
  Select, Stack, Link,
} from '@chakra-ui/react';
import React from 'react';
import { Control, ControlType } from './Control';
import './styles.css';
import _ from 'lodash';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

export const LayoutForm = () => {
  const { t } = useTranslation();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'pageSize',
      'landscape',
      'pageWidth',
      'pageHeight',
      'sides',
      'globalBackground',
      'autoConfigFlip',
      'flip'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();

  return (<div className={'FormPanel'}>
    <Control label={t('configDialog.size')}>
      <Select value={Config.pageSize} width={'120px'} mr={3} onChange={(event) => {
        const pageSize = event.target.value;
        if (pageSize) {
          const [width, height] = event.target.value.replace(/A\d:/, '').split(',');
          dispatch(Actions.ConfigEdit({ pageSize, pageWidth: parseInt(width), pageHeight: parseInt(height) }));
        }
      }}>
        <option value={''}>{t('configDialog.custom')}</option>
        <option value={'A5:148,210'}>A5</option>
        <option value={'A4:210,297'}>A4</option>
        <option value={'A3:297,420'}>A3</option>
        <option value={'A2:420,594'}>A2</option>
        <option value={'A1:594,841'}>A1</option>
      </Select>
      <Checkbox value={'true'} isChecked={Config.landscape}
                onChange={(event) => dispatch(Actions.ConfigEdit({ landscape: event.target.checked }))}
      >{t('configDialog.landscape')}</Checkbox>
    </Control>
    <Control label={t('configDialog.pageWidth')} attrKey={'pageWidth'} type={ControlType.NumberInput} onChange={(value) =>
      dispatch(Actions.ConfigEdit({ pageWidth: value, pageSize: '' }))
    }>
      mm
    </Control>
    <Control label={t('configDialog.pageHeight')} attrKey={'pageHeight'} type={ControlType.NumberInput} onChange={(value) =>
      dispatch(Actions.ConfigEdit({ pageHeight: value, pageSize: '' }))
    }>
      mm
    </Control>
    <Control label={t('configDialog.offsetX')} attrKey={'offsetX'} type={ControlType.NumberInput} min={-9999}>
      mm
    </Control>
    <Control label={t('configDialog.offsetY')} attrKey={'offsetY'} type={ControlType.NumberInput} min={-9999}>
      mm
    </Control>
    <Control label={t('configDialog.side')}>
      <RadioGroup value={Config.sides} onChange={(v) => dispatch(Actions.ConfigEdit({ sides: v }))}>
        <Stack direction='row'>
          <Radio value='one side'>{t('configDialog.oneSide')}</Radio>
          <Radio value='double sides'>{t('configDialog.doubleSides')}</Radio>
          <Radio value='brochure'>{t('configDialog.brochure')}</Radio>
        </Stack>
      </RadioGroup>
    </Control>
    {Config.sides === 'double sides' && (<Control label={t('configDialog.flip')}>
      {!Config.autoConfigFlip && <Select value={Config.flip} width={'230px'} onChange={(event) => {
        const flip = event.target.value || '';
        dispatch(Actions.ConfigEdit({ flip, autoConfigFlip: (flip === '') }));
      }}>
        <option value={''}>{t('configDialog.auto')}</option>
        <option value={'long-edge binding'}>{t('configDialog.longEdgeBinding')}</option>
        <option value={'short-edge binding'}>{t('configDialog.shortEdgeBinding')}</option>
      </Select>}
      {Config.autoConfigFlip && (<Stack direction='row' alignItems={'center'}>
        <Input width={'230px'} isDisabled value={Config.landscape ? t('configDialog.longEdgeBinding') : t('configDialog.shortEdgeBinding')} />
        <Link color={'blue'} onClick={() => {
          dispatch(Actions.ConfigEdit({ flip: Config.landscape ? 'long-edge binding' : 'short-edge binding', autoConfigFlip: false }));
        }}>{t('configDialog.edit')}</Link>
      </Stack>)}
    </Control>)}
  </div>);
};