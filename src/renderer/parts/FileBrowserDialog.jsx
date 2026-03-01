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
import './FileBrowserDialog.css'

console.debug = () => {}

const API_BASE = 'http://localhost:3333/browse';

// ✅ 获取默认路径
const getDefaultPath = async () => {
  try {
    const response = await fetch(`${API_BASE}/default-path`);
    const data = await response.json();
    return data.path || '';
  } catch (error) {
    console.error('Failed to get default path:', error);
    return '';
  }
};

// ✅ 保存默认路径
const saveDefaultPath = async (path) => {
  try {
    await fetch(`${API_BASE}/default-path`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path })
    });
  } catch (error) {
    console.error('Failed to save default path:', error);
  }
};

const CustomNavbar = ({ canGoBack, canGoForward, onBack, onForward }) => {
  return (
    <div style={{ display: 'flex' }}>
      <div className={'chonky-navbarWrapper'}>
        <Button
          size='small'
          onClick={onBack}
          disabled={!canGoBack}
          className={'chonky-baseButton chonky-iconOnlyButton '}
          title='后退'
        >
          <ArrowBackIcon fontSize='small' />
        </Button>
        <Button
          size='small'
          onClick={onForward}
          disabled={!canGoForward}
          className={'chonky-baseButton chonky-iconOnlyButton '}
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

  const [multiSelect, setMultiSelect] = useState(false);
  const [filterExtensions, setFilterExtensions] = useState(null);
  const [title, setTitle] = useState('Select Files');

  const historyStack = useRef([]);
  const forwardStack = useRef([]);
  const isNavigating = useRef(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  const onSelectRef = React.useRef(null);

  useImperativeHandle(ref, () => ({
    openDialog: async (options = {}) => {
      const {
        onSelect,
        multiSelect = false,
        filterExtensions = null,
        title = 'Select Files'
      } = options;

      onSelectRef.current = onSelect;
      setMultiSelect(multiSelect);
      setFilterExtensions(filterExtensions);
      setTitle(title);
      setOpen(true);

      historyStack.current = [];
      forwardStack.current = [];
      setCanGoBack(false);
      setCanGoForward(false);

      // ✅ 获取并加载默认路径
      const defaultPath = await getDefaultPath();
      loadFiles(defaultPath, filterExtensions);
      setSelectedFiles([]);
    },
  }));

  const buildFolderChain = useCallback((currentPath) => {
    const chain = [];

    chain.push({
      id: 'root',
      name: '💾 All Drives',
      isDir: true
    });

    if (!currentPath) {
      return chain;
    }

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

        if (addToHistory && !isNavigating.current) {
          if (currentPath !== path) {
            historyStack.current.push(currentPath);
            forwardStack.current = [];
            updateHistoryState();
          }
        }

        setCurrentPath(data.currentPath || '');
        setFolderChain(buildFolderChain(data.currentPath || ''));
      }
    } catch (error) {
      console.error('❌ Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  }, [buildFolderChain, currentPath, updateHistoryState]);

  const handleGoBack = useCallback(() => {
    if (historyStack.current.length > 0) {
      const previousPath = historyStack.current.pop();
      forwardStack.current.push(currentPath);
      isNavigating.current = true;
      loadFiles(previousPath, filterExtensions, false).then(() => {
        isNavigating.current = false;
        updateHistoryState();
      });
    }
  }, [currentPath, filterExtensions, loadFiles, updateHistoryState]);

  const handleGoForward = useCallback(() => {
    if (forwardStack.current.length > 0) {
      const nextPath = forwardStack.current.pop();
      historyStack.current.push(currentPath);
      isNavigating.current = true;
      loadFiles(nextPath, filterExtensions, false).then(() => {
        isNavigating.current = false;
        updateHistoryState();
      });
    }
  }, [currentPath, filterExtensions, loadFiles, updateHistoryState]);

  const handleFileAction = useCallback((data) => {
    if (data.id === ChonkyActions.OpenFiles.id) {
      const { targetFile, files } = data.payload;
      const fileToOpen = targetFile ?? files[0];

      if (fileToOpen && fileToOpen.isDir) {
        if (fileToOpen.id === 'root' || fileToOpen.id === '') {
          loadFiles('', filterExtensions);
        } else {
          loadFiles(fileToOpen.id, filterExtensions);
        }
      } else if (fileToOpen && !multiSelect) {
        if (onSelectRef.current) {
          onSelectRef.current([fileToOpen._raw]);
        }
        setOpen(false);
      }
    } else if (data.id === ChonkyActions.ChangeSelection.id) {
      const selected = data.state.selectedFiles;
      setSelectedFiles(selected.filter(f => !f.isDir));
    }
  }, [loadFiles, multiSelect, filterExtensions]);

  const fileActions = useMemo(() => [
    ChonkyActions.SelectAllFiles,
    ChonkyActions.ClearSelection,
  ], []);

  const handleConfirm = async () => {
    // ✅ 保存当前路径
    if (currentPath) {
      await saveDefaultPath(currentPath);
    }

    const rawFiles = selectedFiles.map(f => f._raw);
    if (onSelectRef.current) {
      onSelectRef.current(rawFiles);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick') {
          return;
        }
        setOpen(false);
      }}
      className="FileBrowserDialog"
      fullWidth
      PaperProps={{
        sx: { height: 'calc(100% - 20px)', width: 'calc(100% - 20px)', maxWidth: '100%', maxHeight: '100%', margin: 0 }
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        <IconButton onClick={() => setOpen(false)} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, minHeight: 0 }}>
          <FileBrowser
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
        <div style={{ flex: 1, paddingLeft: 16, color: '#666' }}>
          {selectedFiles.length > 0 && (
            <span>Selected: {selectedFiles.length} file(s)</span>
          )}
        </div>
        <Button onClick={() => setOpen(false)}>
          {t('button.cancel')}
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={selectedFiles.length === 0}
        >
          {t('button.select')} ({selectedFiles.length})
        </Button>
      </DialogActions>
    </Dialog>
  );
});
