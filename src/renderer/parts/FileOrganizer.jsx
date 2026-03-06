import { Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import Button from '@mui/material/Button';

export const FileOrganizer = forwardRef(({
                                           selectedFiles,
                                           multiSelect = true,
                                           isDoubleSides = false,
                                           showFileIcon = false,
                                           fileBrowserRef,
                                           //新增 Save 模式参数
                                           mode = 'open', // 'open' | 'save'
                                           defaultFileName = '',
                                           fileTypes = [{ label: 'All Files', value: '*' }],
                                           onFileNameChange,
                                           onFileTypeChange,
                                           dialogConfim
                                         }, ref) => {
  const scrollRef = useRef(null);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedFiles, setLockedFiles] = useState([]);
  const prevSelectedFiles = useRef([]);

  //Save 模式状态
  const [fileName, setFileName] = useState(defaultFileName);
  const [fileType, setFileType] = useState(fileTypes[0]?.value || '*');

  //同步外部传入的默认文件名
  useEffect(() => {
    setFileName(defaultFileName);
  }, [defaultFileName]);

  //文件名变化时通知父组件
  useEffect(() => {
    if (mode === 'save' && onFileNameChange) {
      onFileNameChange(fileName);
    }
  }, [fileName, mode]);

  //文件类型变化时通知父组件
  useEffect(() => {
    if (mode === 'save' && onFileTypeChange) {
      onFileTypeChange(fileType);
    }
  }, [fileType, mode]);

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

    //单选模式：只能选择一个文件
    if (!multiSelect && selectedFiles.length > 1) {
      console.warn('单选模式下只能选择一个文件，已自动限制');
      limitedFiles = selectedFiles.slice(-1);
      shouldLimit = true;
    }
    //双面锁定模式：背面不能超过正面
    else if (isLocked && isDoubleSides) {
      const maxAllowed = lockedFiles.length;

      if (selectedFiles.length > maxAllowed) {
        console.warn(`最多只能选择 ${maxAllowed} 个背面文件，已自动限制`);
        limitedFiles = selectedFiles.slice(0, maxAllowed);
        shouldLimit = true;
      }
    }

    if (shouldLimit) {
      const limitedIds = new Set(limitedFiles.map(f => f.id));
      setTimeout(() => {
        fileBrowserRef.current?.setFileSelection(limitedIds, true);
      }, 0);
      return;
    }

    prevSelectedFiles.current = selectedFiles;
  }, [selectedFiles, isLocked, lockedFiles.length, isDoubleSides, multiSelect, fileBrowserRef, mode]);

  //鼠标滚轮横向滚动
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const handleWheel = (e) => {
      e.preventDefault();
      scrollElement.scrollBy({ left: e.deltaY, behavior: 'auto' });
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
      fileBrowserRef.current?.setFileSelection(new Set(), true);
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
          label="File Name"
          value={fileName}
          onChange={(e) => setFileName(e.target.value)}
          fullWidth
          size='small'
          autoFocus
          placeholder="Enter file name..."
        />
        <FormControl size="small" sx={{ width: 250 }} disabled={fileTypes?.length <= 1}>
          <InputLabel>{fileType}</InputLabel>
          <TextField
            disabled={fileTypes?.length <= 1}
            select size='small'
            value={fileType}
            onChange={(e) => setFileType(e.target.value)}
            label="File Type"
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

  const FileSlot = ({ file, label, isNextToFill }) => (
    <Box sx={{
      width: 100,
      height: 100,
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
        <img src={file.thumbnailUrl} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : file ? (
        <DescriptionIcon sx={{ fontSize: 40, color: 'grey.400' }} />
      ) : (
        <Typography variant="caption" color="text.secondary">
          {isNextToFill ? '待填充' : '空'}
        </Typography>
      )}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', minWidth: 0 }}>
      <Box
        ref={scrollRef}
        sx={{
          display: 'flex',
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          gap: 2,
          py: 1,
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
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: isDoubleSides ? 220 : 110,
                flexShrink: 0,
                gap: 1,
                scrollSnapAlign: 'start'
              }}
            >
              {showFileIcon && (
                <Box sx={{ display: 'flex', gap: 1, p: 1, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
                  <FileSlot file={pair.front} label={isDoubleSides ? '正面' : null} isNextToFill={false} />
                  {isDoubleSides && (
                    <FileSlot
                      file={pair.back}
                      label="背面"
                      isNextToFill={isBackNextToFill}
                    />
                  )}
                </Box>
              )}

              {!isDoubleSides && (
                <Typography
                  variant="caption"
                  title={pair.front?.name || '未选择文件'}
                  sx={{
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'white',
                    width: 100,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'default'
                  }}
                >
                  {pair.front?.name || '未选择文件'}
                </Typography>
              )}

              {isDoubleSides && (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Typography
                    variant="caption"
                    title={pair.front?.name || '空'}
                    sx={{
                      textAlign: 'center',
                      fontSize: '11px',
                      color: 'white',
                      width: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default'
                    }}
                  >
                    {pair.front?.name || '空'}
                  </Typography>
                  <Typography
                    variant="caption"
                    title={pair.back?.name || '空'}
                    sx={{
                      textAlign: 'center',
                      fontSize: '11px',
                      color: 'white',
                      width: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      cursor: 'default'
                    }}
                  >
                    {pair.back?.name || '空'}
                  </Typography>
                </Box>
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
              {isLocked ? '已锁定' : '锁定正面'}
            </Typography>
          </Box>
        </Button>
      )}
    </Box>
  );
});
