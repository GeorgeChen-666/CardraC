import React, { useEffect, useState } from 'react';
import { useStore } from '../../../State/store';
import { Checkbox, FormControlLabel, TextField } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';
import MuiFormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { NumberInput } from '../../../Componments/NumberInput';

export const ControlType = Object.freeze({
  NumberInput: 'NumberInput',
  Select: 'Select',
  Checkbox: 'Checkbox',
  RadioGroup: 'RadioGroup',
  ColorPicker: 'ColorPicker',
});

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

  return (<div className={'FormControl'}>
    {type === ControlType.ColorPicker &&
      <TextField sx={{ width }} label={label} type='color' size='small' disabled={disabled} value={fieldValue}
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
      <NumberInput value={fieldValue} min={min} max={max}
                   step={step ?? ((fieldValue % 1 > 0) ? 0.1 : 1)}
                   width={width} label={label} disabled={disabled}
                   onChange={onChange || ((e, v) => mergeConfig({ [attrKey]: v }))}
                   {...restProps}
      />}
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