import {
  Checkbox, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper, Radio, RadioGroup,
  Select, Stack,
} from '@chakra-ui/react';
import React, { useContext } from 'react';
import {Control} from './Control';
import styles from './styles.module.css'
import { StoreContext } from '../../../store';

export const LayoutForm = () => {
  const { state } = useContext(StoreContext);
  const {Config} = state;
  return (<div className={styles.FormPanel}>
    <Control label={'Size'}>
      <Select name={'pageSize'} defaultValue={Config.pageSize} width={'100px'} mr={3}>
        <option>A4</option>
        <option>A5</option>
        <option>A3</option>
        <option>A2</option>
        <option>A1</option>
      </Select>
      <Checkbox name={'landscape'} value={'true'} defaultChecked={Config.landscape}>Landscape</Checkbox>
    </Control>
    <Control label={'Width'}>
      <NumberInput name={'pageWidth'} defaultValue={Config.pageWidth} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Height'}>
      <NumberInput name={'pageHeight'} defaultValue={Config.pageHeight} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Side'}>
      <RadioGroup name={'sides'} defaultValue={Config.sides}>
        <Stack direction='row'>
          <Radio value='1'>One side</Radio>
          <Radio value='2'>Double sides</Radio>
        </Stack>
      </RadioGroup>
    </Control>
  </div>)
}