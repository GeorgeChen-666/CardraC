import {
  HStack, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper, Radio, RadioGroup,
  Input, FormLabel,
} from '@chakra-ui/react';
import React from 'react';
import {Control} from './Control';
import './styles.css';
import { Actions } from '../../../store';
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
  return (<div className={'FormPanel'}>
    <Control label={'Front Cutting Line'}>
      <RadioGroup defaultValue={Config.fCutLine}
                  onChange={(value) => dispatch(Actions.ConfigEdit({fCutLine:value}))}>
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
        <Input name={'fCutlineColor'} width={'80px'} type={'color'} defaultValue={Config.fCutlineColor}
               onChange={(value) => dispatch(Actions.ConfigEdit({fCutlineColor:value}))} />
        <FormLabel textAlign={'right'} className={'FormPanel'}>Thinckness</FormLabel>
        <NumberInput width={'90px'} defaultValue={Config.fCutlineThinkness}
                     onChange={($, value) => dispatch(Actions.ConfigEdit({fCutlineThinkness:value}))}>
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
      <RadioGroup defaultValue={Config.bCutLine}
                  onChange={(value) => dispatch(Actions.ConfigEdit({bCutLine:value}))}>
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
        <Input width={'80px'} type={'color'}  defaultValue={Config.bCutlineColor}
               onChange={(value) => dispatch(Actions.ConfigEdit({bCutlineColor:value}))}/>
        <FormLabel textAlign={'right'} className={'FormPanel'}>Thinckness</FormLabel>
        <NumberInput width={'90px'} defaultValue={Config.bCutlineThinkness}
                     onChange={($, value) => dispatch(Actions.ConfigEdit({bCutlineThinkness:value}))}>
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