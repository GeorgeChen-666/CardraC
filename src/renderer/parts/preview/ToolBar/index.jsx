import React, { useEffect, useState } from 'react';
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


export const PreviewToolbar = ({ previewRef }) => {
  const { t } = useTranslation();
  const { getExportPageCount, CardList, mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const exportPageCount = Global.exportPageCount() || 0;
  const exportPreviewIndex = Global.exportPreviewIndex() || 1;
  useEffect(() => {
    CardList.length > 1 && getExportPageCount()
  }, [CardList]);
  useEffect(() => {
    mergeGlobal({ exportPreviewIndex: 1 });
  },[])
  const handlePrevPage = () => {
    if (exportPreviewIndex > 0) {
      mergeGlobal({ exportPreviewIndex: exportPreviewIndex - 1 });
    }
  };

  const handleNextPage = () => {
    if (exportPreviewIndex < exportPageCount) {
      mergeGlobal({ exportPreviewIndex: exportPreviewIndex + 1 });
    }
  };
  return (<>
    <Box
      sx={{
        p: 0.5,
      }}
    >
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<ArrowBackIosIcon />}
        onClick={handlePrevPage}
      />
      <span>{exportPreviewIndex} of {exportPageCount}</span>
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<ArrowForwardIosIcon />}
        onClick={handleNextPage}
      />


      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<RemoveIcon />}
        onClick={() => {
          {
            previewRef.current?.zoomOut?.()
          }
        }}
      />

      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<AddIcon />}
        onClick={() => {
          {
            previewRef.current?.zoomIn?.()
          }
        }}
      />
      <GeneralIconButton
        label={t('toolbar.btnAdd')}
        icon={<FitScreenIcon />}
        onClick={() => {
          {
            previewRef.current?.fitToContainer?.()
          }
        }}
      />
      {/*<GeneralIconButton*/}
      {/*  label={t('toolbar.btnAdd')}*/}
      {/*  icon={<PrintIcon />}*/}
      {/*/>*/}
      <div style={{ float: 'right' }}>
        <GeneralIconButton
          label={t('toolbar.btnAdd')}
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