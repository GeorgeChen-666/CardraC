import {
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
import { Actions } from '../../../store';

export const ControlType = Object.freeze({
  NumberInput: 'NumberInput',
});

export const Control = (({ children, label, attrKey, type, onChange }) => {
  const dispatch = useDispatch();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [attrKey])
  ), shallowEqual);
  const [value, setValue] = React.useState('');
  useEffect(() => setValue(Config[attrKey]), [Config[attrKey]]);
  return (<FormControl className={'FormControl'}>
    <FormLabel textAlign={'right'} className={'FormLabel'}>{label}</FormLabel>
    {
      (() => {
        if (type === ControlType.NumberInput) {
          return (
            <NumberInput
              value={value}
              onChange={(valueString) =>
                (valueString === '' || valueString === '-') ? setValue(valueString) : setValue(valueString * 1)
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
      })()
    }
    {children}
  </FormControl>);
});