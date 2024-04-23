import {
  FormControl,
  FormLabel,
  NumberDecrementStepper,
  NumberIncrementStepper, NumberInput,
  NumberInputField,
  NumberInputStepper,
} from '@chakra-ui/react';
import React from 'react';
import styles from './styles.module.css';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { Actions } from '../../../store';

export const ControlType = Object.freeze({
  NumberInput: 'NumberInput',
});

export const Control = (({ children, label, attrKey, type, onChange }) =>
{
  const dispatch = useDispatch();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [attrKey])
  ), shallowEqual);
  const [value, setValue] = React.useState(Config[attrKey])
  return (<FormControl className={styles.FormControl}>
    <FormLabel textAlign={'right'} className={styles.FormLabel}>{label}</FormLabel>
    {
      (()=>{
        if(type === ControlType.NumberInput) {
          return ((<NumberInput value={value}
                                onChange={(valueString) => setValue(valueString)}
                                onBlur={(e) => {
            const value = e.target.value;
            if(onChange) {
              onChange(value)
            } else {
              dispatch(Actions.EditConfig({[attrKey]: value}))
            }
          }} mr={3}>
            <NumberInputField />
            <NumberInputStepper>
              <NumberIncrementStepper />
              <NumberDecrementStepper />
            </NumberInputStepper>
          </NumberInput>))
        }
      })()
    }
    {children}
  </FormControl>)
});