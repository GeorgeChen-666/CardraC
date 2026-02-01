import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { GeneralIconButton } from '../../../componments/GeneralIconButton';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import PrintIcon from '@mui/icons-material/Print';
import CloseIcon from '@mui/icons-material/Close';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../state/store';
import { PageNavigator } from './PageNavigator';
import { callMain } from '../../../functions';
import { eleActions } from '../../../../shared/constants';
import { PrintDrawer } from './Print/PrintDrawer';


export const PreviewToolbar = ({ previewRef }) => {
  const { t } = useTranslation();
  const { getExportPageCount, CardList, mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const exportPageCount = Global.exportPageCount() || 0;
  const exportPreviewIndex = Global.exportPreviewIndex() || 1;
  useEffect(() => {
    CardList.length > 0 && getExportPageCount()
  }, [CardList]);
  useEffect(() => {
    mergeGlobal({ exportPreviewIndex: 1 });
  },[])
  const handlePageChange = (page) => {
    mergeGlobal({ exportPreviewIndex: page });
  };
  return (<>
      <Box
        sx={{
          p: 0.5,
        }}
      >
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
        <GeneralIconButton
          disabled={exportPageCount === 0}
          label={t('toolbar.print')}
          icon={<PrintIcon />}
          onClick={() => {
            previewRef.current.drawerPrintRef.current.openDrawer();
          }}
        />
        <div style={{ float: 'right' }}>
          <GeneralIconButton
            label={t('toolbar.close')}
            icon={<CloseIcon />}
            onClick={() => {
              mergeGlobal({ currentView: 'edit' })
            }}
          />
        </div>

      </Box>
    </>
  )
}