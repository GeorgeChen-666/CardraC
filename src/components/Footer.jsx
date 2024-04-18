import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';
import { Container, HStack, Progress } from '@chakra-ui/react';

export const Footer = () => {
  const {fileLength, cardLength} = useSelector((state) => ({
    fileLength: state.pnp.CardList.length,
    cardLength: _.sum(state.pnp.CardList.map(c => c.repeat || 1)),
  }), shallowEqual);
  return <HStack>
    <span width={'200px'}>Files {fileLength} / Images {cardLength}</span>
    <Progress flexFlow={1} width={'90%'} hasStripe value={64} />
  </HStack>
}