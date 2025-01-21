import React, { forwardRef,  useImperativeHandle } from 'react';
import {
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Modal,
  Button,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Editable,
  EditablePreview,
  EditableInput,
  Menu,
  MenuButton,
  IconButton,
  MenuList,
  MenuItem,
  Text, Flex, useEditableControls, ButtonGroup,
} from '@chakra-ui/react';
import { LayoutForm } from './LayoutForm';
import { CardForm } from './CardForm';
import { MarkForm } from './MarkForm';
import { ConfigOverview } from './ConfigOverview';
import { useTranslation } from 'react-i18next';
import { AiFillCaretDown, AiFillDelete } from 'react-icons/ai';
import { CheckIcon, CloseIcon, EditIcon } from '@chakra-ui/icons';


export const SetupDialog = forwardRef(({}, ref) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  useImperativeHandle(ref, () => ({
    openDialog: onOpen,
  }));

  function EditableControls() {
    const {
      isEditing,
      getSubmitButtonProps,
      getCancelButtonProps,
      getEditButtonProps,
    } = useEditableControls()

    return <ButtonGroup justifyContent='center' marginLeft={'10px'} verticalAlign={'bottom'} size='sm'>
      {isEditing ? (
        <>
          <IconButton icon={<CheckIcon />} {...getSubmitButtonProps()} />
          <IconButton icon={<CloseIcon />} {...getCancelButtonProps()} />
        </>
      ) : (
        <IconButton icon={<EditIcon />} {...getEditButtonProps()} />
      )}
    </ButtonGroup>
  }

  return (<div>
    <Modal closeOnOverlayClick={false} isOpen={isOpen} onClose={onClose} size={'5xl'} isCentered>
      <ModalOverlay />
      <ModalContent minWidth={'870px'}>
        <ModalHeader padding={4}>
          {t('configDialog.setup')}:
          <Editable display={'inline-block'} marginLeft={'10px'} defaultValue='Take some chakra'>
          <Menu size={'sm'}>
            <MenuButton
              as={Button} size={'sm'}
              rightIcon={<AiFillCaretDown />}>

                <EditablePreview width={'200px'} />
                <EditableInput width={'200px'} />

            </MenuButton>
            <MenuList>
              <MenuItem as={Flex} justifyContent={'space-between'}>
                <Text fontSize='sm'>(lg) In love with React & Next</Text>
                <IconButton
                  isRound={true}
                  variant='solid'
                  fontSize='20px'
                  size='xs'
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  icon={<AiFillDelete />}
                />
              </MenuItem>
            </MenuList>
          </Menu>
            <EditableControls />
          </Editable>
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
          <Button variant='ghost' onClick={onClose}>Close</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  </div>);
});