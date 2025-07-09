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
  msgKey: 'util.success',
  variant: 'success',
  autoHideDuration: 3000,
});
export const notificationFailed = () => triggerNotification({
  msgKey: 'util.operationFailed',
  variant: 'error',
  autoHideDuration: 3000,
});

export const Notification = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  window.enqueueSnackbar = enqueueSnackbar;
  regNotification(({msgKey, variant, ...rest}) => enqueueSnackbar((msgKey ? t(msgKey) : ''),{
    variant,
    anchorOrigin: { horizontal: 'center', vertical: 'bottom' },
    autoHideDuration: 3000,
    ...rest
  }));
  return <></>
}

