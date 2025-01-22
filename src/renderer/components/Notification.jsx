import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@chakra-ui/react';
import { regNotification } from '../functions';

export const Notification = () => {
  const { t } = useTranslation();
  const toast = useToast();
  regNotification(({msgKey, ...rest}) => {
    toast({
      description: msgKey ? t(msgKey) : '',
      status: 'success',
      duration: 9000,
      isClosable: true,
      ...rest
    })
  });
  return <></>
}