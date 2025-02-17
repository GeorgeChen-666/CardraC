import React, { useEffect } from 'react';
import { Button, Menu, MenuButton, MenuItem, MenuList, Tooltip } from '@chakra-ui/react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { ChevronDownIcon } from '@chakra-ui/icons';
import _ from 'lodash';
import { i18nInstance } from '../../../i18n';
import { Actions } from '../../../store';
import { getResourcesPath } from '../../../functions';

export const LangSelectButton = ({ label }) => {
  const dispatch = useDispatch();
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'currentLang',
      'availableLangs',
    ])
  ), shallowEqual);
  useEffect(() => {
    i18nInstance.changeLanguage(Global.currentLang);
  }, [Global.currentLang]);

  return (<Tooltip label={label}>
    <Menu>
      <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
        <img style={{ height: '25px' }} src={getResourcesPath(`/public/language-icons/${Global.currentLang}.svg`)} />
      </MenuButton>
      <MenuList>
        {Global.availableLangs.filter(lan => lan !== Global.currentLang).map(lan =>
          <MenuItem
            key={lan}
            onClick={
              () =>
                dispatch(Actions.GlobalEdit({ currentLang: lan }))
            }
          ><img style={{ height: '25px' }} src={getResourcesPath(`/public/language-icons/${lan}.svg`)} />{lan}
          </MenuItem>)}
      </MenuList>
    </Menu>
  </Tooltip>);
};