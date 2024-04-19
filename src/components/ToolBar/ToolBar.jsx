import React, { useRef, useState } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import { AiFillFolderOpen, AiFillFileAdd, AiFillSetting, AiFillSave } from 'react-icons/ai';
import {
  Tooltip,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  FormControl,
  FormLabel,
  Switch,
  Image,
  Button,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
} from '@chakra-ui/react';
import { MdPictureAsPdf } from 'react-icons/md';
import { SetupDialog } from './Setup/SetupDialog';
import { Actions } from '../../store';
import { emptyImg, ExportPdf } from './ExportPdf';
import { openImage, openMultiImage } from '../../functions';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

export const ToolBar = () => {
  const dialogRef = useRef(null);
  const Config = useSelector((state) => ({
    sides: state.pnp.Config.sides,
    globalBackground: state.pnp.Config.globalBackground,
  }), shallowEqual);
  const { selectionLength } = useSelector((state) => ({
    selectionLength: state.pnp.CardList.filter(c => c.selected).length,
  }), shallowEqual);
  const [bulkCount, setBulkCount] = useState(1);
  const dispatch = useDispatch();
  return (<div>
      <Tooltip label='Create a new pnp file.'>
        <IconButton
          aria-label='add'
          icon={<AiFillFileAdd size={'30'} />}
        />
      </Tooltip>
      <Tooltip label='Open a pnp file.'>
        <IconButton
          aria-label='open'
          icon={<AiFillFolderOpen size={'30'} />}
        />
      </Tooltip>
      <Tooltip label='Save pnp file.'>
        <IconButton
          aria-label='save'
          icon={<AiFillSave size={'30'} />}
        />
      </Tooltip>
      <Tooltip label='Settings config.'>
        <IconButton
          aria-label='config'
          icon={<AiFillSetting size={'30'} />}
          onClick={() => {
            dialogRef.current?.openDialog();
          }}
        />
      </Tooltip>
      <Tooltip label='Export pdf.'>
        <IconButton
          aria-label='export_pdf'
          icon={<MdPictureAsPdf size={'30'} />}
          onClick={async () => {
            dispatch(Actions.EditGlobal({ isInProgress: true }));
            await ExportPdf({
              onProgress: (value) => {
                console.log('pppppp', value)
                dispatch(Actions.EditGlobal({ progress: value }));
              },
              onFinish: () => dispatch(Actions.EditGlobal({ isInProgress: false })),
            });
            alert('666')
          }}
        />
      </Tooltip>
      <Tooltip label='Global background.'>
        <IconButton
          aria-label='Global background'
          icon={<Image boxSize='30px' src={Config.globalBackground?.path || emptyImg.path} />}
          onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.EditConfig({ globalBackground: filePath }));
          }}
        />
      </Tooltip>
      <Menu onOpen={() => setBulkCount(1)}>
        <MenuButton visibility={selectionLength === 0 ? 'hidden' : 'inline'} as={Button}
                    rightIcon={<IoIosArrowDown />}>
          Selection ...
        </MenuButton>
        <MenuList>
          <MenuItem onClick={() => {
            dispatch(Actions.RemoveSelectionCards());
          }}>
            Remove
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.FillSelectedCardBack(filePath));
          }}>
            Fill background
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePaths = await openMultiImage();
            dispatch(Actions.FillSelectedCardBackWithEachBack(filePaths));
          }}>
            Fill multi background
          </MenuItem>
          <MenuItem>
            Set count
            <NumberInput size='xs' maxW={16} value={bulkCount} min={1}
                         onClick={(e) => e.stopPropagation()}
                         onChange={($, value) => {
                           setBulkCount(value);
                           //dispatch(Actions.EditCardById({ id: data.id, repeat: value }));
                         }}>
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <Button colorScheme='teal' size='xs'>
              OK
            </Button>
          </MenuItem>
          <MenuItem onClick={() => {
            dispatch(Actions.SwapSelectionCards());
          }}>
            Swap Face/Back
          </MenuItem>
          <MenuItem>
            Move to ...
          </MenuItem>
        </MenuList>

      </Menu>
      {Config.sides === 'double sides' && (<FormControl display='ruby'>
        <FormLabel>
          Switch view
        </FormLabel>
        <Switch size={'lg'} onChange={(e) => {
          dispatch(Actions.EditGlobal({ isBackEditing: e.target.checked }));
        }} />
      </FormControl>)}

      <SetupDialog ref={dialogRef} />
    </div>

  );
};