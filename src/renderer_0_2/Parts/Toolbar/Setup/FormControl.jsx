import React, { useEffect, useState } from 'react';
import { useStore } from '../../../State/store';
import { Checkbox, FormControlLabel, TextField } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import MuiFormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';

export const ControlType = Object.freeze({
  NumberInput: 'NumberInput',
  Select: 'Select',
  Checkbox: 'Checkbox',
  RadioGroup: 'RadioGroup',
  ColorPicker: 'ColorPicker',
});

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

export const FormControl = (({
                               children,
                               label,
                               attrKey,
                               type,
                               width = '100%',
                               onChange,
                               style = {},
                               disabled = false,
                               items = [],
                               step, max = 9999, min = -9999,
                               ...restProps
                             }) => {
  const { selectors, mergeConfig } = useStore();
  const fieldValue = selectors.Config[attrKey]();
  const [localValue, setLocalValue] = useState(fieldValue);
  useEffect(() => {
    setLocalValue(fieldValue);
  }, [fieldValue]);
  return (<div className={'FormControl'}>
    {type === ControlType.ColorPicker &&
      <TextField sx={{ width }} label={label} type='color' size='small' disabled={disabled} value={localValue}
        onChange={onChange || (e => mergeConfig({ [attrKey]: e.target.value }))}
      />}
    {type === ControlType.RadioGroup && <MuiFormControl>
      <FormLabel sx={{ fontSize: '12px', color:'#fff' }}>{label}</FormLabel>
      <RadioGroup
        row
        value={fieldValue}
        onChange={onChange || (e => mergeConfig({ [attrKey]: e.target.value }))}
      >
        {items.map(item => (<FormControlLabel value={item.value} control={<Radio />} label={item.label} />))}
      </RadioGroup>
    </MuiFormControl>}
    {type === ControlType.Checkbox &&
      <FormControlLabel label={label} control={
        <Checkbox disabled={disabled} checked={fieldValue}
                  onChange={onChange || (e => mergeConfig({ [attrKey]: e.target.checked }))} />}
      />}
    {type === ControlType.NumberInput &&
      <TextField sx={{ width }} label={label} type='number' size='small' disabled={disabled}
                 slotProps={{
                   inputLabel: {
                     shrink: true,
                   },
                   htmlInput: {
                     step: step ?? ((fieldValue % 1 > 0) ? 0.1 : 1),
                     min,
                     max,
                     ...restProps.inputProps,
                   },
                 }}
                 {...restProps}
                 onBlur={e => {
                   const fixedNumber = getNumber(e.target.value, fieldValue, min, max);
                   if(fixedNumber !== fieldValue) {
                     e.target.value = fixedNumber;
                     mergeConfig({ [attrKey]: fixedNumber });
                   }
                 }}
                 onChange={onChange || (e => {
                   // console.log(fieldValue, e.nativeEvent.inputType, e.target.value);
                   setLocalValue(e.target.value)
                   if(!e.nativeEvent.inputType) { // up and down
                     const fixedNumber = getNumber(e.target.value, fieldValue, min, max);
                     if(fixedNumber !== fieldValue) {
                       e.target.value = fixedNumber;
                       mergeConfig({ [attrKey]: fixedNumber });
                     }
                   }
                 })}
                 value={localValue} />}
    {type === ControlType.Select &&
      <TextField
        disabled={disabled}
        slotProps={{
          inputLabel: {
            shrink: true,
          },
        }}
        sx={{ width }} label={label} select size='small'
        onChange={onChange || (e => mergeConfig({ [attrKey]: e.target.value }))}
        {...restProps}
        value={fieldValue}
      >
        {items.map(item => (<MenuItem value={item.value}>{item.label}</MenuItem>))}
      </TextField>}
    {children}
  </div>);
});