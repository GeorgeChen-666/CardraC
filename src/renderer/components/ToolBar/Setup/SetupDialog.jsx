import React, { forwardRef, useImperativeHandle } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useDisclosure,
} from '@chakra-ui/react';
import { LayoutForm } from './LayoutForm';
import { CardForm } from './CardForm';
import { MarkForm } from './MarkForm';
import { ConfigOverview } from './ConfigOverview';
import { useTranslation } from 'react-i18next';
import { TemplateMenu } from './TemplateMenu';


export const SetupDialog = forwardRef(({}, ref) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  useImperativeHandle(ref, () => ({
    openDialog: onOpen,
  }));



  return (<div>
    <Modal closeOnOverlayClick={false} isOpen={isOpen} onClose={onClose} size={'5xl'} isCentered>
      <ModalOverlay />
      <ModalContent minWidth={'870px'}>
        <ModalHeader padding={4}>
          {t('configDialog.setup')}:
          <TemplateMenu />
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
           <ConfigOverview />
          <Tabs orientation={'vertical'} height={400}>
            <TabList>
              <Tab alignSelf={'end'}>{t('configDialog.layout')}</Tab>
              <Tab alignSelf={'end'}>{t('configDialog.card')}</Tab>
              <Tab alignSelf={'end'}>{t('configDialog.mark')}</Tab>
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
          <Button variant='ghost' onClick={onClose}>{t('button.close')}</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </div>);
});