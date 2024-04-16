import React, { forwardRef, useContext, useImperativeHandle, useState } from 'react';
import {
  Tabs, TabList, TabPanels, Tab, TabPanel, FormControl, FormLabel,
  Select, Checkbox, NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Modal,
  Button,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,Stack, Radio, HStack, PinInput, PinInputField,
  ModalCloseButton,
  RadioGroup,
  useDisclosure,
} from '@chakra-ui/react';
import { LayoutForm } from './LayoutForm';
import { CardForm } from './CardForm';
import { MarkForm } from './MarkForm';
import { StoreContext, Actions } from '../../../store';
import { ConfigOverview } from './ConfigOverview';
import { useDispatch } from 'react-redux';

export const SetupDialog = forwardRef(({}, ref) => {
  const dispatch = useDispatch();
  const { isOpen, onOpen, onClose } = useDisclosure();
  useImperativeHandle(ref, () => ({
    openDialog: onOpen,
  }));
  const editConfig = (payload) => {
    dispatch(Actions.EditConfig(payload))
    // dispatch({type: Actions.EditConfig, payload})
  }
  return (<div>
    <Modal isOpen={isOpen} onClose={onClose} size={'5xl'} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader padding={4}>Setup</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {/*<ConfigOverview />*/}
          <Tabs orientation={'vertical'} height={400}>
            <TabList>
              <Tab alignSelf={'end'}>Layout</Tab>
              <Tab alignSelf={'end'}>Card</Tab>
              <Tab alignSelf={'end'}>Mark</Tab>
            </TabList>

            <TabPanels>
              <TabPanel>
                <LayoutForm />
              </TabPanel>
              <TabPanel>
                <CardForm />
              </TabPanel>
              <TabPanel>
                <MarkForm />
              </TabPanel>
            </TabPanels>
          </Tabs>

        </ModalBody>

        <ModalFooter>
          <Button variant='ghost' onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </div>);
});