import React from 'react';
import { Chip, Box } from '@mui/material';

export const ChipToggleGroup = ({ options, value, onChange, size = 'small' }) => {
  return (
    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          size={size}
          variant={value === option.value ? 'filled' : 'outlined'}
          color={value === option.value ? 'primary' : 'default'}
          onClick={() => onChange(option.value)}
          sx={{
            cursor: 'pointer',
            color: 'white',
            '&:hover': {
              backgroundColor: value === option.value
                ? undefined
                : 'action.hover',
            },
          }}
        />
      ))}
    </Box>
  );
};
