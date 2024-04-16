import {
  Checkbox, HStack, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper, PinInput, PinInputField, Radio, RadioGroup,
  Select, Stack,
} from '@chakra-ui/react';
import React, { useContext, useEffect, useState } from 'react';
import {Control} from './Control';
import styles from './styles.module.css';
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
      dispatch(Actions.EditConfig({ columns: autoColumns, rows: autoRows }));
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
  return (<div className={styles.FormPanel}>
    <Control label={'Width'}>
      <NumberInput value={Config.cardWidth} onChange={(s, v) => {
        dispatch(Actions.EditConfig({cardWidth: v}))
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Height'}>
      <NumberInput value={Config.cardHeight} onChange={(s, v) => {
        dispatch(Actions.EditConfig({cardHeight: v}))
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Margin X'}>
      <NumberInput name={'marginX'} value={Config.marginX} onChange={(s, v) => {
        dispatch(Actions.EditConfig({marginX: v}))
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Margin Y'}>
      <NumberInput name={'marginY'} value={Config.marginY} onChange={(s, v) => {
        dispatch(Actions.EditConfig({marginY: v}))
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Bleed'}>
      <NumberInput value={Config.bleed} onChange={(s, v) => {
        dispatch(Actions.EditConfig({bleed: v}))
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Columns/Rows'}>
      <HStack>
        <NumberInput isDisabled={Config.autoColumnsRows} name={'columns'} width={'90px'} value={Config.columns} onChange={(s, v) => {
          dispatch(Actions.EditConfig({columns:v}));
        }} mr={8}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <NumberInput isDisabled={Config.autoColumnsRows} name={'rows'} width={'90px'} value={Config.rows} onChange={(s, v) => {
          dispatch(Actions.EditConfig({rows:v}));
        }} mr={4}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Checkbox name={'autoColumnsRows'} value={'true'} isChecked={Config.autoColumnsRows}
                  onChange={(event) => dispatch(Actions.EditConfig({autoColumnsRows:event.target.checked}))}
        >Auto</Checkbox>
      </HStack>
    </Control>
  </div>)
}