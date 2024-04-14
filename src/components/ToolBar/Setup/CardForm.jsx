import {
  Checkbox, HStack, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper, PinInput, PinInputField, Radio, RadioGroup,
  Select, Stack,
} from '@chakra-ui/react';
import React, { useContext } from 'react';
import {Control} from './Control';
import styles from './styles.module.css';
import { StoreContext } from '../../../store';

export const CardForm = () => {
  const { state } = useContext(StoreContext);
  const {Config} = state;
  return (<div className={styles.FormPanel}>
    <Control label={'Width'}>
      <NumberInput name={'cardWidth'} defaultValue={Config.cardWidth} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Height'}>
      <NumberInput name={'cardHeight'} defaultValue={Config.cardHeight} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Margin X'}>
      <NumberInput name={'marginX'} defaultValue={Config.marginX} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Margin Y'}>
      <NumberInput name={'marginY'} defaultValue={Config.marginY} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Bleed'}>
      <NumberInput defaultValue={Config.bleed} mr={3}>
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
        <NumberInput name={'columns'} width={'90px'} defaultValue={Config.columns} mr={8}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <NumberInput name={'rows'} width={'90px'} defaultValue={Config.rows} mr={4}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <Checkbox name={'autoColumnsRows'} defaultChecked={Config.autoColumnsRows}>Auto</Checkbox>
      </HStack>
    </Control>
  </div>)
}