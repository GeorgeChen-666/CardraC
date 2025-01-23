import {
  Box, CircularProgress, CircularProgressLabel,
  Modal, ModalBody,
  ModalContent,
  ModalOverlay, Spinner, Text,
} from '@chakra-ui/react';
import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';

export const LoadingModal = () => {
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isLoading',
      'isInProgress',
      'progress',
      'loadingText',
    ])
  ), shallowEqual);
  return (
    <Modal onClose={_.noop} isOpen={Global.isLoading} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalBody>
          <Box display={'flex'} alignItems={'center'}>
            {Global.isInProgress && (
              <CircularProgress value={Global.progress * 100}>
                <CircularProgressLabel>{`${parseInt(Global.progress * 100)}`}%</CircularProgressLabel>
              </CircularProgress>
            )}
            {!Global.isInProgress && (
              <Spinner speed='1s' thickness='4px'
                       emptyColor='#edebe9'
                       color='blue.500'
                       width={'44px'} height={'44px'}
              />
            )}
            <Text fontSize={'x-large'}>{Global.loadingText}</Text>
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};