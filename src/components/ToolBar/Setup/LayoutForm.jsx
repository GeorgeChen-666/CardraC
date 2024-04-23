import {
  Checkbox, NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField, Input,
  NumberInputStepper, Radio, RadioGroup,
  Select, Stack, Link,
} from '@chakra-ui/react';
import React from 'react';
import { Control, ControlType } from './Control';
import styles from './styles.module.css';
import _ from 'lodash';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

export const LayoutForm = () => {
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'pageSize',
      'landscape',
      'pageWidth',
      'pageHeight',
      'sides',
      'globalBackground',
      'autoConfigFlip',
      'flip'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();

  return (<div className={styles.FormPanel}>
    <Control label={'Size'}>
      <Select value={Config.pageSize} width={'120px'} mr={3} onChange={(event) => {
        const pageSize = event.target.value;
        if (pageSize) {
          const [width, height] = event.target.value.replace(/A\d:/, '').split(',');
          dispatch(Actions.EditConfig({ pageSize, pageWidth: parseInt(width), pageHeight: parseInt(height) }));
        }
      }}>
        <option value={''}>Custom</option>
        <option value={'A5:148,210'}>A5</option>
        <option value={'A4:210,297'}>A4</option>
        <option value={'A3:297,420'}>A3</option>
        <option value={'A2:420,594'}>A2</option>
        <option value={'A1:594,841'}>A1</option>
      </Select>
      <Checkbox value={'true'} isChecked={Config.landscape}
                onChange={(event) => dispatch(Actions.EditConfig({ landscape: event.target.checked }))}
      >Landscape</Checkbox>
    </Control>
    <Control label={'Page Width'} attrKey={'pageWidth'} type={ControlType.NumberInput} onChange={(value) =>
      dispatch(Actions.EditConfig({ pageWidth: value, pageSize: '' }))
    }>
      mm
    </Control>
    <Control label={'Page Height'} attrKey={'pageHeight'} type={ControlType.NumberInput} onChange={(value) =>
      dispatch(Actions.EditConfig({ pageHeight: value, pageSize: '' }))
    }>
      mm
    </Control>
    <Control label={'Scale'} attrKey={'scale'} type={ControlType.NumberInput}>
      %
    </Control>
    <Control label={'Offset X'} attrKey={'offsetX'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Offset Y'} attrKey={'offsetY'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={'Side'}>
      <RadioGroup value={Config.sides} onChange={(v) => dispatch(Actions.EditConfig({ sides: v }))}>
        <Stack direction='row'>
          <Radio value='one side'>One side</Radio>
          <Radio value='double sides'>Double sides</Radio>
        </Stack>
      </RadioGroup>
    </Control>
    {Config.sides === 'double sides' && (<Control label={'Flip'}>
      {!Config.autoConfigFlip && <Select value={Config.flip} width={'230px'} onChange={(event) => {
        const flip = event.target.value || '';
        dispatch(Actions.EditConfig({ flip, autoConfigFlip: (flip === '') }));
      }}>
        <option value={''}>Auto</option>
        <option value={'none'}>None</option>
        <option value={'long-edge binding'}>Long-edge binding</option>
        <option value={'short-edge binding'}>Short-edge binding</option>
      </Select>}
      {Config.autoConfigFlip && (<Stack direction='row' alignItems={'center'}>
        <Input width={'230px'} isDisabled value={Config.landscape ? 'Long-edge binding' : 'Short-edge binding'} />
        <Link color={'blue'} onClick={() => {
          dispatch(Actions.EditConfig({ flip: Config.landscape ? 'long-edge binding' : 'short-edge binding', autoConfigFlip: false }));
        }}>edit</Link>
      </Stack>)}
    </Control>)}
  </div>);
};