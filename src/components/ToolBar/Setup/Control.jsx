import { FormControl, FormLabel } from '@chakra-ui/react';
import React from 'react';
import styles from './styles.module.css'
export const Control = (({ children, label }) =>
  (<FormControl className={styles.FormControl}>
    <FormLabel textAlign={'right'} className={styles.FormLabel}>{label}</FormLabel>
    {children}
  </FormControl>));