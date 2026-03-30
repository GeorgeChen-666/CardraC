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
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import { useTranslation } from 'react-i18next';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { Divider } from '@mui/material';
import './FileBrowserDialog.css';
import { FileOrganizer } from './FileOrganizer';
import { withConfirmation } from '../componments/withConfirmation';
import { setDefaultPath, getDefaultPath, listDrives, browsePath } from '../functions';

console.debug = () => {};

const ConfimButton = withConfirmation(Button)

// 在 FileBrowserDialog 组件内部，return 之前添加

const CustomFileList = React.memo(({ files, selectedFiles, onFileClick, onFileDoubleClick }) => {
  const getFileIcon = (file) => {
    if (file.isDir) return <FolderIcon sx={{ color: '#ffd700' }} />;
    if (file.thumbnailUrl) return <ImageIcon sx={{ color: '#4fc3f7' }} />;
    return <InsertDriveFileIcon sx={{ color: '#90a4ae' }} />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
      <>
        {/* 表头 */}
        <div className="file-list-header">
          <div className="file-list-cell file-name-cell">名称</div>
          <div className="file-list-cell file-size-cell">大小</div>
          <div className="file-list-cell file-date-cell">修改日期</div>
        </div>

        {/* 文件列表内容 */}
        {files.length === 0 ? (
            <div className="file-list-empty">此文件夹为空</div>
        ) : (
            files.map((file) => {
              const isSelected = selectedFiles?.some?.(f => f?.id === file?.id) || false;

              return (
                  <div
                      key={file.id}
                      className={`file-list-row ${isSelected ? 'selected' : ''}`}
                      onClick={(e) => onFileClick(file, e)}
                      onDoubleClick={() => onFileDoubleClick(file)}
                  >
                    <div className="file-list-cell file-name-cell">
                      <div className="file-name-content">
                        {getFileIcon(file)}
                        <span className="file-name-text" title={file.name}>
                    {file.name}
                  </span>
                      </div>
                    </div>
                    <div className="file-list-cell file-size-cell">
                      {file.isDir ? '-' : formatFileSize(file.size)}
                    </div>
                    <div className="file-list-cell file-date-cell">
                      {formatDate(file.modDate)}
                    </div>
                  </div>
              );
            })
        )}
      </>
  );
});



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
  const [viewMode, setViewMode] = useState('list');
  const [options, setOptions] = useState({
    multiSelect: false,
    filterExtensions: null,
    title: 'Select Files',
    isDoubleSides: false,
    showFileIcon: false
  });

  const [quickAccessPaths, setQuickAccessPaths] = useState([
    { id: 'desktop', name: 'Desktop', icon: '🖥️', path: `${process.env.HOME}/Desktop` },
    { id: 'documents', name: 'Documents', icon: '📄', path: `${process.env.HOME}/Documents` },
    { id: 'downloads', name: 'Downloads', icon: '⬇️', path: `${process.env.HOME}/Downloads` },
    { id: 'pictures', name: 'Pictures', icon: '🖼️', path: `${process.env.HOME}/Pictures` },
  ]);

  const historyStack = useRef([]);
  const forwardStack = useRef([]);
  const onSelectRef = useRef(null);
  const customComponentRef = useRef(null);

  // 1. 在所有 useCallback 之前添加
  useImperativeHandle(ref, () => ({
    openDialog: async (newOptions = {}) => {
      const { onSelect, multiSelect = false, filterExtensions = null,
        title = 'Select Files', isDoubleSides = false,
        showFileIcon = false, mode = 'open' } = newOptions;

      onSelectRef.current = onSelect;
      const { path: defaultPath } = await getDefaultPath();

      setOptions({ defaultPath, multiSelect, filterExtensions,
        title, isDoubleSides, showFileIcon, mode });
      setOpen(true);

      historyStack.current = [];
      forwardStack.current = [];
      setCanGoBack(false);
      setCanGoForward(false);

      loadFiles(defaultPath, filterExtensions);
      setSelectedFiles([]);
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
      const { fileName } = customComponentRef.current?.getResultData?.();
      if (!fileName) {
        console.warn('Please enter a filename');
        return;
      }
      const fullPath = currentPath ? `${currentPath}/${fileName}` : fileName;
      resultData = [[{ realPath: fullPath, name: fileName, isDirectory: false }]];
    } else {
      resultData = customComponentRef.current?.getResultData?.() || selectedFiles.map(f => f._raw);
    }

    if (onSelectRef.current) {
      onSelectRef.current(resultData);
    }
    setOpen(false);
  };

  const shouldSkipConfirm = useCallback(() => {
    if (options.mode !== 'save') return true;
    const { fileName } = customComponentRef.current?.getResultData?.() || {};
    if (!fileName) return true;

    const fileExists = files.some(f => !f.isDir && f.name.toLowerCase() === fileName.toLowerCase());
    return !fileExists;
  }, [options.mode, files]);



// 修改 handleFileAction，改为自定义的点击处理
  const handleFileClick = useCallback((file, event) => {
    if (file.isDir) return; // 文件夹不参与选择

    if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd 多选
      setSelectedFiles(prev => {
        const exists = prev.some(f => f.id === file.id);
        if (exists) {
          return prev.filter(f => f.id !== file.id);
        } else {
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
        const rangeFiles = files.slice(start, end + 1).filter(f => !f.isDir);
        setSelectedFiles(rangeFiles);
      }
    } else {
      // 单选
      setSelectedFiles([file]);
    }

    // Save 模式自动填充文件名
    if (options.mode === 'save') {
      customComponentRef.current?.setFileName(file.name);
    }
  }, [files, selectedFiles, options.multiSelect, options.mode]);

  const handleFileDoubleClick = useCallback((file) => {
    if (file.isDir) {
      historyStack.current.push(currentPath);
      forwardStack.current = []; // 清空前进历史
      setCanGoBack(true);
      setCanGoForward(false);

      // 不自动添加历史记录
      loadFiles(file.id, getCurrentExtension(), false);
    } else {
      if (options.mode === 'open' && !options.multiSelect) {
        handleConfirm();
      } else if (options.mode === 'save') {
        customComponentRef.current?.setFileName(file.name);
      }
    }
  }, [currentPath, options.mode, options.multiSelect, getCurrentExtension]);

// ✅ GridFileList 只负责渲染内容，不包含滚动容器
  const GridFileList = React.memo(({ files, selectedFiles, onFileClick, onFileDoubleClick }) => {
    const getFileIcon = (file) => {
      if (file.isDir) return <FolderIcon sx={{ fontSize: 48, color: '#ffd700' }} />;
      if (file.thumbnailUrl) {
        return (
            <img
                src={file.thumbnailUrl}
                alt={file.name}
                style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
            />
        );
      }
      return <InsertDriveFileIcon sx={{ fontSize: 48, color: '#90a4ae' }} />;
    };

    if (files.length === 0) {
      return <div className="file-list-empty">此文件夹为空</div>;
    }

    return (
        <>
          {files.map((file) => {
            const isSelected = selectedFiles.some(f => f.id === file.id);

            return (
                <div
                    key={file.id}
                    className={`grid-file-item ${isSelected ? 'selected' : ''}`}
                    onClick={(e) => onFileClick(file, e)}
                    onDoubleClick={() => onFileDoubleClick(file)}
                >
                  <div className="grid-file-icon">
                    {getFileIcon(file)}
                  </div>
                  <div className="grid-file-name" title={file.name}>
                    {file.name}
                  </div>
                </div>
            );
          })}
        </>
    );
  });


  // ✅ 快捷访问栏组件（在 return 之前定义）
  const QuickAccessSidebar = ({ getCurrentExtension }) => (
      <div className="windows-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-title">快速访问</div>
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

        <div className="sidebar-section">
          <div className="sidebar-title">此电脑</div>
          <div
              className={`sidebar-item ${currentPath === '' ? 'active' : ''}`}
              onClick={() => {
                if (currentPath !== '') {
                  historyStack.current.push(currentPath);
                  forwardStack.current = [];
                  updateHistoryState();
                }
                loadFiles('', getCurrentExtension(), false);
              }}
          >
            <span className="sidebar-icon">💾</span>
            <span className="sidebar-label">所有驱动器</span>
          </div>
        </div>
      </div>
  );

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
              height: '80vh',
              maxHeight: '800px',
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
            <div className="windows-address-bar">
              {folderChain.map((folder, index) => (
                  <React.Fragment key={folder.id}>
                    <Button
                        sx={{ minWidth: '32px' }}
                        size="small"
                        onClick={() => {
                          const targetPath = folder.id === 'root' ? '' : folder.id;
                          if (targetPath !== currentPath) {
                            historyStack.current.push(currentPath);
                            forwardStack.current = [];
                            updateHistoryState();
                          }
                          loadFiles(targetPath, getCurrentExtension(), false);
                        }}
                        className="breadcrumb-button"
                    >
                      {folder.name}
                    </Button>
                    {index < folderChain.length - 1 && <span className="breadcrumb-separator">›</span>}
                  </React.Fragment>
              ))}
            </div>

            {/* ✅ 添加视图切换按钮 */}
            <div className="windows-view-buttons">
              <IconButton
                  size="small"
                  onClick={() => setViewMode('list')}
                  color={viewMode === 'list' ? 'primary' : 'default'}
                  title="列表视图"
              >
                <ViewListIcon fontSize="small" />
              </IconButton>
              <IconButton
                  size="small"
                  onClick={() => setViewMode('grid')}
                  color={viewMode === 'grid' ? 'primary' : 'default'}
                  title="图标视图"
              >
                <ViewModuleIcon fontSize="small" />
              </IconButton>
            </div>
          </div>

          {/* 主体区域 */}
          <div className="windows-main-area">
            {/* 左侧快捷访问 */}
            <QuickAccessSidebar getCurrentExtension={getCurrentExtension} />

            {/* 右侧文件列表 */}
            <div className="windows-file-area">
              {loading ? (
                  <div className="file-list-loading">加载中...</div>
              ) : (
                  // ✅ 滚动容器固定，根据 viewMode 切换类名
                  <div className={viewMode === 'list' ? 'file-list-container' : 'grid-file-list'}>
                    {viewMode === 'list' ? (
                        <CustomFileList
                            files={files}
                            selectedFiles={selectedFiles}
                            onFileClick={handleFileClick}
                            onFileDoubleClick={handleFileDoubleClick}
                        />
                    ) : (
                        <GridFileList
                            files={files}
                            selectedFiles={selectedFiles}
                            onFileClick={handleFileClick}
                            onFileDoubleClick={handleFileDoubleClick}
                        />
                    )}
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
              dialogConfim={handleConfirm}
              onFileTypeChange={(newFileType) => {
                if (options?.mode === 'save') {
                  loadFiles(currentPath, newFileType, false);
                }
              }}
              onFileNameChange={(fileName) => {
                setInputFileName(fileName);
              }}
          />

          <Divider orientation="vertical" flexItem />

          <Button onClick={() => {
            onSelectRef?.current?.([]);
            setOpen(false);
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
