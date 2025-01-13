import {
  Checkbox,
  FormControl,
  FormLabel,
  NumberDecrementStepper,
  NumberIncrementStepper, NumberInput,
  NumberInputField,
  NumberInputStepper,
} from '@chakra-ui/react';
import React, { useEffect } from 'react';
import './styles.css';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { Actions } from '/src/renderer/store';

export const ControlType = Object.freeze({
  NumberInput: 'NumberInput',
  Checkbox: 'Checkbox'
});

export const Control = (({ children, label, attrKey, type, onChange, style, disabled = false }) => {
  const dispatch = useDispatch();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [attrKey])
  ), shallowEqual);
  const [value, setValue] = React.useState('');
  useEffect(() => setValue(Config[attrKey]), [Config[attrKey]]);
  return (<FormControl className={'FormControl'}>
    <FormLabel
      textAlign={'right'}
      className={'FormLabel'}
      style={{ marginRight: label ? '12px' : '0' }}
    >{label || ''}</FormLabel>
    {
      (() => {
        if (type === ControlType.NumberInput) {
          return (
            <NumberInput
              isDisabled={disabled}
              style={style}
              value={value}
              onChange={(valueString, numberValue) =>
                setValue(valueString)
              }
              onBlur={(e) => {
                const value = e.target.value * 1 || 0;
                if (onChange) {
                  onChange(value);
                } else {
                  dispatch(Actions.ConfigEdit({ [attrKey]: value }));
                }
              }} mr={3}>
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          );
        }
        else if (type === ControlType.Checkbox) {
          return (<Checkbox defaultChecked>Checkbox</Checkbox>)
        }
      })()
    }
    {children}
  </FormControl>);
});