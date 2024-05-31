import {
  Checkbox, HStack, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
} from '@chakra-ui/react';
import React, { useEffect } from 'react';
import { Control, ControlType } from './Control';
import './styles.css';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';

export const CardForm = () => {
  const { t } = useTranslation();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'columns',
      'rows',
      'cardWidth',
      'cardHeight',
      'marginX',
      'marginY',
      'autoColumnsRows',
      'bleed',
      'landscape',
      'pageWidth',
      'pageHeight',
      'sides'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  useEffect(() => {
    if (Config.autoColumnsRows) {
      const pageWidth = Config.landscape ? Config.pageHeight : Config.pageWidth;
      const pageHeight = Config.landscape ? Config.pageWidth : Config.pageHeight;
      const autoColumns = Config.sides === 'brochure' ? 2 : parseInt(pageWidth / (Config.cardWidth + Config.marginX));
      const autoRows = parseInt(pageHeight / (Config.cardHeight + Config.marginY));
      dispatch(Actions.ConfigEdit({ columns: autoColumns, rows: autoRows }));
    }
  }, [
    Config.autoColumnsRows,
    Config.pageWidth,
    Config.pageHeight,
    Config.cardWidth,
    Config.cardHeight,
    Config.marginX,
    Config.marginY,
    Config.landscape,
    Config.sides
  ]);
  return (<div className={'FormPanel'}>
    <Control label={t('configDialog.cardWidth')} attrKey={'cardWidth'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={t('configDialog.cardHeight')} attrKey={'cardHeight'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control
      label={`${t('configDialog.marginX')} / ${t('configDialog.marginY')}`}
      attrKey={'marginX'}
      type={ControlType.NumberInput}
      style={{ width: '90px' }}
    >
      mm
      <Control attrKey={'marginY'} type={ControlType.NumberInput} style={{ width: '90px' }}>
        mm
      </Control>
    </Control>

    <Control
      label={t('configDialog.bleed')}
      attrKey={'bleed'}
      type={ControlType.NumberInput}
      style={{ width: '90px' }}
    >
      mm
      <Control label={t('configDialog.avoidDislocation')}>
        <Checkbox value={'true'} isChecked={Config.avoidDislocation}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ avoidDislocation: event.target.checked }))}
        ></Checkbox>
      </Control>
    </Control>
    <Control label={t('configDialog.scale')} attrKey={'scale'} type={ControlType.NumberInput}>
      %
    </Control>
    <Control label={t('configDialog.columns_rows')}>
      <HStack>
        <NumberInput isDisabled={Config.autoColumnsRows} width={'90px'}
                     value={Config.landscape ? Config.rows : Config.columns} onChange={(s, v) => {
          dispatch(Actions.ConfigEdit({ [Config.landscape ? 'rows' : 'columns']: v }));
        }} mr={4}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <NumberInput isDisabled={Config.autoColumnsRows} width={'90px'}
                     value={Config.landscape ? Config.columns : Config.rows} onChange={(s, v) => {
          dispatch(Actions.ConfigEdit({ [Config.landscape ? 'columns' : 'rows']: v }));
        }} mr={8}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Checkbox value={'true'} isChecked={Config.autoColumnsRows}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ autoColumnsRows: event.target.checked }))}
        >{t('configDialog.auto')}</Checkbox>
      </HStack>
    </Control>
  </div>);
};