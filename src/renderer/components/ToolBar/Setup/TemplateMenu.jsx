import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Button,
  ButtonGroup,
  Editable,
  EditableInput,
  EditablePreview,
  Flex,
  FocusLock,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Popover,
  PopoverArrow,
  PopoverCloseButton,
  PopoverContent,
  PopoverTrigger,
  Text, Tooltip,
  useDisclosure,
  useEditableControls,
} from '@chakra-ui/react';
import {
  AiFillCaretDown,
  AiFillCheckCircle,
  AiFillCloseCircle,
  AiFillDelete,
  AiFillEdit,
  AiFillSave, AiOutlineCheck, AiOutlineClose, AiOutlineDelete, AiOutlineEdit, AiOutlineSave,
} from 'react-icons/ai';
import { EditIcon } from '@chakra-ui/icons';
import { deleteTemplate, editTemplate, getTemplate, setTemplate } from '../../../functions';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { Actions } from '../../../store';
import { useTranslation } from 'react-i18next';

const EditableControls = forwardRef(({id, state, defaultMenuLabel}, ref) => {
  const { t } = useTranslation();
  const Config = useSelector((state) => (
    state.pnp.Config
  ), shallowEqual);
  const {
    isEditing,
    getSubmitButtonProps,
    getCancelButtonProps,
    getEditButtonProps,
  } = useEditableControls();
  const onEditButtonClick = (e, label = 'no name') => {
    state.setMenuLabel(label);
    setTimeout(() => getEditButtonProps().onClick(e), 200)
  }
  useImperativeHandle(ref, () => ({
    click: onEditButtonClick,
  }));

  return <ButtonGroup justifyContent='center' marginLeft={'10px'} verticalAlign={'bottom'} size='sm'>
    {isEditing ? (
      <>
        <IconButton icon={<AiOutlineCheck />} {...getSubmitButtonProps()} onClick={async (e) => {
          if(id) {
            await editTemplate({templateName: state.menuLabel, id})
          }
          else {
            await setTemplate({templateName: state.menuLabel, Config})
          }
          state.setMenuLabel(defaultMenuLabel);
          getSubmitButtonProps().onClick(e);
        }} />
        <IconButton icon={<AiOutlineClose />} {...getCancelButtonProps()} onClick={(e) => {
          state.setMenuLabel(defaultMenuLabel);
          getCancelButtonProps().onClick(e);
        }} />
      </>
    ) : (
      <Tooltip label={t('configDialog.saveCurrentConfig')}>
        <IconButton icon={<AiOutlineSave />} {...getEditButtonProps()} onClick={onEditButtonClick} />
      </Tooltip>
    )}

  </ButtonGroup>;
})

export const TemplateMenu = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const defaultMenuLabel = t('configDialog.clickMenuLoadConfig')
  const [menuLabel, setMenuLabel] = useState(defaultMenuLabel);
  const { onOpen, onClose, isOpen } = useDisclosure();
  const [menuItems,  setMenuItems] = useState([]);
  const [editingId, setEditingId] = useState('');
  const saveButtonRef = useRef();


  return (
    <Editable display={'inline-block'} marginLeft={'10px'} value={menuLabel}
      onChange={nv => {
        if(nv === defaultMenuLabel) {
          setEditingId('');
        }
        setMenuLabel(nv);
      }
    }>
      <Menu size={'sm'}>
        <MenuButton
          onClick={async() => {
            const templateList = await getTemplate();
            setMenuItems(templateList);
          }}
          as={Button} size={'sm'}
          rightIcon={<AiFillCaretDown />}>

          <EditablePreview width={'200px'} />
          <EditableInput width={'200px'} />

        </MenuButton>
        <MenuList>
          {menuItems.length === 0 &&(<MenuItem><Text fontSize='sm' marginRight={'10px'}>{t('util.noData')}</Text></MenuItem>)}
          {menuItems.map(item => (<MenuItem as={Flex} justifyContent={'space-between'} onClick={() => {
            dispatch(Actions.ConfigEdit(item.Config));
          }}>
            <Text fontSize='sm' marginRight={'10px'}>{item.TemplateName}</Text>
            <div>
              <IconButton
                isRound={true}
                variant='ghost'
                size='sm'
                onClick={(e) => {
                  setEditingId(item.id);
                  saveButtonRef.current?.click(e, item.TemplateName);
                }}
                icon={<AiOutlineEdit />}
              />
              <Popover
                isOpen={isOpen}
                onOpen={onOpen}
                onClose={onClose}
              >
                <PopoverTrigger>
                  <IconButton
                    isRound={true}
                    variant='ghost'
                    size='sm'
                    onClick={(e) => {
                      e.stopPropagation();
                    }}
                    icon={<AiOutlineDelete />}
                  />
                </PopoverTrigger>
                <PopoverContent p={1} width={'120px'}>
                  <FocusLock returnFocus persistentFocus={false}>
                    <PopoverArrow />
                    <div style={{textAlign: 'center'}}>
                      <Text fontSize={'sm'}>{t('util.confirmDelete')}</Text>
                      <Button variant='ghost' size={'sm'} onClick={async () => {
                        await deleteTemplate({id: item.id});
                        onClose();
                      }}>{t('button.yes')}</Button>
                      <Button variant='ghost' size={'sm'} marginLeft={'10px'} onClick={onClose}>{t('button.no')}</Button>
                    </div>
                  </FocusLock>
                </PopoverContent>
              </Popover>
            </div>
          </MenuItem>))}

        </MenuList>
      </Menu>
      <EditableControls id={editingId} ref={saveButtonRef} defaultMenuLabel={defaultMenuLabel} state = {{menuLabel, setMenuLabel}} />
    </Editable>);
};