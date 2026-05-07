import React from 'react';
import { BaseToolbar } from '../../ToolBar';
import { BulkOperationButton } from './BulkOperationButton';
import { FormControlLabel } from '@mui/material';
import Switch from '@mui/material/Switch';
import { layoutSides } from '../../../../shared/constants';
import { useGlobalStore } from '../../../state/store';
import { useTranslation } from 'react-i18next';

const SubMenu = () => {
  const {Config, Global } = useGlobalStore.selectors;
  const isBackEditing = Global.isBackEditing();
  const isShowOverView = Global.isShowOverView();
  const { mergeGlobal } = useGlobalStore.getState();
  const { t } = useTranslation();
  return <>
    <BulkOperationButton />
    <div style={{ float: 'right' }}>
      <FormControlLabel
        control={<Switch checked={isShowOverView ?? false} onChange={() => mergeGlobal({ isShowOverView: !isShowOverView })} />}
        label={t('toolbar.lblShowOverviewWindow')} />
      {Config.sides() === layoutSides.doubleSides && (
        <FormControlLabel
          control={<Switch checked={isBackEditing ?? false} onChange={() => mergeGlobal({ isBackEditing: !isBackEditing })} />}
          label={t('toolbar.lblSwitchView')} />
      )}
    </div>
  </>
}

export function EditToolbar() {
  return <BaseToolbar SubMenu={SubMenu} />
}