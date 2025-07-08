import React from 'react';
import { useTranslation } from 'react-i18next';
import { SnackbarProvider, useSnackbar } from 'notistack';
import { i18nInstance } from '../i18n';

let notificationList = [];
export let triggerNotification = (args) => {
  notificationList.push(args);
};

export const getNotificationTrigger = () => triggerNotification

window.triggerNotification = getNotificationTrigger;
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
  const { enqueueSnackbar } = useSnackbar();
  window.enqueueSnackbar = enqueueSnackbar;
  regNotification(({msgKey, ...rest}) => enqueueSnackbar((msgKey ? t(msgKey) : ''),{
    variant: 'success',
    anchorOrigin: { horizontal: 'center', vertical: 'bottom' },
    autoHideDuration: 3000,
    // isClosable: true,
    ...rest
  }));
  return <></>
}

