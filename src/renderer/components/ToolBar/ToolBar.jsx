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
  Link
} from '@chakra-ui/react';
import { MdPictureAsPdf } from 'react-icons/md';
import { SetupDialog } from './Setup/SetupDialog';
import { Actions, initialState, store } from '../../store';
import { exportPdf, openImage, openMultiImage, openProject, saveProject } from '../../functions';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { useTranslation } from "react-i18next";

export const ToolBar = () => {
  const { t } = useTranslation();
  const dialogRef = useRef(null);
  const Config = useSelector((state) => ({
    sides: state.pnp.Config.sides,
    globalBackground: state.pnp.Config.globalBackground,
  }), shallowEqual);
  const { selectionLength, cardListLength } = useSelector((state) => ({
    selectionLength: state.pnp.CardList.filter(c => c.selected).length,
    cardListLength: state.pnp.CardList.length
  }), shallowEqual);
  const [repeat, setRepeat] = useState(1);
  const [toIndex, setToIndex] = useState(1);
  const dispatch = useDispatch();
  return (<div>
      <Tooltip label={t('toolbar.btnAdd')}>
        <IconButton
          icon={<AiFillFileAdd size={'30'} />}
          onClick={async() => {
            dispatch(Actions.StateFill(initialState));
          }}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnOpen')}>
        <IconButton
          icon={<AiFillFolderOpen size={'30'} />}
          onClick={async() => {
            const projectData = await openProject();
            dispatch(Actions.StateFill(projectData));
          }}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnSave')}>
        <IconButton
          icon={<AiFillSave size={'30'} />}
          onClick={() => saveProject( { state: store.getState().pnp } )}
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
            dispatch(Actions.GlobalEdit({ isInProgress: true }));
            await exportPdf( { state: store.getState().pnp, onProgress: ($,value) => dispatch(Actions.GlobalEdit({ progress: value })) } )
            dispatch(Actions.GlobalEdit({ isInProgress: false }))
          }}
        />
      </Tooltip>
      <Tooltip label={t('toolbar.btnGlobalBackground')}>
        <IconButton
          icon={<Image boxSize='30px' src={Config.globalBackground?.path} />}
          onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.ConfigEdit({ globalBackground: filePath }));
          }}
        />
      </Tooltip>
      <Menu onOpen={() => [setRepeat(1), setToIndex(1)]}>
        <MenuButton visibility={selectionLength === 0 ? 'hidden' : 'inline'} as={Button}
                    rightIcon={<IoIosArrowDown />}>
          {t('toolbar.bulkMenu.labelSelection')}
        </MenuButton>
        <MenuList>
          <MenuItem onClick={() => {
            dispatch(Actions.SelectedCardsRemove());
          }}>
            {t('toolbar.bulkMenu.menuRemove')}
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePath = await openImage();
            dispatch(Actions.SelectedCardsEdit({back: filePath}));
          }}>
            {t('toolbar.bulkMenu.menuFillBackground')}
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePaths = await openMultiImage();
            dispatch(Actions.SelectedCardFillBackWithEachBack(filePaths));
          }}>
            {t('toolbar.bulkMenu.menuFillMultiBackground')}
          </MenuItem>
          <MenuItem>
            {t('toolbar.bulkMenu.menuSetCount')}
            <NumberInput size='xs' maxW={16} value={repeat} min={1}
                         onClick={(e) => e.stopPropagation()}
                         onChange={($, value) => {
                           setRepeat(value);
                           //dispatch(Actions.CardEditById({ id: data.id, repeat: value }));
                         }}>
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <Link onClick={() => {
              dispatch(Actions.SelectedCardsEdit({repeat}));
            }}>{t('button.OK')}</Link>
          </MenuItem>
          <MenuItem onClick={() => {
            dispatch(Actions.SelectedCardsSwap());
          }}>
            {t('toolbar.bulkMenu.menuSwap')}
          </MenuItem>
          <MenuItem>
            {t('toolbar.bulkMenu.menuMove')}
            <NumberInput size='xs' maxW={16} value={toIndex} min={1} max={cardListLength}
                         onClick={(e) => e.stopPropagation()}
                         onChange={($, value) => {
                           setToIndex(value);
                         }}>
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
            <Link>{t('button.OK')}</Link>
          </MenuItem>
        </MenuList>

      </Menu>
      {Config.sides === 'double sides' && (<FormControl display='ruby'>
        <FormLabel>
          {t('toolbar.lblSwitchView')}
        </FormLabel>
        <Switch size={'lg'} onChange={(e) => {
          dispatch(Actions.GlobalEdit({ isBackEditing: e.target.checked }));
        }} />
      </FormControl>)}

      <SetupDialog ref={dialogRef} />
    </div>

  );
};