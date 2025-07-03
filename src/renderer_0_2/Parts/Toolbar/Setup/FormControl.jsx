import React from 'react';
import { useStore } from '../../../State/store';
import { Checkbox, FormControlLabel, TextField } from '@mui/material';
import MenuItem from '@mui/material/MenuItem';

export const ControlType = Object.freeze({
  NumberInput: 'NumberInput',
  Select: 'Select',
  Checkbox: 'Checkbox',
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
                               step,max,min,decimal,
                               ...restProps
                             }) => {
  const { selectors, mergeConfig } = useStore();
  const fieldValue = selectors.Config[attrKey]();
  return (<div className={'FormControl'}>
    {type === ControlType.Checkbox &&
      <FormControlLabel label={label} control={
        <Checkbox disabled={disabled} defaultChecked={fieldValue}
                  onChange={onChange || (e => mergeConfig({ [attrKey]: e.target.checked }))} />}
      />}
    {type === ControlType.NumberInput &&
      <TextField sx={{ width }} label={label} type='number' size='small' disabled={disabled}
                slotProps={{
                    inputLabel: {
                      shrink: true,
                    },
                    htmlInput: {
                      step: step ?? decimal ? 0.1 : 1,
                      min: min ?? 0,
                      max: max ?? 9999,
                      ...restProps.inputProps
                    }
                 }}
                 {...restProps}
                 onChange={onChange || (e => {
                   console.log(fieldValue, e.nativeEvent.inputType, e)

                   mergeConfig({ [attrKey]: e.target.value })
                 })}
                 defaultValue={fieldValue} />}
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
        defaultValue={fieldValue}
      >
        {items.map(item => (<MenuItem value={item.value}>{item.label}
        </MenuItem>))}
      </TextField>}
    {children}
  </div>);
});