import { TextField } from '@mui/material';
import React, { useEffect, useState } from 'react';

const getNumber = (value, defaultValue, min, max) => {
  if(isNaN(value)) {
    return defaultValue;
  }
  const newValue = parseFloat(value);
  if(newValue<min) {
    return min;
  }
  if(newValue > max) {
    return max;
  }
  if(newValue === -0) {
    return 0;
  }
  return newValue;
}

export const NumberInput = (props) => {
  const {value, step, min, max, onChange, disabled, width='100%', label='', ...restProps} = props;
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => {
    setLocalValue(value);
  }, [value]);
  return <TextField sx={{ width }} label={label} type='number' size='small' disabled={disabled}
                    slotProps={{
                      inputLabel: {
                        shrink: true,
                      },
                      htmlInput: {
                        step: step ?? ((value % 1 > 0) ? 0.1 : 1),
                        min,
                        max,
                        ...restProps.inputProps,
                      },
                    }}
                    {...restProps}
                    onBlur={e => {
                      const fixedNumber = getNumber(e.target.value, value, min, max);
                      if(fixedNumber !== value) {
                        e.target.value = fixedNumber;
                        onChange(e, fixedNumber);
                        // mergeConfig({ [attrKey]: fixedNumber });
                      }
                    }}
                    onChange={(e => {
                      setLocalValue(e.target.value)
                      if(!e.nativeEvent.inputType) { // up and down
                        const fixedNumber = getNumber(e.target.value, value, min, max);
                        if(fixedNumber !== value) {
                          e.target.value = fixedNumber;
                          onChange(e, fixedNumber);
                          // mergeConfig({ [attrKey]: fixedNumber });
                        }
                      }
                    })}
                    value={localValue} />
}