import Card from '@mui/material/Card';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import React, { useEffect, useRef, useState } from 'react';
import { useGlobalStore } from '../../../state/store';
import { openImageNew } from '../../../functions';
import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { layoutSides } from '../../../../shared/constants';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';

const MyCustomComponent = ({ selectedFiles, multiSelect = true }) => {
  const { Config } = useGlobalStore.selectors;
  const isDoubleSides = Config.sides() === layoutSides.doubleSides;
  const scrollRef = useRef(null);

  const [isLocked, setIsLocked] = useState(false);
  const [lockedFiles, setLockedFiles] = useState([]);

  // ✅ 使用 multiSelect prop 判断模式
  const isSingleSelect = !multiSelect;

  const handleWheel = (e) => {
    if (!scrollRef.current) return;
    e.preventDefault();
    scrollRef.current.scrollBy({ left: e.deltaY, behavior: 'auto' });
  };

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
    setLockedFiles(isLocked ? [] : [...selectedFiles]);
    setIsLocked(!isLocked);
  };

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
        onWheel={handleWheel}
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

              {/* ✅ 根据 multiSelect prop 显示文件名或序号 */}
              <Typography variant="caption" sx={{
                textAlign: 'center',
                fontSize: '11px',
                color: 'white',
                maxWidth: isDoubleSides ? 220 : 110,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: isSingleSelect ? 'normal' : 'nowrap',
                ...(isSingleSelect && {
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                })
              }}>
                {isSingleSelect
                  ? (pair.front?.name || pair.back?.name || '未选择文件')
                  : `#${i + 1}`
                }
              </Typography>
            </Box>
          );
        })}
      </Box>

      {isDoubleSides && multiSelect && (
        <FormControlLabel
          control={
            <Checkbox
              checked={isLocked}
              onChange={handleLockToggle}
              disabled={selectedFiles.length === 0}
              icon={<LockOpenIcon />}
              checkedIcon={<LockIcon />}
            />
          }
          label={<Typography variant="caption">{isLocked ? '已锁定' : '锁定'}</Typography>}
          sx={{ flexDirection: 'column', m: 0, gap: 0.5, minWidth: 70 }}
        />
      )}
    </Box>
  );
};


export default () => {
  const { t } = useTranslation();
  const {
    openImage, cardAdd
  } = useGlobalStore.getState();
  return <Card className={'Card'}>
    <IconButton className={'AddCardButton'}
                onClick={async () => {
                  // const imageData = await openMultiImage('CardAddByFaces');
                  // cardAdd(imageData);
                  openImageNew(MyCustomComponent);
                }}>
      <AddIcon fontSize="inherit" />
    </IconButton>
    <div>
      <Button
        fullWidth
        onClick={(e) => {
          e.stopPropagation();
          cardAdd([null])
        }}
      >
        {t('cardEditor.addEmpty')}
      </Button>
    </div>
  </Card>
}