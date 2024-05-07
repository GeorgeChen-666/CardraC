import React, { useRef, useState } from 'react';import { jsPDF } from "jspdf";
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
import { Actions, store } from '../../store';
// import { emptyImg, ExportPdf } from './ExportPdf';
import { exportPdf, openImage, openMultiImage } from '../../functions';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { useTranslation } from "react-i18next";

export const ToolBar = () => {
  const { t } = useTranslation();
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
      <Tooltip label={t('toolbar.btnAdd')}>
        <IconButton
          icon={<AiFillFileAdd size={'30'} />}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnOpen')}>
        <IconButton
          icon={<AiFillFolderOpen size={'30'} />}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnSave')}>
        <IconButton
          aria-label='save'
          icon={<AiFillSave size={'30'} />}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnConfig')}>
        <IconButton
          icon={<AiFillSetting size={'30'} />}
          onClick={() => {
            dialogRef.current?.openDialog();
          }}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnExport')}>
        <IconButton
          icon={<MdPictureAsPdf size={'30'} />}
          onClick={async () => {
            

// Default export is a4 paper, portrait, using millimeters for units
            const doc = new jsPDF();

            // doc.text("Hello world!", 10, 10);
            // doc.save("a4.pdf"); return;
            dispatch(Actions.EditGlobal({ isInProgress: true }));
            await exportPdf( { state: store.getState().pnp, onProgress: ($,value) => dispatch(Actions.EditGlobal({ progress: value })) } )
            dispatch(Actions.EditGlobal({ isInProgress: false }))
          }}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnGlobalBackground')}>
        <IconButton
          icon={<Image boxSize='30px' src={Config.globalBackground?.path} />}
          onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.EditConfig({ globalBackground: filePath }));
          }}
        />
      </Tooltip>
      <Menu onOpen={() => setBulkCount(1)}>
        <MenuButton visibility={selectionLength === 0 ? 'hidden' : 'inline'} as={Button}
                    rightIcon={<IoIosArrowDown />}>
          {t('toolbar.bulkMenu.labelSelection')}
        </MenuButton>
        <MenuList>
          <MenuItem onClick={() => {
            dispatch(Actions.RemoveSelectionCards());
          }}>
            {t('toolbar.bulkMenu.menuRemove')}
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.FillSelectedCardBack(filePath));
          }}>
            {t('toolbar.bulkMenu.menuFillBackground')}
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePaths = await openMultiImage();
            dispatch(Actions.FillSelectedCardBackWithEachBack(filePaths));
          }}>
            {t('toolbar.bulkMenu.menuFillMultiBackground')}
          </MenuItem>
          <MenuItem>
            {t('toolbar.bulkMenu.menuSetCount')}
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
            {/*<Button colorScheme='teal' size='xs'>*/}
            {/*  {t('toolbar.button.OK')}*/}
            {/*</Button>*/}
          </MenuItem>
          <MenuItem onClick={() => {
            dispatch(Actions.SwapSelectionCards());
          }}>
            {t('toolbar.bulkMenu.menuSwap')}
          </MenuItem>
          <MenuItem>
            {t('toolbar.bulkMenu.menuMove')}
          </MenuItem>
        </MenuList>

      </Menu>
      {Config.sides === 'double sides' && (<FormControl display='ruby'>
        <FormLabel>
          {t('toolbar.lblSwitchView')}
        </FormLabel>
        <Switch size={'lg'} onChange={(e) => {
          dispatch(Actions.EditGlobal({ isBackEditing: e.target.checked }));
        }} />
      </FormControl>)}

      <SetupDialog ref={dialogRef} />
    </div>

  );
};