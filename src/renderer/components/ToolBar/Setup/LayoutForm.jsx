import { Checkbox, Input, Link, Radio, RadioGroup, Select, Stack } from '@chakra-ui/react';
import React from 'react';
import { Control, ControlType } from './Control';
import './styles.css';
import _ from 'lodash';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { flipWay, layoutSides } from '../../../../public/constants';

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
      'showPageNumber',
      'compressLevel',
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
    <Control label={t('configDialog.pageWidthHeight')}
             attrKey={'pageWidth'} type={ControlType.NumberInput}
             style={{ width: '90px' }}
             onChange={(value) =>
      dispatch(Actions.ConfigEdit({ pageWidth: value, pageSize: '' }))
    }>mm
      <Control attrKey={'pageHeight'} type={ControlType.NumberInput} style={{ width: '90px', marginLeft: '41px' }}
               onChange={(value) =>
        dispatch(Actions.ConfigEdit({ pageHeight: value, pageSize: '' }))
      }>
        mm
      </Control>
    </Control>

    <Control label={t('configDialog.offsetXY')} attrKey={'offsetX'} type={ControlType.NumberInput} min={-9999} style={{ width: '90px' }}>
      mm
      <Control attrKey={'offsetY'} type={ControlType.NumberInput} min={-9999} style={{ width: '90px', marginLeft: '41px' }}>
        mm
      </Control>
    </Control>

    <Control label={t('configDialog.side')}>
      <RadioGroup value={Config.sides} onChange={(v) => dispatch(Actions.ConfigEdit({ sides: v }))}>
        <Stack direction='row' wrap={'wrap'} width={'300px'}>
          <Radio value={layoutSides.oneSide}>{t('configDialog.oneSide')}</Radio>
          <Radio value={layoutSides.foldInHalf}>{t('configDialog.foldInHalf')}</Radio>
          <Radio value={layoutSides.doubleSides}>{t('configDialog.doubleSides')}</Radio>
          <Radio value={layoutSides.brochure}>{t('configDialog.brochure')}</Radio>
        </Stack>
      </RadioGroup>
    </Control>
    {![layoutSides.oneSide, layoutSides.foldInHalf].includes(Config.sides)  && (<Control label={t('configDialog.flip')}>
      {!Config.autoConfigFlip && <Select value={Config.flip} width={'230px'} onChange={(event) => {
        const flip = event.target.value || '';
        dispatch(Actions.ConfigEdit({ flip, autoConfigFlip: (flip === '') }));
      }}>
        <option value={''}>{t('configDialog.auto')}</option>
        <option value={flipWay.longEdgeBinding}>{t('configDialog.longEdgeBinding')}</option>
        <option value={flipWay.shortEdgeBinding}>{t('configDialog.shortEdgeBinding')}</option>
      </Select>}
      {Config.autoConfigFlip && (<Stack direction='row' alignItems={'center'}>
        <Input width={'230px'} isDisabled value={Config.landscape ? t('configDialog.longEdgeBinding') : t('configDialog.shortEdgeBinding')} />
        <Link color={'blue'} onClick={() => {
          dispatch(Actions.ConfigEdit({ flip: Config.landscape ? flipWay.longEdgeBinding : flipWay.shortEdgeBinding, autoConfigFlip: false }));
        }}>{t('configDialog.edit')}</Link>
      </Stack>)}
    </Control>)}

    <Control label={t('configDialog.compressLevel')}>
      <Select value={Config.compressLevel} width={'80px'} mr={3} onChange={(event) => {
        const newLevel = parseInt(event.target.value);
        if (newLevel) {
          dispatch(Actions.ConfigEdit({ compressLevel:newLevel }));
        }
      }}>
        <option value={1}>{t('configDialog.compressLevelOption', {lv:1})}</option>
        <option value={2}>{t('configDialog.compressLevelOption', {lv:2})}</option>
        <option value={3}>{t('configDialog.compressLevelOption', {lv:3})}</option>
        <option value={4}>{t('configDialog.compressLevelOption', {lv:4})}</option>
      </Select>
      {t('configDialog.compressLevelDes')}
    </Control>
    <Control label={t('configDialog.pageNumber')}>
      <Checkbox isChecked={Config.showPageNumber} onChange={(e,d) => {
        dispatch(Actions.ConfigEdit({ showPageNumber: e.target.checked }));
      }} />
    </Control>
  </div>);
};