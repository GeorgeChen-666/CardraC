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
      'marginFilling',
      'avoidDislocation',
      'columns',
      'rows',
      'cardWidth',
      'cardHeight',
      'marginX',
      'marginY',
      'autoColumnsRows',
      'bleed',
      'landscape',
      'pageSize',
      'pageWidth',
      'pageHeight',
      'sides'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  const isBrochure = Config.sides === 'brochure';
  useEffect(() => {
    if (Config.autoColumnsRows) {
      const pageWidth = Config.landscape ? Config.pageHeight : Config.pageWidth;
      const pageHeight = Config.landscape ? Config.pageWidth : Config.pageHeight;
      const autoColumns = isBrochure ? 2 : parseInt((pageWidth * 0.95) / (Config.cardWidth + Config.marginX));
      const autoRows = isBrochure ? 1 : parseInt((pageHeight * 0.95) / (Config.cardHeight + Config.marginY));
      const newConfig = { columns: autoColumns, rows: autoRows };
      if(isBrochure) {
        newConfig.marginX = 0;
        newConfig.marginY = 0;
      }
      dispatch(Actions.ConfigEdit(newConfig));
    }
  }, [
    Config.marginFilling,
    Config.autoColumnsRows,
    Config.pageSize,
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
      disabled={isBrochure}
    >
      mm
      <Control attrKey={'marginY'} type={ControlType.NumberInput} style={{ width: '90px' }} disabled={isBrochure}>
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
      <Control
        label={t('configDialog.scale')}
        attrKey={'scale'}
        type={ControlType.NumberInput}
        style={{ width: '90px' }}
      >%</Control>
    </Control>
    <Control label={t('configDialog.marginFilling')}>
      <Checkbox value={'true'} isChecked={Config.marginFilling}
                onChange={(event) => dispatch(Actions.ConfigEdit({ marginFilling: event.target.checked }))}
      ></Checkbox>
      <Control label={t('configDialog.avoidDislocation')}>
        <Checkbox value={'true'} isChecked={Config.avoidDislocation}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ avoidDislocation: event.target.checked }))}
        ></Checkbox>
      </Control>
    </Control>

    <Control label={t('configDialog.columns_rows')}>
      <HStack>
        <NumberInput isDisabled={Config.autoColumnsRows} width={'90px'}
                     value={Config.rows} onChange={(s, v) => {
          dispatch(Actions.ConfigEdit({ rows: v }));
        }} mr={4}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <NumberInput isDisabled={Config.autoColumnsRows} width={'90px'}
                     value={Config.columns} onChange={(s, v) => {
          dispatch(Actions.ConfigEdit({ columns: v }));
        }} mr={8}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Checkbox isDisabled={isBrochure} value={'true'} isChecked={Config.autoColumnsRows}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ autoColumnsRows: event.target.checked }))}
        >{t('configDialog.auto')}</Checkbox>
      </HStack>
    </Control>
  </div>);
};