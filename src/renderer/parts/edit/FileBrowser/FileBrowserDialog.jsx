import React, { useState, useCallback, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useTranslation } from 'react-i18next';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { Divider } from '@mui/material';
import './FileBrowserDialog.css';
import { FileOrganizer } from './FileOrganizer';
import { withConfirmation } from '../../../componments/withConfirmation';
import { setDefaultPath, getDefaultPath, listDrives, browsePath } from '../../../functions';
import { BreadcrumbBar } from './BreadcrumbBar';
import { FileGrid } from './FileGrid';
import { FileList } from './FileList';
import { homeDir, waitTime } from '../../../../shared/functions';

console.debug = () => {};

const ConfimButton = withConfirmation(Button)


export const FileBrowserDialog = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [currentPath, setCurrentPath] = useState('');
  const [files, setFiles] = useState([]);
  const [folderChain, setFolderChain] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [lockedFiles, setLockedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [inputFileName, setInputFileName] = useState('');
  const [viewMode, setViewMode] = useState('S');
  const [options, setOptions] = useState({
    multiSelect: false,
    filterExtensions: null,
    title: t('fileBrowser.defaultDialogTitle'),
    isDoubleSides: false,
    showFileIcon: false
  });

  const quickAccessPaths = useMemo(() => [
    { id: 'desktop', name: t('fileBrowser.quickAccess.desktop'), icon: '🖥️', path: `${homeDir}/Desktop` },
    { id: 'documents', name: t('fileBrowser.quickAccess.documents'), icon: '📄', path: `${homeDir}/Documents` },
    { id: 'downloads', name: t('fileBrowser.quickAccess.downloads'), icon: '⬇️', path: `${homeDir}/Downloads` },
    { id: 'pictures', name: t('fileBrowser.quickAccess.pictures'), icon: '🖼️', path: `${homeDir}/Pictures` },
  ], [t]);

  const historyStack = useRef([]);
  const forwardStack = useRef([]);
  const onSelectRef = useRef(null);
  const customComponentRef = useRef(null);
  const commitButtonRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openDialog: async (newOptions = {}) => {
      const { onSelect, multiSelect = false, filterExtensions = null,
        title = t('fileBrowser.defaultDialogTitle'), isDoubleSides = false,
        showFileIcon = false, mode = 'open' } = newOptions;

      onSelectRef.current = onSelect;


      setOptions({ multiSelect, filterExtensions,
        title, isDoubleSides, showFileIcon, mode });

      const { path: defaultPath } = await getDefaultPath();

      setOptions(lastOption => ({...lastOption,  defaultPath }));

      historyStack.current = [];
      forwardStack.current = [];
      setCanGoBack(false);
      setCanGoForward(false);

      loadFiles(defaultPath, filterExtensions);
      setSelectedFiles([]);
      setLockedFiles([]);
      setInputFileName('');
      setOpen(true);
    },
  }));
// 2. 添加缺失的函数
  const getCurrentExtension = useCallback(() => {
    return options.filterExtensions;
  }, [options.filterExtensions]);

  const buildFolderChain = useCallback((path) => {
    const chain = [{ id: 'root', name: '💾 All Drives', isDir: true }];
    if (!path) return chain;

    const parts = path.split(/[/\\]/).filter(Boolean);
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
      let data;

      if (!path) {
        // ✅ 列出驱动器
        data = await listDrives();
      } else {
        // ✅ 浏览路径
        const query = {};
        if (extensions) {
          query.ext = extensions;
        }
        if (options.sort) {
          query.sort = options.sort;
        }
        if (options.order) {
          query.order = options.order;
        }

        data = await browsePath({ path, query });
      }

      if (data.type === 'directory') {
        const chonkyFiles = data.items.map(item => ({
          id: item.path,
          name: item.name,
          isDir: item.isDirectory,
          size: item.size,
          modDate: item.modified ? new Date(item.modified) : undefined,
          thumbnailUrl: item.thumbnailUrl,
          _raw: item
        }));

        setFiles(chonkyFiles);
        setCurrentPath(data.currentPath || '');
        setFolderChain(buildFolderChain(data.currentPath || ''));
      } else if (data.type === 'file') {
        // ✅ 如果是文件，显示其所在目录
        console.warn('Selected a file, showing parent directory');
        const parentPath = data.path.substring(0, data.path.lastIndexOf('/'));
        loadFiles(parentPath, extensions, addToHistory);
      } else if (data.type === 'error') {
        console.error('Failed to load files:', data.message);
        triggerNotification({
          status: 'error',
          description: data.message
        });
      }
    } catch (error) {
      console.error('Failed to load files:', error);
      triggerNotification({
        status: 'error',
        description: 'Failed to load files'
      });
    } finally {
      setLoading(false);
    }
  }, [buildFolderChain, options.sort, options.order]);

  const handleGoBack = useCallback(() => {
    if (historyStack.current.length > 0) {
      const previousPath = historyStack.current.pop();
      forwardStack.current.push(currentPath);

      // ✅ 立即更新按钮状态
      setCanGoBack(historyStack.current.length > 0);
      setCanGoForward(true);

      loadFiles(previousPath, getCurrentExtension(), false);
    }
  }, [currentPath, loadFiles, getCurrentExtension]);

  const handleGoForward = useCallback(() => {
    if (forwardStack.current.length > 0) {
      const nextPath = forwardStack.current.pop();
      historyStack.current.push(currentPath);

      // ✅ 立即更新按钮状态
      setCanGoBack(true);
      setCanGoForward(forwardStack.current.length > 0);

      loadFiles(nextPath, getCurrentExtension(), false);
    }
  }, [currentPath, loadFiles, getCurrentExtension]);

  const handleConfirm = () => {
    if (currentPath) {
      setDefaultPath({ path: currentPath });
    }

    let resultData;
    if (options.mode === 'save') {
      const { fileName, fileType } = customComponentRef.current?.getResultData?.() || {};
      if (!fileName) {
        console.warn('Please enter a filename');
        return;
      }
      const fullPath = currentPath ? `${currentPath}/${fileName}.${fileType}` : fileName;
      resultData = [[{ realPath: fullPath, name: fileName, isDirectory: false }]];
    } else {
      resultData = customComponentRef.current?.getResultData?.() || selectedFiles.map(f => f._raw);
    }

    if (onSelectRef.current) {
      onSelectRef.current(resultData);
    }
    setOpen(false);
  };

  const skipConfirm = useMemo(() => {
    if (options.mode !== 'save') return true;
    if (!inputFileName) return true;

    const { fileType } = customComponentRef.current?.getResultData?.() || {};
    const fullName = `${inputFileName}.${fileType}`;

    const fileExists = files.some(f =>
      !f.isDir && f.name.toLowerCase() === fullName.toLowerCase()
    );

    return !fileExists;
  }, [options.mode, inputFileName, files]);  // ✅ 正确的依赖


  const handleFileClick = useCallback((file, event) => {
    if (file.isDir) return; // 文件夹不参与选择

    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd 多选
      setSelectedFiles(prev => {
        const exists = prev.some(f => f.id === file.id);
        if (exists) {
          // 取消选择
          return prev.filter(f => f.id !== file.id);
        } else {
          // ✅ 检查是否超过 lockedFiles 限制
          if (lockedFiles.length > 0 && prev.length >= lockedFiles.length) {
            console.warn(`最多只能选择 ${lockedFiles.length} 个文件`);
            return prev; // 不添加新文件
          }
          return options.multiSelect ? [...prev, file] : [file];
        }
      });
    } else if (event.shiftKey && selectedFiles.length > 0) {
      // Shift 范围选择
      const lastSelected = selectedFiles[selectedFiles.length - 1];
      const lastIndex = files.findIndex(f => f.id === lastSelected.id);
      const currentIndex = files.findIndex(f => f.id === file.id);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        let rangeFiles = files.slice(start, end + 1).filter(f => !f.isDir);

        // ✅ 限制范围选择数量
        if (lockedFiles.length > 0 && rangeFiles.length > lockedFiles.length) {
          rangeFiles = rangeFiles.slice(0, lockedFiles.length);
          console.warn(`最多只能选择 ${lockedFiles.length} 个文件`);
        }

        setSelectedFiles(rangeFiles);
      }
    } else {
      // 单选
      setSelectedFiles([file]);
    }

    // Save 模式自动填充文件名
    if (options.mode === 'save') {
      customComponentRef.current?.setFileName(file.name.replace(/\.[^.]+$/, ''));
    }
  }, [files, selectedFiles, options.multiSelect, options.mode, lockedFiles]);

  const handleFileDoubleClick = useCallback((file) => {
    if (file.isDir) {
      historyStack.current.push(currentPath);
      forwardStack.current = []; // 清空前进历史
      setCanGoBack(true);
      setCanGoForward(false);

      // 不自动添加历史记录
      loadFiles(file.id, getCurrentExtension(), false);
    } else {
      if (options.mode === 'open') {
        commitButtonRef.current?.click();
      } else if (options.mode === 'save') {
        customComponentRef.current?.setFileName(file.name.replace(/\.[^.]+$/, ''));
        commitButtonRef.current?.click();
      }
    }
  }, [currentPath, options.mode, options.multiSelect, getCurrentExtension]);


  const QuickAccessSidebar = ({ getCurrentExtension }) => (
      <div className="windows-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-title">{t('fileBrowser.quickAccess.title')}</div>
          {quickAccessPaths.map(item => (
              <div
                  key={item.id}
                  className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
                  onClick={() => {
                    if (item.path !== currentPath) {
                      historyStack.current.push(currentPath);
                      forwardStack.current = [];
                      updateHistoryState();
                    }
                    loadFiles(item.path, getCurrentExtension(), false);
                  }}
              >
                <span className="sidebar-icon">{item.icon}</span>
                <span className="sidebar-label">{item.name}</span>
              </div>
          ))}
        </div>

      </div>
  );

  const handleNavigate = useCallback((targetPath) => {
    if (targetPath !== currentPath) {
      historyStack.current.push(currentPath);
      forwardStack.current = [];
      updateHistoryState();
    }
    loadFiles(targetPath, getCurrentExtension(), false);
  }, [currentPath, loadFiles, getCurrentExtension, updateHistoryState]);

  return (
      <Dialog
          open={open}
          onClose={(event, reason) => {
            if (reason === 'backdropClick') return;
            setOpen(false);
          }}
          className="FileBrowserDialog windows-style"
          fullWidth
          maxWidth="lg"
          PaperProps={{
            sx: {
              width: '90vw',
              height: '80vh',
              maxWidth: '90vw',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column'
            }
          }}
      >
        {/* 标题栏 */}
        <DialogTitle sx={{
          p: 1.5,
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span style={{ fontSize: '14px' }}>{options.title}</span>
          <IconButton onClick={() => setOpen(false)} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* 主内容区 */}
        <DialogContent sx={{ p: '0!important', display: 'flex', overflowY: 'hidden', flexDirection: 'column', flex: 1 }}>
          {/* 顶部工具栏 */}
          <div className="windows-toolbar">
            <div className="windows-nav-buttons">
              <IconButton size="small" onClick={handleGoBack} disabled={!canGoBack}>
                <ArrowBackIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={handleGoForward} disabled={!canGoForward}>
                <ArrowForwardIcon fontSize="small" />
              </IconButton>
            </div>

            {/* 地址栏 */}
            <BreadcrumbBar
              folderChain={folderChain}
              currentPath={currentPath}
              onNavigate={handleNavigate}
              maxVisible={4}
            />

            {/* ✅ 添加视图切换按钮 */}
            <div className="windows-view-buttons">
              <IconButton
                disabled={viewMode === 'list'}
                  size="small"
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  title={t('fileBrowser.dialogListView')}
              >
                <ViewListIcon fontSize="small" />
              </IconButton>
              {['S','M','L'].map(size => {
                const modeName = size;
                return (<IconButton
                  key={'icon-size' + size}
                  disabled={viewMode === modeName}
                  size="small"
                  onClick={() => setViewMode(modeName)}
                  color={viewMode === modeName ? 'primary' : 'default'}
                  title={`${t('fileBrowser.dialogIconView')} - ${size}`}
                >
                  <Badge
                    badgeContent={size}
                    anchorOrigin={{
                      vertical: 'bottom',
                      horizontal: 'right',
                    }}
                    sx={{
                      '& .MuiBadge-badge': {
                        fontSize: '10px',
                        color: viewMode === modeName ? 'rgba(255, 255, 255, 0.5)' : 'white',
                        fontWeight: 'bold',
                      }
                    }}
                  >
                    <ViewModuleIcon fontSize="small" />
                  </Badge>
                </IconButton>)
              })}

            </div>
          </div>

          {/* 主体区域 */}
          <div className="windows-main-area">
            {/* 左侧快捷访问 */}
            <QuickAccessSidebar getCurrentExtension={getCurrentExtension} />

            {/* 右侧文件列表 */}
            <div className="windows-file-area">
              {loading ? (
                  <div className="file-list-loading">{t('fileBrowser.loading')}</div>
              ) : (
                <div className={`${viewMode === 'list' ? 'file-list-container' : `grid-file-list size-${viewMode}`}`}>
                  {viewMode === 'list' && <FileList
                    files={files}
                    selectedFiles={selectedFiles}
                    onFileClick={handleFileClick}
                    onFileDoubleClick={handleFileDoubleClick}
                  />}
                  {['S', 'M', 'L'].includes(viewMode) && <FileGrid
                    size={viewMode}
                    files={files}
                    selectedFiles={selectedFiles}
                    onFileClick={handleFileClick}
                    onFileDoubleClick={handleFileDoubleClick}
                  />}
                </div>
              )}
            </div>
          </div>
        </DialogContent>

        {/* 底部操作栏 */}
        <DialogActions sx={{
          p: '6px',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}>
          <FileOrganizer
              ref={customComponentRef}
              selectedFiles={selectedFiles}
              setSelectedFiles={setSelectedFiles}
              multiSelect={options.multiSelect}
              isDoubleSides={options.isDoubleSides}
              showFileIcon={options.showFileIcon}
              fileTypes={(options.filterExtensions ?? '').split(',').map(ext => ({
                label: ext,
                value: ext
              }))}
              mode={options.mode}
              onFileTypeChange={(newFileType) => {
                if (options?.mode === 'save') {
                  loadFiles(currentPath, newFileType, false);
                }
              }}
              onFileNameChange={(fileName) => {
                setInputFileName(fileName);
              }}
              lockedFiles = {lockedFiles}
              setLockedFiles = {setLockedFiles}
          />

          <Divider orientation="vertical" flexItem />

          <Button onClick={() => {
            onSelectRef?.current?.([]);
            setOpen(false);
          }}>
            {t('button.cancel')}
          </Button>

          <ConfimButton
              ref={commitButtonRef}
              confirmMessage={t('fileBrowser.existConfirm')}
              skipConfirm={skipConfirm}
              onClick={handleConfirm}
              variant="contained"
              disabled={
                options.mode === 'save'
                    ? inputFileName.length === 0
                    : selectedFiles.length === 0
              }
          >
            {options.mode === 'save' ? t('button.save') : t('button.ok')}
          </ConfimButton>
        </DialogActions>
      </Dialog>
  );
});
