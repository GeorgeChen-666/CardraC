import {
  Box,
  Modal, ModalBody,
  ModalContent,
  ModalOverlay, Spinner,
} from '@chakra-ui/react';
import React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';

export const LoadingModal = () => {
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isLoading',
      'loadingText'
    ])
  ), shallowEqual);
  return (
    <Modal onClose={_.noop} isOpen={Global.isLoading} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalBody>
          <Box display={'flex'}>
            <Spinner speed='1s' />{Global.loadingText}
          </Box>
        </ModalBody>
      </ModalContent>
    </Modal>
  )
}