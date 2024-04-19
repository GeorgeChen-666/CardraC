import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';
import { HStack, Progress } from '@chakra-ui/react';

export const Footer = () => {
  const {fileLength, cardLength, progress, isInProgress} = useSelector((state) => ({
    fileLength: state.pnp.CardList.length,
    cardLength: _.sum(state.pnp.CardList.map(c => c.repeat || 1)),
    isInProgress: state.pnp.Global.isInProgress,
    progress: state.pnp.Global.progress,
  }), shallowEqual);
  return <HStack alignItems={'baseline'}>
    <span style={{whiteSpace: 'nowrap'}} width={'230px'}>Files {fileLength} / Images {cardLength}</span>
    {isInProgress && (<Progress flexFlow={1} width={'100%'} margin={'0'} hasStripe value={progress} margin={'10px'} />)}
  </HStack>
}