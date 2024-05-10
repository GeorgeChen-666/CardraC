import React, { forwardRef,  useImperativeHandle } from 'react';
import {
  Tabs, TabList, TabPanels, Tab, TabPanel,
  Modal,
  Button,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
} from '@chakra-ui/react';
import { LayoutForm } from './LayoutForm';
import { CardForm } from './CardForm';
import { MarkForm } from './MarkForm';
import { ConfigOverview } from './ConfigOverview';

export const SetupDialog = forwardRef(({}, ref) => {
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
          {/* <ConfigOverview /> */}
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