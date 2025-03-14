import React, { useRef, useState } from 'react';
import { IoIosArrowDown } from 'react-icons/io';
import {
  AiFillFileAdd,
  AiFillFolderOpen,
  AiFillSave,
  AiFillSetting,
  AiOutlineGithub,
  AiOutlineInfo,
  AiOutlineReload,
} from 'react-icons/ai';
import {
  Button,
  FormControl,
  FormLabel,
  Image,
  Link,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Switch,
} from '@chakra-ui/react';
import { MdPictureAsPdf } from 'react-icons/md';
import { SetupDialog } from './Setup/SetupDialog';
import { Actions, initialState, loading, store } from '../../store';
import {
  exportPdf,
  getImageSrc,
  getNotificationTrigger, notificationSuccess,
  openImage,
  openMultiImage,
  openProject,
  saveProject,
} from '../../functions';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { GeneralButton } from './Buttons/GeneralButton';
import { LangSelectButton } from './Buttons/LangSelectButton';
import './styles.css';
import { ReloadDialog } from './ReloadImg/ReloadDialog';
import { AboutDialog } from './About/AboutDialog';
import { ImageViewer } from '../ImageViewer';
import _ from 'lodash';


export const ToolBar = () => {
  const { t } = useTranslation();
  const dialogSetupRef = useRef(null);
  const dialogReloadRef = useRef(null);
  const dialogAboutRef = useRef(null);
  const imageViewerRef = useRef(null);
  window.imageViewerRef = imageViewerRef;
  const Config = useSelector((state) => ({
    sides: state.pnp.Config.sides,
    globalBackground: state.pnp.Config.globalBackground,
  }), shallowEqual);
  const { selectionLength } = useSelector((state) => ({
    selectionLength: state.pnp.CardList.filter(c => c.selected).length,
  }), shallowEqual);
  const cardListLength = useSelector((state) => (state.pnp.CardList.length), shallowEqual);
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isShowOverView'
    ])
  ), shallowEqual);
  const [repeat, setRepeat] = useState(1);
  const dispatch = useDispatch();
  return (
    <>
      <div className={'ToolBar'}>
        <div className={'LeftDiv'}>
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
            onClick={() => loading(async () => {
              const projectData = await openProject();
              if (projectData) {
                dispatch(Actions.StateFill(projectData));
              }
            })}
          />
          <GeneralButton
            isDisabled={cardListLength === 0}
            label={t('toolbar.btnReloadImage')}
            icon={<AiOutlineReload size={'30'} />}
            onClick={() => dialogReloadRef.current?.openDialog()}
          />
          <GeneralButton
            label={t('toolbar.btnSave')}
            icon={<AiFillSave size={'30'} />}
            onClick={async () => {
              const { CardList } = store.getState().pnp;
              await saveProject({ globalBackground: Config.globalBackground, CardList });
              notificationSuccess();
            }}
          />
          <LangSelectButton label={t('toolbar.btnConfig')} />
          <GeneralButton
            label={t('toolbar.btnConfig')}
            icon={<AiFillSetting size={'30'} />}
            onClick={() => dialogSetupRef.current?.openDialog()}
          />
          <GeneralButton
            label={t('toolbar.btnExport')}
            icon={<MdPictureAsPdf size={'30'} />}
            onClick={() => loading(async () => {
              const { CardList } = store.getState().pnp;
              const isSuccess = await exportPdf({ globalBackground: Config.globalBackground, CardList });
              isSuccess && notificationSuccess();
            })}
          />
          {Config.sides === 'double sides' && <GeneralButton
            label={t('toolbar.btnGlobalBackground')}
            icon={<Image
              boxSize='30px'
              src={getImageSrc(Config.globalBackground)}
              onMouseOver={() => {
                imageViewerRef.current.update(Config.globalBackground?.path);
              }}
            />}
            onClick={() => loading(async () => {
              const filePath = await openImage('setGlobalBack');
              dispatch(Actions.ConfigEdit({ globalBackground: filePath }));
            })}
          />}
          <GeneralButton
            label={'GitHub'}
            icon={<AiOutlineGithub size={'30'} />}
            onClick={() => {
              window.open('https://github.com/GeorgeChen-666/CardraC');
            }}
          />
          <GeneralButton
            label={t('toolbar.btnAbout')}
            icon={<AiOutlineInfo size={'30'} />}
            onClick={() => {
              dialogAboutRef.current.openDialog();
            }}
          />
        </div>
        <div className={'RightDiv'}>
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
              <MenuItem onClick={() => {
                dispatch(Actions.SelectedCardsDuplicate());
              }}>
                {t('toolbar.bulkMenu.duplidate')}
              </MenuItem>
              <MenuItem onClick={() => loading(async () => {
                const filePath = await openImage('fillBackground');
                filePath && dispatch(Actions.SelectedCardsEdit({ back: filePath }));
              })}>
                {t('toolbar.bulkMenu.menuFillBackground')}
              </MenuItem>
              <MenuItem onClick={() => loading(async () => {
                const filePaths = await openMultiImage('SelectedCardFillBackWithEachBack');
                filePaths?.length > 0 && dispatch(Actions.SelectedCardFillBackWithEachBack(filePaths));
              })}>
                {t('toolbar.bulkMenu.menuFillMultiBackground')}
              </MenuItem>
              <MenuItem>
                {t('toolbar.bulkMenu.menuSetCount')}
                <NumberInput size='xs' maxW={16} value={repeat} min={1}
                             onClick={(e) => e.stopPropagation()}
                             onChange={($, value) => {
                               setRepeat(isNaN(value) ? 1 : value);
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
          <FormControl display='ruby'>
            <FormLabel>
              {t('toolbar.lblShowOverviewWindow')}
            </FormLabel>
            <Switch size={'lg'} isChecked={Global.isShowOverView} onChange={(e) => {
              dispatch(Actions.GlobalEdit({ isShowOverView: e.target.checked }));
              imageViewerRef.current.update();
            }} />
          </FormControl>
          {Config.sides === 'double sides' && (<FormControl display='ruby'>
            <FormLabel>
              {t('toolbar.lblSwitchView')}
            </FormLabel>
            <Switch size={'lg'} onChange={(e) => {
              dispatch(Actions.GlobalEdit({ isBackEditing: e.target.checked }));
            }} />
          </FormControl>)}
        </div>
      </div>
      <SetupDialog ref={dialogSetupRef} />
      <ReloadDialog ref={dialogReloadRef} />
      <AboutDialog ref={dialogAboutRef} />
      <ImageViewer ref={imageViewerRef} />
    </>


  );
};