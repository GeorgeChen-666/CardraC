import React, { useEffect} from 'react';
import Box from '@mui/material/Box';
import { GeneralIconButton } from '../../../componments/GeneralIconButton';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../state/store';
import { PageNavigator } from './PageNavigator';
import { BaseToolbar } from '../../ToolBar';

const SubMenu = () => {
  const { t } = useTranslation();
  const { getExportPageCount, CardList, mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const exportPageCount = Global.exportPageCount() || 0;
  const exportPreviewIndex = Global.exportPreviewIndex() || 1;
  const previewRef = window.printPreviewRef;
  useEffect(() => {
    CardList.length > 0 && getExportPageCount()
  }, [CardList]);
  useEffect(() => {
    mergeGlobal({ exportPreviewIndex: 1 });
  },[])
  const handlePageChange = (page) => {
    mergeGlobal({ exportPreviewIndex: page });
  };
  return <>
    <div style={{ float: 'right' }}>
      <PageNavigator
        currentPage={exportPreviewIndex}
        totalPages={exportPageCount}
        onPageChange={handlePageChange}
      />
      <span style={{ color: '#666', padding: '4px' }}>|</span>
      <GeneralIconButton
        label={t('toolbar.zoomOut')}
        icon={<RemoveIcon />}
        onClick={() => {
          {
            previewRef.current?.zoomOut?.()
          }
        }}
      />

      <GeneralIconButton
        label={t('toolbar.zoomIn')}
        icon={<AddIcon />}
        onClick={() => {
          {
            previewRef.current?.zoomIn?.()
          }
        }}
      />
      <GeneralIconButton
        label={t('toolbar.zoomFix')}
        icon={<FitScreenIcon />}
        onClick={() => {
          {
            previewRef.current?.fitToContainer?.()
          }
        }}
      />
    </div>
  </>
}
export function PreviewToolbar() {
  return <BaseToolbar SubMenu={SubMenu} />
}