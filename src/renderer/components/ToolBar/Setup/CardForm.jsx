import {
  Checkbox, HStack, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper
} from '@chakra-ui/react';
import React, { useEffect } from 'react';
import {Control, ControlType} from './Control';
import './styles.css';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';

export const CardForm = () => {
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
      'pageHeight'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  useEffect(() => {
    if(Config.autoColumnsRows) {
      const pageWidth = Config.landscape? Config.pageHeight: Config.pageWidth;
      const pageHeight = Config.landscape? Config.pageWidth: Config.pageHeight;
      const autoColumns = parseInt(pageWidth / (Config.cardWidth + Config.marginX));
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
    Config.landscape
  ]);
  return (<div className={'FormPanel'}>
    <Control label={'Width'} attrKey={'cardWidth'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Height'} attrKey={'cardHeight'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Margin X'} attrKey={'marginX'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Margin Y'} attrKey={'marginY'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Bleed'} attrKey={'bleed'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Columns/Rows'}>
      <HStack>
        <NumberInput isDisabled={Config.autoColumnsRows} width={'90px'} value={Config.columns} onChange={(s, v) => {
          dispatch(Actions.ConfigEdit({columns:v}));
        }} mr={8}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <NumberInput isDisabled={Config.autoColumnsRows} width={'90px'} value={Config.rows} onChange={(s, v) => {
          dispatch(Actions.ConfigEdit({rows:v}));
        }} mr={4}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Checkbox value={'true'} isChecked={Config.autoColumnsRows}
                  onChange={(event) => dispatch(Actions.ConfigEdit({autoColumnsRows:event.target.checked}))}
        >Auto</Checkbox>
      </HStack>
    </Control>
  </div>)
}