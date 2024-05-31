import React, { useRef, useState } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import { AiFillFolderOpen, AiFillFileAdd, AiFillSetting, AiFillSave } from 'react-icons/ai';
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
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
  Link,
} from '@chakra-ui/react';
import { MdPictureAsPdf } from 'react-icons/md';
import { SetupDialog } from './Setup/SetupDialog';
import { Actions, initialState, store, reloadImageFromFile } from '../../store';
import { exportPdf, openImage, openMultiImage, openProject, saveProject } from '../../functions';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { GeneralButton } from './Buttons/GeneralButton';
import { LangSelectButton } from './Buttons/LangSelectButton';

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
  const [repeat, setRepeat] = useState(1);
  const dispatch = useDispatch();
  return (<div>
      <GeneralButton
        label={t('toolbar.btnAdd')}
        icon={<AiFillFileAdd size={'30'} />}
        onClick={async () => {
          dispatch(Actions.StateFill(initialState));
        }}
      />
      <GeneralButton
        label={t('toolbar.btnOpen')}
        icon={<AiFillFolderOpen size={'30'} />}
        onClick={async () => {
          const projectData = await openProject();
          dispatch(Actions.StateFill(projectData));
          await reloadImageFromFile();
        }}
      />
      <GeneralButton
        label={t('toolbar.btnSave')}
        icon={<AiFillSave size={'30'} />}
        onClick={() => saveProject({ state: store.getState().pnp })}
      />
      <LangSelectButton label={t('toolbar.btnConfig')} />
      <GeneralButton
        label={t('toolbar.btnConfig')}
        icon={<AiFillSetting size={'30'} />}
        onClick={() => dialogRef.current?.openDialog()}
      />
      <GeneralButton
        label={t('toolbar.btnExport')}
        icon={<MdPictureAsPdf size={'30'} />}
        onClick={async () => {
          dispatch(Actions.GlobalEdit({ isInProgress: true, progress: 0 }));
          const isSuccess = await exportPdf({
            state: store.getState().pnp, onProgress: value => {
              dispatch(Actions.GlobalEdit({ progress: value }));
            },
          });
          dispatch(Actions.GlobalEdit({ isInProgress: false }));
          isSuccess && setTimeout(() => alert(t('toolbar.lblExportSuccess')), 100);
        }}
      />
      {Config.sides === 'double sides' && <GeneralButton
        label={t('toolbar.btnGlobalBackground')}
        icon={<Image boxSize='30px' src={Config.globalBackground?.path} />}
        onClick={async () => {
          const filePath = await openImage('setGlobalBack');
          dispatch(Actions.ConfigEdit({ globalBackground: filePath }));
        }}
      />}
      <Menu onOpen={() => setRepeat(1)}>
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
            const filePath = await openImage('fillBackground');
            dispatch(Actions.SelectedCardsEdit({ back: filePath }));
          }}>
            {t('toolbar.bulkMenu.menuFillBackground')}
          </MenuItem>
          <MenuItem onClick={async () => {
            const filePaths = await openMultiImage('SelectedCardFillBackWithEachBack');
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
              dispatch(Actions.SelectedCardsEdit({ repeat }));
            }}>{t('button.OK')}</Link>
          </MenuItem>
          <MenuItem onClick={() => {
            dispatch(Actions.SelectedCardsSwap());
          }}>
            {t('toolbar.bulkMenu.menuSwap')}
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