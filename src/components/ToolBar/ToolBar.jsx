import React, { useContext, useEffect, useRef } from 'react';
import { IoIosOpen, IoIosOptions, IoIosArrowDown   } from "react-icons/io";
import { AiFillFolderOpen, AiFillFileAdd, AiFillSetting , AiFillSave  } from "react-icons/ai";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  FormControl,
  FormLabel,
  Switch, Image, Button,
} from '@chakra-ui/react';
import { MdPictureAsPdf } from "react-icons/md";
import { SetupDialog } from './Setup/SetupDialog';
import { Actions, StoreContext } from '../../store';
import { emptyImg, ExportPdf } from './ExportPdf';
import { ipcRenderer } from 'electron';

export const ToolBar = () => {
  const dialogRef = useRef(null);
  const {state, dispatch} = useContext(StoreContext);
  const { Config } = state;
  console.log(state);
  useEffect(() => {
    const onFileOpen = (event, filePaths) => {
      dispatch({type:Actions.EditConfig, payload: {globalBackground: filePaths}})
    }
    ipcRenderer.on('setBgCardReturn', onFileOpen);
    return () => ipcRenderer.off('setBgCardReturn', onFileOpen);
  },[]);
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
        onClick={()=> ExportPdf(state)}
      />
      <IconButton
        aria-label='export_pdf'
        icon={<Image boxSize='30px' src={Config.globalBackground || emptyImg} />}
        onClick={() => {
          ipcRenderer.send('open-image', {
            returnChannel: 'setBgCardReturn'
          });
        }}
      />
      <Menu>
        <MenuButton visibility={state.Global.selection.size === 0?'hidden':'inline'}  as={Button} rightIcon={<IoIosArrowDown />}>
          Selection
        </MenuButton>
        <MenuList>
          <MenuItem>
            Remove
          </MenuItem>
          <MenuItem>
            Fill background
          </MenuItem>
          <MenuItem>
            Set count
          </MenuItem>
          <MenuItem>
            Swap Face/Back
          </MenuItem>
          <MenuItem>
            Move to ...
          </MenuItem>
        </MenuList>

      </Menu>
      {Config.sides === 'double sides' && (<FormControl display='ruby'>
        <FormLabel>
          Back editing
        </FormLabel>
        <Switch size={'lg'} onChange={(e) => {
          dispatch({ type: Actions.EditGlobal, payload: {isBackEditing: e.target.checked}})
        }} />
      </FormControl>)}

      <SetupDialog ref={dialogRef} />
  </div>

  )
}