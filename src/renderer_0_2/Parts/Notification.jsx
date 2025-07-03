import React from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@chakra-ui/react';
import { i18nInstance } from '../i18n';

let notificationList = [];
export let triggerNotification = (args) => {
  notificationList.push(args);
};
export const getNotificationTrigger = () => triggerNotification
export const regNotification = (cb) => {
  triggerNotification = cb;
  if(notificationList.length > 0) {
    notificationList.forEach(arg => {
      cb(arg);
    });
    notificationList = [];
  }
}

export const notificationSuccess = () => triggerNotification({
  description: i18nInstance.t('util.success'),
  status: 'success',
  duration: 9000,
  isClosable: true,
});

export const Notification = () => {
  const { t } = useTranslation();
  const toast = useToast();
  regNotification(({msgKey, ...rest}) => toast({
    description: msgKey ? t(msgKey) : '',
    status: 'success',
    duration: 9000,
    isClosable: true,
    ...rest
  }));
  return <></>
}

