import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter, Text,
  AlertDialogOverlay, Button, useDisclosure,
} from '@chakra-ui/react';
import { version } from '../../../functions';

export const AboutDialog = forwardRef(({},ref) => {
  const { isOpen, onOpen, onClose } = useDisclosure()
  const cancelRef = React.useRef()
  useImperativeHandle(ref, () => ({
    openDialog: onOpen,
  }));
  const [v, setV] = useState('')
  useEffect(() => {
    (async()=> {
      setV(await version());
    })()
  }, []);
  return (<AlertDialog
    motionPreset='slideInBottom'
    leastDestructiveRef={cancelRef}
    onClose={onClose}
    isOpen={isOpen}
    isCentered
  >
    <AlertDialogOverlay />
    <AlertDialogContent>
      <AlertDialogBody>
        <Text fontSize={'3xl'} textAlign={'center'}>Cardra</Text>
        <hr />
        <p>Version: {v}</p>
        <p>Author: GeorgeChen</p>
      </AlertDialogBody>
      <AlertDialogFooter>
        <Button ref={cancelRef} onClick={onClose}>
          OK
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>);
})