import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';
import { HStack, Progress } from '@chakra-ui/react';
import { useTranslation } from "react-i18next";

export const Footer = () => {
  const { t } = useTranslation();
  const {fileLength, cardLength, progress, isInProgress} = useSelector((state) => ({
    fileLength: state.pnp.CardList.length,
    cardLength: _.sum(state.pnp.CardList.map(c => c.repeat || 1)),
    isInProgress: state.pnp.Global.isInProgress,
    progress: state.pnp.Global.progress,
  }), shallowEqual);
  return <HStack alignItems={'baseline'}>
    <span style={{whiteSpace: 'nowrap'}} width={'230px'}>{t('footer.files')} {fileLength} / {t('footer.images')} {cardLength}</span>
  </HStack>
}