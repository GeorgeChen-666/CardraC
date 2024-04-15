import {
  Checkbox, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField, Input,
  NumberInputStepper, Radio, RadioGroup, FormLabel,
  Select, Stack, Link,
} from '@chakra-ui/react';
import React, { useContext, useRef, useState } from 'react';
import { Control } from './Control';
import styles from './styles.module.css';
import { Actions, StoreContext } from '../../../store';

export const LayoutForm = ({editConfig}) => {
  const { state } = useContext(StoreContext);
  const { Config } = state;

  return (<div className={styles.FormPanel}>
    <Control label={'Size'}>
      <Select name={'pageSize'} value={Config.pageSize} width={'120px'} mr={3} onChange={(event) => {
        const pageSize = event.target.value;
        if (pageSize) {
          const [width, height] = event.target.value.replace(/A\d:/, '').split(',');
          editConfig({pageSize,pageWidth:parseInt(width), pageHeight:parseInt(height)});
        }
      }}>
        <option value={''}>Custom</option>
        <option value={'A5:148,210'}>A5</option>
        <option value={'A4:210,297'}>A4</option>
        <option value={'A3:297,420'}>A3</option>
        <option value={'A2:420,594'}>A2</option>
        <option value={'A1:594,841'}>A1</option>
      </Select>
      <Checkbox name={'landscape'} value={'true'} isChecked={Config.landscape}
                onChange={(event) => editConfig({landscape:event.target.checked})}
      >Landscape</Checkbox>
    </Control>
    <Control label={'Page Width'}>
      <NumberInput name={'pageWidth'} value={Config.pageWidth} onChange={(s, v) => {
        editConfig({pageWidth: v, pageSize: ''})
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Page Height'}>
      <NumberInput name={'pageHeight'} value={Config.pageHeight} onChange={(s, v) => {
        editConfig({pageHeight: v, pageSize: ''})
      }} mr={3}>
        <NumberInputField />
        <NumberInputStepper>
          <NumberIncrementStepper />
          <NumberDecrementStepper />
        </NumberInputStepper>
      </NumberInput>
      mm
    </Control>
    <Control label={'Side'}>
      <RadioGroup name={'sides'} value={Config.sides} onChange={(v)=>editConfig({sides:v})}>
        <Stack direction='row'>
          <Radio value='one side'>One side</Radio>
          <Radio value='double sides'>Double sides</Radio>
        </Stack>
      </RadioGroup>
    </Control>
    {Config.sides === 'double sides' && (<Control label={'Flip'}>
      {Config.configFlip && <Select name={'flip'} value={Config.flip} width={'230px'} onChange={(event) => {
        const flip = event.target.value || '';
        editConfig({ flip, configFlip: (flip !== '')})
      }}>
        <option value={''}>Auto</option>
        <option value={'none'}>None</option>
        <option value={'long-edge binding'}>Long-edge binding</option>
        <option value={'short-edge binding'}>Short-edge binding</option>
      </Select>}
      {!Config.configFlip && (<Stack direction='row' alignItems={'center'}>
        <Input width={'230px'} isDisabled value={Config.landscape ? 'Long-edge binding' : 'Short-edge binding'} />
        <Link color={'blue'} onClick={() => {
          editConfig({ flip: Config.landscape ? 'long-edge binding' : 'short-edge binding', configFlip:true});
        }}>edit</Link>
      </Stack>)}
    </Control>)}
  </div>);
};