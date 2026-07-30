import { Box, Typography, TextField, FormControl, InputLabel, MenuItem } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import Button from '@mui/material/Button';
import { useTranslation } from 'react-i18next';

export const FileOrganizer = forwardRef(({
                                           selection,
                                           selectionActions,
                                           options,
                                           callbacks,
                                         }, ref) => {
  const { t } = useTranslation();
  const scrollRef = useRef(null);
  const [isLocked, setIsLocked] = useState(false);
  const prevSelectedFiles = useRef([]);

  const {
    selectedFiles = [],
    lockedFiles = [],
  } = selection || {};

  const {
    setSelectedFiles,
    setLockedFiles,
  } = selectionActions || {};

  const {
    multiSelect = true,
    isDoubleSides = false,
    showFileIcon = false,
    mode = 'open',
    defaultFileName = '',
    fileTypes = [{ label: 'All Files', value: '*' }],
  } = options || {};

  const initialFileType = fileTypes[0]?.value || '*';
  const prevFileNameRef = useRef(defaultFileName);
  const prevFileTypeRef = useRef(initialFileType);

  const {
    onFileNameChange,
    onFileTypeChange,
    onFileHover,
    onSubmit,
  } = callbacks || {};

  //Save 模式状态
  const [fileName, setFileName] = useState(defaultFileName);
  const [fileType, setFileType] = useState(initialFileType);

  //同步外部传入的默认文件名
  useEffect(() => {
    prevFileNameRef.current = defaultFileName;
    setFileName(defaultFileName);
  }, [defaultFileName]);

  useEffect(() => {
    prevFileTypeRef.current = initialFileType;
    setFileType(initialFileType);
  }, [initialFileType]);

  //文件名变化时通知父组件
  useEffect(() => {
    if (mode === 'save' && prevFileNameRef.current !== fileName && onFileNameChange) {
      prevFileNameRef.current = fileName;
      onFileNameChange(fileName);
    }
  }, [fileName, mode, onFileNameChange]);

  //文件类型变化时通知父组件
  useEffect(() => {
    if (mode === 'save' && prevFileTypeRef.current !== fileType && onFileTypeChange) {
      prevFileTypeRef.current = fileType;
      onFileTypeChange(fileType);
    }
  }, [fileType, mode, onFileTypeChange]);

  useImperativeHandle(ref, () => ({
    getResultData: () => {
      if (mode === 'save') {
        //Save 模式：返回文件名和类型
        return {
          fileName,
          fileType
        };
      }

      //Open 模式：返回选择的文件
      if (isDoubleSides) {
        let frontFiles, backFiles;
        if (isLocked) {
          frontFiles = lockedFiles;
          backFiles = selectedFiles;
        } else {
          frontFiles = selectedFiles;
          backFiles = [];
        }
        const maxLen = Math.max(frontFiles.length, backFiles.length);
        return Array.from({ length: maxLen }, (_, i) => [
          frontFiles[i]?._raw || null,
          backFiles[i]?._raw || null
        ]);
      } else {
        return selectedFiles.map(f => [f._raw || null]);
      }
    },
    //暴露设置文件名的方法
    setFileName: (name) => setFileName(name),
    fileType
  }));

  useEffect(() => {
    let shouldLimit = false;
    let limitedFiles = selectedFiles;

    //Save 模式不需要限制选择
    if (mode === 'save') {
      return;
    }

    if (shouldLimit) {
      const limitedIds = new Set(limitedFiles.map(f => f.id));
      setTimeout(() => {
        setSelectedFiles([...limitedIds])
        // fileBrowserRef.current?.setFileSelection(limitedIds, true);
      }, 0);
      return;
    }

    prevSelectedFiles.current = selectedFiles;
  }, [selectedFiles, isLocked, lockedFiles.length, isDoubleSides, multiSelect, mode, setSelectedFiles]);

  //鼠标滚轮横向滚动
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (e) => {
      e.preventDefault();
      const horizontalDelta = e.deltaX || e.deltaY;
      scrollElement.scrollBy({ left: horizontalDelta, behavior: 'auto' });
    };

    scrollElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollElement.removeEventListener('wheel', handleWheel);
    };
  }, []);

  //自动滚动到最新选择的文件
  useEffect(() => {
    if (!scrollRef.current || selectedFiles.length === 0) return;

    setTimeout(() => {
      if (!isLocked) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      } else {
        const lastBackIndex = selectedFiles.length - 1;
        if (lastBackIndex >= 0) {
          const itemWidth = isDoubleSides ? 220 : 110;
          const gap = 16;
          scrollRef.current.scrollLeft = (itemWidth + gap) * lastBackIndex;
        }
      }
    }, 100);
  }, [selectedFiles, isLocked, isDoubleSides]);

  const handleLockToggle = () => {
    if (!isLocked) {
      setLockedFiles([...selectedFiles]);
      setIsLocked(true);
      prevSelectedFiles.current = [];
      setSelectedFiles([])
    } else {
      setLockedFiles([]);
      setIsLocked(false);
      prevSelectedFiles.current = selectedFiles;
    }
  };

  //Save 模式：渲染文件名输入和类型选择
  if (mode === 'save') {
    return (
      <Box sx={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>
        <TextField
          label={t('fileBrowser.bottomBar.nameInputLabel')}
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          fullWidth
          size='small'
          autoFocus
          placeholder={t('fileBrowser.bottomBar.nameInputPlaceholder')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSubmit?.();
            }
          }}
        />
        <FormControl size="small" sx={{ width: 250 }} disabled={fileTypes?.length <= 1}>
          <InputLabel>{fileType}</InputLabel>
          <TextField
            disabled={fileTypes?.length <= 1}
            select size='small'
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            label={t('fileBrowser.bottomBar.extInputLabel')}
          >
            {fileTypes.map((option) => (
              <MenuItem key={option.value} value={option.value} style={{display: 'list-item'}}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </FormControl>
      </Box>
    );
  }

  //Open 模式：原有的文件选择器 UI
  const filePairs = (() => {
    if (!isDoubleSides || !isLocked) {
      return selectedFiles.map(file => ({ front: file, back: null }));
    }
    const maxLen = Math.max(lockedFiles.length, selectedFiles.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      front: lockedFiles[i] || null,
      back: selectedFiles[i] || null
    }));
  })();

  const FileSlot = ({ file, label, isNextToFill, onFileHover }) => (
    <Box
      onMouseEnter={() => onFileHover?.(file)}
      onMouseLeave={() => onFileHover?.(null)}
      sx={{
      width: 60,
      height: 60,
      border: '2px solid',
      borderColor: isNextToFill ? 'primary.main' : 'divider',
      borderRadius: 1,
      bgcolor: file ? 'grey.100' : 'grey.50',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      transition: 'border-color 0.3s ease',
      ...(isNextToFill && {
        boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.2)'
      })
    }}>
      {label && (
        <Typography variant="caption" sx={{
          position: 'absolute',
          top: 2,
          left: 2,
          bgcolor: 'rgba(0,0,0,0.6)',
          color: 'white',
          px: 0.5,
          borderRadius: 0.5,
          fontSize: '10px',
          zIndex: 1
        }}>
          {label}
        </Typography>
      )}
      {file?.thumbnailUrl ? (
        <img src={file.thumbnailUrl} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
      ) : file ? (
        <DescriptionIcon sx={{ fontSize: 40, color: 'grey.400' }} />
      ) : (
        <Typography variant="caption" color="text.secondary">
          {isNextToFill ? t('fileBrowser.bottomBar.slotLabelEmptyCurrent') : t('fileBrowser.bottomBar.slotLabelEmpty')}
        </Typography>
      )}
    </Box>
  );

  const FileNameText = ({ name }) => (
    <Typography
      variant="caption"
      title={name || t('fileBrowser.bottomBar.slotLabelEmpty')}
      sx={{
        textAlign: 'center',
        fontSize: '11px',
        color: 'white',
        width: 60,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: 'default'
      }}
    >
      {name || t('fileBrowser.bottomBar.slotLabelEmpty')}
    </Typography>
  );

  return (
    <Box className={`isDoubleSides_${isDoubleSides}`} sx={{p: 0, display: 'flex', alignItems: 'center', gap: 2, width: '100%', minWidth: 0 }}>
      <Box
        ref={scrollRef}
        sx={{
          p: 0,
          display: 'flex',
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: 0,
          scrollSnapType: 'x mandatory',
          '&::-webkit-scrollbar': { height: '8px' },
          '&::-webkit-scrollbar-thumb': { backgroundColor: '#888', borderRadius: '4px' }
        }}
      >
        {filePairs.map((pair, i) => {
          const firstEmptyBackIndex = filePairs.findIndex(p => p.front && !p.back);
          const isBackNextToFill = isDoubleSides && isLocked && i === firstEmptyBackIndex;

          return (
            <Box
              key={i}
              sx={{
                p: '4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: isDoubleSides ? 130 : 66,
                flexShrink: 0,
                gap: '4px',
                scrollSnapAlign: 'start'
              }}
            >
              {showFileIcon && (
                <Box sx={{ display: 'flex', gap: '4px', p: '4px', border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                  <FileSlot onFileHover={onFileHover} file={pair.front} label={isDoubleSides ? t('fileBrowser.bottomBar.face') : null} isNextToFill={false} />
                  {isDoubleSides && (
                    <FileSlot
                      onFileHover={onFileHover}
                      file={pair.back}
                      label={t('fileBrowser.bottomBar.back')}
                      isNextToFill={isBackNextToFill}
                    />
                  )}
                </Box>
              )}

              {isDoubleSides ? (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FileNameText name={pair.front?.name} />
                  <FileNameText name={pair.back?.name} />
                </Box>
              ) : (
                <FileNameText name={pair.front?.name} />
              )}
            </Box>
          );
        })}
      </Box>

      {isDoubleSides && multiSelect && (
        <Button
          variant={isLocked ? "contained" : "outlined"}
          color="primary"
          disabled={selectedFiles.length === 0}
          onClick={handleLockToggle}
        >
          <Box display={'flex'} flexDirection={'column'} alignItems={'center'}>
            {isLocked ? <LockIcon /> : <LockOpenIcon />}
            <Typography variant="caption">
              {isLocked ? t('fileBrowser.bottomBar.lockedOn') : t('fileBrowser.bottomBar.lockedOff')}
            </Typography>
          </Box>
        </Button>
      )}
    </Box>
  );
});
