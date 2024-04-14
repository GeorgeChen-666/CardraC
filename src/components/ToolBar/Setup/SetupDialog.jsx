import React, { forwardRef, useContext, useImperativeHandle } from 'react';
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

export const SetupDialog = forwardRef(({}, ref) => {
  const { dispatch } = useContext(StoreContext);
  const { isOpen, onOpen, onClose } = useDisclosure();
  useImperativeHandle(ref, () => ({
    openDialog: onOpen,
  }));

  return (<div>
    <Modal isOpen={isOpen} onClose={onClose} size={'5xl'} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader padding={4}>Setup</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <ConfigOverview />
          <form id={'formConfigDialog'}>
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
          </form>

        </ModalBody>

        <ModalFooter>
          <Button colorScheme='blue' mr={3} onClick={() => {
            const objData = {};
            new FormData(document.getElementById('formConfigDialog'))
              .forEach((value, key) => objData[key] = value);
            dispatch({ type: Actions.EditConfig, payload: {...objData} });
            onClose();
          }}>
            Save
          </Button>
          <Button variant='ghost' onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </div>);
});