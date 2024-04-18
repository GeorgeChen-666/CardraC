import React, { useContext, useEffect, useRef, useState } from 'react';
import { IoIosOpen, IoIosOptions, IoIosArrowDown } from 'react-icons/io';
import { AiFillFolderOpen, AiFillFileAdd, AiFillSetting, AiFillSave } from 'react-icons/ai';
import {
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
import { openImage } from '../../functions';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';

export const ToolBar = () => {
  const dialogRef = useRef(null);
  const Config = useSelector((state) => ({
    sides: state.pnp.Config.sides,
    globalBackground: state.pnp.Config.globalBackground,
  }), shallowEqual);
  const Global = useSelector((state) => state.pnp.Global, shallowEqual);
  const [ bulkCount, setBulkCount ] = useState(1);
  const dispatch = useDispatch();
  console.log({ Config, Global });
  return (<div>
      <IconButton
        aria-label='add'
        icon={<AiFillFileAdd size={'30'} />}
      />
      <IconButton
        aria-label='open'
        icon={<AiFillFolderOpen size={'30'} />}
      />
      <IconButton
        aria-label='save'
        icon={<AiFillSave size={'30'} />}
      />

      <IconButton
        aria-label='config'
        icon={<AiFillSetting size={'30'} />}
        onClick={() => {
          dialogRef.current?.openDialog();
        }}
      />
      <IconButton
        aria-label='export_pdf'
        icon={<MdPictureAsPdf size={'30'} />}
        onClick={() => ExportPdf({})}
      />
      <IconButton
        aria-label='export_pdf'
        icon={<Image boxSize='30px' src={Config.globalBackground?.path || emptyImg.path} />}
        onClick={async () => {
          const filePath = await openImage();
          dispatch(Actions.EditConfig({ globalBackground: filePath }));
        }}
      />
      <Menu onOpen={()=>setBulkCount(1)}>
        <MenuButton visibility={Global.selection?.size === 0 ? 'hidden' : 'inline'} as={Button}
                    rightIcon={<IoIosArrowDown />}>
          Selection
        </MenuButton>
        <MenuList>
          <MenuItem onClick={() => {
            dispatch(Actions.RemoveSelectionCards());
          }}>
            Remove
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.FillCardBack(filePath))
          }}>
            Fill background
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
          <MenuItem onClick={()=>{
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