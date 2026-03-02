import { Box, Typography } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import { layoutSides } from '../../shared/constants';
import { useGlobalStore } from '../state/store';
import React, { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
import Button from '@mui/material/Button';

export const FileOrganizer = forwardRef(({
                                        selectedFiles,
                                        multiSelect = true,
                                        fileBrowserRef
                                      }, ref) => {
  const { Config } = useGlobalStore.selectors;
  const isDoubleSides = Config.sides() === layoutSides.doubleSides || Config.sides() === layoutSides.foldInHalf;
  const scrollRef = useRef(null);

  const [isLocked, setIsLocked] = useState(false);
  const [lockedFiles, setLockedFiles] = useState([]);
  const prevSelectedFiles = useRef([]);

  useImperativeHandle(ref, () => ({
    getResultData: () => {
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
        return Array.from({ length: maxLen }, (_, i) => ({
          face: frontFiles[i]?._raw || null,
          back: backFiles[i]?._raw || null
        }));
      } else {
        return selectedFiles.map(f => ({
          face: f._raw || null
        }));
      }
    }
  }));

  useEffect(() => {
    if (isLocked && isDoubleSides) {
      const maxAllowed = lockedFiles.length;

      if (selectedFiles.length > maxAllowed) {
        console.warn(`最多只能选择 ${maxAllowed} 个背面文件，已自动限制`);
        const limitedFiles = selectedFiles.slice(0, maxAllowed);
        const limitedIds = new Set(limitedFiles.map(f => f.id));
        setTimeout(() => {
          fileBrowserRef.current?.setFileSelection(limitedIds, true);
        }, 0);
        return;
      }
    }

    // 保存当前有效的选择
    prevSelectedFiles.current = selectedFiles;
  }, [selectedFiles, isLocked, lockedFiles.length, isDoubleSides, fileBrowserRef]);

  // ✅ 鼠标滚轮横向滚动
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

  // ✅ 自动滚动到最新选择的文件
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

  // ✅ 锁定/解锁切换
  const handleLockToggle = () => {
    if (!isLocked) {
      // 锁定：保存当前选择为正面，清空选择
      setLockedFiles([...selectedFiles]);
      setIsLocked(true);
      prevSelectedFiles.current = [];
      fileBrowserRef.current?.setFileSelection(new Set(), true);
    } else {
      // 解锁：清空锁定的文件
      setLockedFiles([]);
      setIsLocked(false);
      prevSelectedFiles.current = selectedFiles;
    }
  };

  // ✅ 生成文件配对
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

  // ✅ 文件槽组件
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