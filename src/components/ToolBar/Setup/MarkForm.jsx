import {
  Checkbox, HStack, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper, PinInput, PinInputField, Radio, RadioGroup,
  Input, Stack, FormLabel,
} from '@chakra-ui/react';
import React, { useContext } from 'react';
import {Control} from './Control';
import styles from './styles.module.css';
import { StoreContext } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';

export const MarkForm = () => {
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'fCutLine',
      'fCutlineColor',
      'fCutlineThinkness',
      'bCutLine',
      'bCutlineColor',
      'bCutlineThinkness'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  return (<div className={styles.FormPanel}>
    <Control label={'Front Cutting Line'}>
      <RadioGroup name={'fCutLine'} defaultValue={Config.fCutLine}>
        <HStack>
          <Radio value={'0'}>None</Radio>
          <Radio value={'1'}>Normal</Radio>
          <Radio value={'2'}>Cross</Radio>
          <Radio value={'3'}>Complete</Radio>
        </HStack>
      </RadioGroup>
    </Control>
    <Control label={'Color'}>
      <HStack>
        <Input name={'fCutlineColor'} width={'80px'} type={'color'} defaultValue={Config.fCutlineColor} />
        <FormLabel textAlign={'right'} className={styles.FormLabel}>Thinckness</FormLabel>
        <NumberInput width={'90px'} defaultValue={Config.fCutlineThinkness}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <span>pt</span>
      </HStack>
    </Control>
    <Control label={'Back Cutting Line'}>
      <RadioGroup name={'bCutLine'} defaultValue={Config.bCutLine}>
        <HStack>
          <Radio value={'0'}>None</Radio>
          <Radio value={'1'}>Normal</Radio>
          <Radio value={'2'}>Cross</Radio>
          <Radio value={'3'}>Complete</Radio>
        </HStack>
      </RadioGroup>
    </Control>
    <Control label={'Color'}>
      <HStack>
        <Input name={'bCutlineColor'} width={'80px'} type={'color'}  defaultValue={Config.bCutlineColor} />
        <FormLabel textAlign={'right'} className={styles.FormLabel}>Thinckness</FormLabel>
        <NumberInput name={'bCutlineThinkness'} width={'90px'} defaultValue={Config.bCutlineThinkness}>
          <NumberInputField />
          <NumberInputStepper>
            <NumberIncrementStepper />
            <NumberDecrementStepper />
          </NumberInputStepper>
        </NumberInput>
        <span>pt</span>
      </HStack>
    </Control>
  </div>)
}