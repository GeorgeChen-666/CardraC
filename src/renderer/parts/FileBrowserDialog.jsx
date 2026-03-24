import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { FileBrowser, FileNavbar, FileToolbar, FileList, FileContextMenu } from 'chonky';
import { ChonkyActions } from 'chonky';
import { ChonkyIconFA } from 'chonky-icon-fontawesome';
import { useTranslation } from 'react-i18next';
import { Divider } from '@mui/material';
import './FileBrowserDialog.css';
import { FileOrganizer } from './FileOrganizer';
import { withConfirmation } from '../componments/withConfirmation';
import { setDefaultPath, getDefaultPath } from '../functions';

console.debug = () => {};

const ConfimButton = withConfirmation(Button)

const API_BASE = 'http://localhost:3333/browse';

const CustomNavbar = ({ canGoBack, canGoForward, onBack, onForward }) => {
  return (
    <div style={{ display: 'flex' }}>
      <div className={'chonky-navbarWrapper'}>
        <Button
          size='small'
          onClick={onBack}
          disabled={!canGoBack}
          className={'chonky-baseButton chonky-iconOnlyButton'}
          title='后退'
        >
          <ArrowBackIcon fontSize='small' />
        </Button>
        <Button
          size='small'
          onClick={onForward}
          disabled={!canGoForward}
          className={'chonky-baseButton chonky-iconOnlyButton'}
          title='前进'
        >
          <ArrowForwardIcon fontSize='small' />
        </Button>
      </div>
      <FileNavbar />
    </div>
  );
};

export const FileBrowserDialog = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [folderChain, setFolderChain] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [inputFileName, setInputFileName] = useState('');
  const [options, setOptions] = useState({
    multiSelect: false,
    filterExtensions: null,
    title: 'Select Files',
    isDoubleSides: false,
    showFileIcon: false
  });

  const fileBrowserRef = useRef(null);
  const historyStack = useRef([]);
  const forwardStack = useRef([]);
  const isNavigating = useRef(false);
  const onSelectRef = useRef(null);
  const customComponentRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openDialog: async (newOptions = {}) => {
      const {
        onSelect,
        multiSelect = false,
        filterExtensions = null,
        title = 'Select Files',
        isDoubleSides = false,
        showFileIcon = false,
        mode = 'open'
      } = newOptions;

      onSelectRef.current = onSelect;
      const {  path: defaultPath } = await getDefaultPath();

      setOptions({
        defaultPath,
        multiSelect,
        filterExtensions,
        title,
        isDoubleSides,
        showFileIcon,
        mode
      });

      setOpen(true);

      historyStack.current = [];
      forwardStack.current = [];
      setCanGoBack(false);
      setCanGoForward(false);


      loadFiles(defaultPath, filterExtensions);
      setSelectedFiles([]);
      fileBrowserRef.current?.setFileSelection(new Set(), true);
    },
  }));

  const getCurrentExtension = useCallback(() => {
    if (options.mode === 'save') {
      return customComponentRef.current?.fileType || options.filterExtensions;
    }
    return options.filterExtensions;
  }, [options.mode, options.filterExtensions]);

  //添加 buildFolderChain 函数
  const buildFolderChain = useCallback((currentPath) => {
    const chain = [{
      id: 'root',
      name: '💾 All Drives',
      isDir: true
    }];

    if (!currentPath) return chain;

    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    if (parts.length === 0) return chain;

    const firstPart = parts[0];
    if (firstPart.includes(':')) {
      chain.push({ id: firstPart, name: firstPart, isDir: true });

      let accumulated = firstPart;
      for (let i = 1; i < parts.length; i++) {
        accumulated = `${accumulated}/${parts[i]}`;
        chain.push({ id: accumulated, name: parts[i], isDir: true });
      }
    }

    return chain;
  }, []);

  //添加 updateHistoryState 函数
  const updateHistoryState = useCallback(() => {
    setCanGoBack(historyStack.current.length > 0);
    setCanGoForward(forwardStack.current.length > 0);
  }, []);

  const loadFiles = useCallback(async (path = '', extensions = null, addToHistory = true) => {
    setLoading(true);
    try {
      const url = path
        ? `${API_BASE}/${path}?mode=json${extensions ? `&ext=${extensions}` : ''}`
        : `${API_BASE}?mode=json${extensions ? `&ext=${extensions}` : ''}`;

      const response = await fetch(url);
      const data = await response.json();

      if (data.type === 'directory') {
        const chonkyFiles = data.items.map(item => ({
          id: item.path,
          name: item.name,
          isDir: item.isDirectory,
          size: item.size,
          modDate: item.modified ? new Date(item.modified) : undefined,
          thumbnailUrl: item.isImage ? `http://localhost:3333${item.thumbnailUrl}` : undefined,
          _raw: item
        }));

        setFiles(chonkyFiles);

        if (addToHistory && !isNavigating.current && currentPath !== path) {
          historyStack.current.push(currentPath);
          forwardStack.current = [];
          updateHistoryState();
        }

        setCurrentPath(data.currentPath || '');
        setFolderChain(buildFolderChain(data.currentPath || ''));
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  }, [buildFolderChain, currentPath, updateHistoryState]);

  const handleGoBack = useCallback(() => {
    if (historyStack.current.length > 0) {
      const previousPath = historyStack.current.pop();
      forwardStack.current.push(currentPath);
      isNavigating.current = true;
      loadFiles(previousPath, getCurrentExtension(), false).then(() => {
        isNavigating.current = false;
        updateHistoryState();
      });
    }
  }, [currentPath, options.filterExtensions, loadFiles, updateHistoryState]);

  const handleGoForward = useCallback(() => {
    if (forwardStack.current.length > 0) {
      const nextPath = forwardStack.current.pop();
      historyStack.current.push(currentPath);
      isNavigating.current = true;
      loadFiles(nextPath, getCurrentExtension(), false).then(() => {
        isNavigating.current = false;
        updateHistoryState();
      });
    }
  }, [currentPath, options.filterExtensions, loadFiles, updateHistoryState]);

  const handleFileAction = useCallback((data) => {
    if (data.id === ChonkyActions.OpenFiles.id) {
      const { targetFile, files } = data.payload;
      const fileToOpen = targetFile ?? files[0];

      if (fileToOpen && fileToOpen.isDir) {
        if (fileToOpen.id === 'root' || fileToOpen.id === '') {
          loadFiles('', getCurrentExtension());
        } else {
          loadFiles(fileToOpen.id, getCurrentExtension());
        }
      } else if (fileToOpen && !options.multiSelect && options.mode === 'open') {
        handleConfirm();
        setOpen(false);
      } else if (fileToOpen && options.mode === 'save') {
        //Save 模式：双击文件自动填充文件名
        customComponentRef.current?.setFileName(fileToOpen.name);
      }
    } else if (data.id === ChonkyActions.ChangeSelection.id) {
      const selected = data.state.selectedFiles.filter(f => !f.isDir);
      setSelectedFiles(selected);

      //Save 模式：选择文件时自动填充文件名
      if (options.mode === 'save' && selected.length > 0) {
        customComponentRef.current?.setFileName(selected[0].name);
      }
    }
  }, [loadFiles, options.multiSelect, options.filterExtensions, options.mode]);

  const fileActions = useMemo(() => [
    ChonkyActions.SelectAllFiles,
    ChonkyActions.ClearSelection,
  ], []);

  const handleConfirm = () => {
    if (currentPath) {
      setDefaultPath({path: currentPath});
    }

    let resultData;

if (options.mode === 'save') {
      const { fileName } = customComponentRef.current?.getResultData?.();

      if (!fileName) {
        // 可以显示错误提示
        console.warn('Please enter a filename');
        return;
      }

      const fullPath = currentPath
        ? `${currentPath}/${fileName}`
        : fileName;

      resultData = [[{
        realPath: fullPath,
        name: fileName,
        isDirectory: false
      }]];
    } else {
      if (options.mode === 'save') {
      const { fileName, fileType } = customComponentRef.current?.getResultData?.() || {};
      let finalFileName = fileName;
      if (fileType && fileType !== '*') {
        const ext = fileType.startsWith('.') ? fileType : `.${fileType}`;
        if (!finalFileName.toLowerCase().endsWith(ext.toLowerCase())) {
          finalFileName = `${finalFileName}${ext}`;
        }
      }
      const fullPath = currentPath
        ? `${currentPath.replace(/[/\\]+$/, '')}/${finalFileName}`
        : finalFileName;

      resultData = [{
        path: fullPath,
        name: finalFileName,
        directory: currentPath,
        isDirectory: false
      }];
      } else {
        resultData = customComponentRef.current?.getResultData?.() || selectedFiles.map(f => f._raw);}
    }
    if (onSelectRef.current) {
      onSelectRef.current(resultData);
    }
    setOpen(false);
  };

  const shouldSkipConfirm = useCallback(() => {
    if (options.mode !== 'save') {
      return true;
    }
    const { fileName, fileType } = customComponentRef.current?.getResultData?.() || {};
    if (!fileName) return true;

    let finalFileName = fileName;
    if (fileType && fileType !== '*') {
      const ext = fileType.startsWith('.') ? fileType : `.${fileType}`;
      if (!finalFileName.toLowerCase().endsWith(ext.toLowerCase())) {
        finalFileName = `${finalFileName}${ext}`;
      }
    }

    const fileExists = files.some(f =>
      !f.isDir && f.name.toLowerCase() === finalFileName.toLowerCase()
    );

    return !fileExists;
  }, [options.mode, selectedFiles.length, files]);

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick') return;
        setOpen(false);
      }}
      className="FileBrowserDialog"
      fullWidth
      PaperProps={{
        sx: { height: 'calc(100% - 20px)', width: 'calc(100% - 20px)', maxWidth: '100%', maxHeight: '100%', margin: 0 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {options.title}
        <IconButton onClick={() => setOpen(false)} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <FileBrowser
            ref={fileBrowserRef}
            files={files}
            folderChain={folderChain}
            fileActions={fileActions}
            onFileAction={handleFileAction}
            iconComponent={ChonkyIconFA}
            disableDefaultFileActions={false}
            disableDragAndDrop={true}
            defaultSortActionId={null}
            disableSortActionId={true}
          >
            <CustomNavbar
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onBack={handleGoBack}
              onForward={handleGoForward}
            />
            <FileToolbar />
            <FileList />
            <FileContextMenu />
          </FileBrowser>
        </div>
      </DialogContent>

      <DialogActions>
        <FileOrganizer
          ref={customComponentRef}
          selectedFiles={selectedFiles}
          multiSelect={options.multiSelect}
          fileBrowserRef={fileBrowserRef}
          isDoubleSides={options.isDoubleSides}
          showFileIcon={options.showFileIcon}
          fileTypes={(options.filterExtensions??'').split(',').map(ext => ({ label: ext, value: ext }))}
          mode={options.mode}
          dialogConfim={handleConfirm}
          onFileTypeChange={(newFileType) => {
            if (options?.mode === 'save') {
              loadFiles(options.defaultPath, newFileType, false);
            }
          }}
          onFileNameChange={(fileName) => {
            setInputFileName(fileName);
          }}
        />
        <Divider orientation="vertical" flexItem />
        <Button onClick={() => {
          onSelectRef?.current?.([]);
          setOpen(false)
        }}>
          {t('button.cancel')}
        </Button>
        <ConfimButton
          confirmMessage={'文件已存在，是否覆盖？'}
          skipConfirm={shouldSkipConfirm()}
          onClick={handleConfirm}
          variant="contained"
          disabled={
            options.mode === 'save'
              ? inputFileName.length === 0  // save 模式下始终可点击
              : selectedFiles.length === 0  // open 模式下需要选中文件
          }
        >
          {options.mode === 'save' ? t('button.save') : t('button.ok')}
        </ConfimButton>
      </DialogActions>
    </Dialog>
  );
});
