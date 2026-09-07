import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import BrokenImageOutlinedIcon from '@mui/icons-material/BrokenImageOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined';
import { useTranslation } from 'react-i18next';
import { checkImage, openImage } from '../../../functions';
import { useGlobalStore } from '../../../state/store';
import { expandPath, imagePathToImageSrc } from '../../../../shared/functions';

const getFileName = (filePath = '') => {
  try {
    const url = new URL(filePath);
    return decodeURIComponent(url.pathname.split('/').pop() || '');
  } catch (e) {
    return String(filePath).replace(/\\/g, '/').split('/').pop() || '';
  }
};

const getFileDirectory = (filePath = '') => {
  const fileName = getFileName(filePath);
  return fileName ? String(filePath).replace(fileName, '') : filePath;
};

const applyResolvedPaths = ({ Config, CardList, replacements }) => {
  const applyPath = (image) => {
    const lookupPath = expandPath(image?.path);
    const newPath = replacements[lookupPath];
    if (image && image.path && newPath) {
      image.path = newPath;
      delete image.mtime;
    }
  };

  applyPath(Config.globalBackground);
  CardList.forEach(card => {
    applyPath(card.face);
    applyPath(card.back);
  });
};

const getNextPendingPath = (paths, replacements, currentPath) => {
  if (!Array.isArray(paths) || paths.length === 0) return '';
  const currentIndex = Math.max(paths.indexOf(currentPath), 0);
  const orderedPaths = [...paths.slice(currentIndex + 1), ...paths.slice(0, currentIndex + 1)];
  return orderedPaths.find(path => !replacements[path]) || currentPath;
};

const previewFrameSx = {
  mt: 1.5,
  flex: 1,
  borderRadius: 1,
  border: '1px dashed rgba(255,255,255,0.18)',
  display: 'flex',
  backgroundColor: 'rgba(255,255,255,0.02)',
  p: 2,
  minWidth: 0,
  overflow: 'hidden'
};

const previewContentSx = {
  flex: 1,
  borderRadius: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  minWidth: 0,
  minHeight: 0,
  overflow: 'hidden'
};

export const ReloadSmartDialog = forwardRef(({}, ref) => {
  const { t } = useTranslation();
  const { Config: configSelector, CardList: cardListSelector } = useGlobalStore.selectors;
  const { mergeState, reloadLocalImage } = useGlobalStore.getState();
  const currentConfig = configSelector();
  const currentCardList = cardListSelector();
  const [open, setOpen] = useState(false);
  const [invalidImages, setInvalidImages] = useState([]);
  const [newImagePath, setNewImagePath] = useState({});
  const [selectedPath, setSelectedPath] = useState('');
  const [searchText, setSearchText] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [originalPreviewError, setOriginalPreviewError] = useState(false);

  useImperativeHandle(ref, () => ({
    openDialog: (paths = []) => {
      const list = Array.isArray(paths) ? paths : [];
      setInvalidImages(list);
      setNewImagePath({});
      setSearchText('');
      setPendingOnly(false);
      setSelectedPath(list[0] || '');
      setOpen(true);
    },
  }));

  const rows = useMemo(() => invalidImages.map(path => ({
    path,
    fileName: getFileName(path),
    newPath: newImagePath[path] || '',
    resolved: Boolean(newImagePath[path]),
  })), [invalidImages, newImagePath]);

  const filteredRows = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();
    return rows.filter(row => {
      if (pendingOnly && row.resolved) return false;
      if (!keyword) return true;
      return row.path.toLowerCase().includes(keyword) || row.fileName.toLowerCase().includes(keyword);
    });
  }, [pendingOnly, rows, searchText]);

  useEffect(() => {
    if (!open) return;
    if (filteredRows.some(row => row.path === selectedPath)) return;
    setSelectedPath(filteredRows[0]?.path || rows[0]?.path || '');
  }, [filteredRows, open, rows, selectedPath]);

  useEffect(() => {
    setOriginalPreviewError(false);
  }, [selectedPath]);

  const selectedRow = filteredRows.find(row => row.path === selectedPath)
    || rows.find(row => row.path === selectedPath)
    || null;

  const resolvedCount = rows.filter(row => row.resolved).length;
  const pendingCount = rows.length - resolvedCount;

  const chooseReplacement = async () => {
    if (!selectedRow?.path) return;

    const result = await openImage();
    const replacementPath = result?.[0]?.face?.path;
    if (!replacementPath) return;

    const targetPath = selectedRow.path;
    const updates = { [targetPath]: replacementPath };
    const targetName = getFileName(targetPath);
    const replacementName = getFileName(replacementPath);

    if (targetName && targetName === replacementName) {
      const replaceFrom = getFileDirectory(targetPath);
      const replaceTo = getFileDirectory(replacementPath);
      const unresolvedPaths = invalidImages.filter(path => !newImagePath[path] && path !== targetPath);
      const inferredPathList = unresolvedPaths.map(path => path.replace(replaceFrom, replaceTo));
      const invalidResult = inferredPathList.length > 0 ? await checkImage({ pathList: inferredPathList }) : [];
      const invalidSet = new Set(invalidResult.map(path => expandPath(path)));

      unresolvedPaths.forEach((path, index) => {
        const inferredPath = inferredPathList[index];
        if (inferredPath && !invalidSet.has(expandPath(inferredPath))) {
          updates[path] = inferredPath;
        }
      });
    }

    const nextReplacements = { ...newImagePath, ...updates };
    setNewImagePath(nextReplacements);
    setSelectedPath(getNextPendingPath(invalidImages, nextReplacements, targetPath));
  };

  const clearCurrent = () => {
    if (!selectedRow?.path) return;
    setNewImagePath(last => {
      const next = { ...last };
      delete next[selectedRow.path];
      return next;
    });
  };

  const clearResolved = () => {
    setNewImagePath({});
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleApply = () => {
    const Config = {
      ...currentConfig,
      globalBackground: currentConfig.globalBackground ? { ...currentConfig.globalBackground } : null,
    };
    const CardList = currentCardList.map(card => ({
      ...card,
      face: card.face ? { ...card.face } : null,
      back: card.back ? { ...card.back } : null,
    }));

    applyResolvedPaths({ Config, CardList, replacements: newImagePath });
    mergeState({ Config, CardList });
    setOpen(false);
    reloadLocalImage();
  };

  return (
    <Dialog
      fullWidth
      maxWidth='xl'
      PaperProps={{
        sx: {
          height: 'min(760px, calc(100vh - 64px))',
        }
      }}
      open={open}
      onClose={(event, reason) => {
        if (reason === 'backdropClick') return;
        handleClose();
      }}
    >
      <DialogTitle>{t('configDialog.reloadImageWorkbench')}</DialogTitle>
      <DialogContent sx={{ px: 2, py: 2, overflow: 'hidden', display: 'flex' }}>
        <Stack direction='row' spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <Paper
            variant='outlined'
            sx={{
              flex: '0 1 320px',
              width: 'clamp(220px, 32%, 380px)',
              minWidth: 220,
              maxWidth: 380,
              borderColor: 'rgba(255,255,255,0.12)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Box sx={{ p: 2, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                <Chip
                  size='small'
                  label={t('configDialog.reloadImageSummary', { resolved: resolvedCount, total: rows.length })}
                  sx={{ color: '#c9cdd3' }}
                />
                <Chip
                  size='small'
                  color='warning'
                  variant='outlined'
                  label={t('configDialog.reloadImagePendingCount', { count: pendingCount })}
                  sx={{ color: '#c9cdd3' }}
                />
                <Chip
                  size='small'
                  color='success'
                  variant='outlined'
                  label={t('configDialog.reloadImageResolvedCount', { count: resolvedCount })}
                  sx={{ color: '#c9cdd3' }}
                />
              </Stack>
              <TextField
                fullWidth
                size='small'
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                label={t('configDialog.reloadImageSearch')}
                sx={{ mt: 1.5 }}
              />
              <Stack direction='row' spacing={1} sx={{ mt: 1.5 }}>
                <Button
                  size='small'
                  variant={pendingOnly ? 'contained' : 'outlined'}
                  onClick={() => setPendingOnly(last => !last)}
                  sx={{
                    '&.Mui-disabled': {
                      color: '#9aa0a6',
                    },
                    '&.Mui-disabled .MuiButton-startIcon svg, &.Mui-disabled .MuiButton-endIcon svg': {
                      color: '#9aa0a6',
                    }
                  }}
                >
                  {t('configDialog.reloadImagePendingOnly')}
                </Button>
                <Button
                  size='small'
                  variant='outlined'
                  startIcon={<CleaningServicesOutlinedIcon />}
                  onClick={clearResolved}
                  disabled={resolvedCount === 0}
                  sx={{
                    '&.Mui-disabled': {
                      color: '#9aa0a6',
                    },
                    '&.Mui-disabled .MuiButton-startIcon svg, &.Mui-disabled .MuiButton-endIcon svg': {
                      color: '#9aa0a6',
                    }
                  }}
                >
                  {t('configDialog.reloadImageClearResolved')}
                </Button>
              </Stack>
            </Box>

            <Box sx={{ overflowY: 'auto', flex: 1 }}>
              {filteredRows.length === 0 && (
                <Box sx={{ p: 3, color: 'text.secondary' }}>
                  {t('configDialog.reloadImageNoMatch')}
                </Box>
              )}
              {filteredRows.map((row, index) => (
                <Box
                  key={row.path}
                  onClick={() => setSelectedPath(row.path)}
                  sx={{
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    backgroundColor: row.path === selectedPath ? 'rgba(255,255,255,0.08)' : 'transparent',
                    '&:hover': { backgroundColor: 'rgba(255,255,255,0.05)' }
                  }}
                >
                  <Stack direction='row' spacing={1.25} alignItems='flex-start'>
                    {row.resolved ? (
                      <CheckCircleOutlineIcon color='success' fontSize='small' sx={{ mt: 0.25 }} />
                    ) : (
                      <RadioButtonUncheckedIcon color='warning' fontSize='small' sx={{ mt: 0.25 }} />
                    )}
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Stack direction='row' spacing={1} alignItems='center'>
                        <Typography variant='body2' sx={{ fontWeight: 600 }}>
                          {index + 1}. {row.fileName || t('configDialog.reloadImageUnnamed')}
                        </Typography>
                        <Chip
                          size='small'
                          color={row.resolved ? 'success' : 'warning'}
                          variant='outlined'
                          label={row.resolved ? t('configDialog.reloadImageResolved') : t('configDialog.reloadImagePending')}
                        />
                      </Stack>
                      <Typography variant='caption' sx={{ display: 'block', mt: 0.75, opacity: 0.78, wordBreak: 'break-all' }}>
                        {row.path}
                      </Typography>
                      {row.newPath && (
                        <Typography variant='caption' sx={{ display: 'block', mt: 0.75, color: '#7ddc8b', wordBreak: 'break-all' }}>
                          {row.newPath}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Paper>

          <Box sx={{ flex: '1 1 0', minWidth: 280, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden' }}>
            <Paper
              variant='outlined'
              sx={{
                borderColor: 'rgba(255,255,255,0.12)',
                p: 2,
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant='subtitle2'>{t('configDialog.reloadImageCurrentPath')}</Typography>
                  <Typography variant='body2' sx={{ mt: 1, wordBreak: 'break-all', opacity: 0.85 }}>
                    {selectedRow?.path || t('configDialog.reloadImageNoSelection')}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant='subtitle2'>{t('configDialog.reloadImageNewPath')}</Typography>
                  <Typography variant='body2' sx={{ mt: 1, wordBreak: 'break-all', color: selectedRow?.newPath ? '#7ddc8b' : 'rgba(255,255,255,0.6)' }}>
                    {selectedRow?.newPath || t('configDialog.reloadImageNotAssigned')}
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ my: 2 }} />
              <Stack direction='row' spacing={1} flexWrap='wrap' useFlexGap>
                <Button
                  variant='contained'
                  startIcon={<SearchIcon />}
                  onClick={chooseReplacement}
                  disabled={!selectedRow}
                >
                  {t('configDialog.reloadImageChooseReplacement')}
                </Button>
                <Button
                  variant='outlined'
                  startIcon={<RestartAltIcon />}
                  onClick={clearCurrent}
                  disabled={!selectedRow?.newPath}
                  sx={{
                    '&.Mui-disabled': {
                      color: '#9aa0a6',
                    },
                    '&.Mui-disabled .MuiButton-startIcon svg, &.Mui-disabled .MuiButton-endIcon svg': {
                      color: '#9aa0a6',
                    }
                  }}
                >
                  {t('configDialog.reloadImageClearCurrent')}
                </Button>
              </Stack>
              <Typography variant='caption' sx={{ display: 'block', mt: 1.5, opacity: 0.75 }}>
                {t('configDialog.reloadImageAutoMatchHint')}
              </Typography>
            </Paper>

            <Stack direction='row' spacing={2} sx={{ flex: 1, minHeight: 0 }}>
              <Paper
                variant='outlined'
                sx={{
                  flex: 1,
                  minWidth: 0,
                  borderColor: 'rgba(255,255,255,0.12)',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                <Typography variant='subtitle2'>{t('configDialog.reloadImageOriginalPreview')}</Typography>
                <Box
                  sx={previewFrameSx}
                >
                  {selectedRow?.path && !originalPreviewError ? (
                    <Tooltip title={selectedRow.path}>
                      <Box
                        sx={previewContentSx}
                      >
                        <img
                          src={imagePathToImageSrc(selectedRow.path, { quality: 'high' })}
                          alt={selectedRow.fileName}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
                            display: 'block',
                            objectFit: 'contain'
                          }}
                          onError={() => setOriginalPreviewError(true)}
                        />
                      </Box>
                    </Tooltip>
                  ) : (
                    <Box sx={{ ...previewContentSx, textAlign: 'center' }}>
                      <BrokenImageOutlinedIcon sx={{ fontSize: 72, opacity: 0.7 }} />
                      <Typography variant='body2' sx={{ mt: 1 }}>
                        {t('configDialog.reloadImageOriginalMissing')}
                      </Typography>
                      <Typography variant='caption' sx={{ mt: 1, display: 'block', opacity: 0.7 }}>
                        {selectedRow?.fileName || t('configDialog.reloadImageNoSelection')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>

              <Paper
                variant='outlined'
                sx={{
                  flex: 1,
                  minWidth: 0,
                  borderColor: 'rgba(255,255,255,0.12)',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 0,
                  overflow: 'hidden',
                }}
              >
                <Typography variant='subtitle2'>{t('configDialog.reloadImageReplacementPreview')}</Typography>
                <Box
                  sx={previewFrameSx}
                >
                  {selectedRow?.newPath ? (
                    <Tooltip title={selectedRow.newPath}>
                      <Box
                        sx={previewContentSx}
                      >
                        <img
                          src={imagePathToImageSrc(selectedRow.newPath, { quality: 'low' })}
                          alt={selectedRow.fileName}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
                            display: 'block',
                            objectFit: 'contain'
                          }}
                        />
                      </Box>
                    </Tooltip>
                  ) : (
                    <Box sx={{ ...previewContentSx, textAlign: 'center' }}>
                      <SearchIcon sx={{ fontSize: 64, opacity: 0.7 }} />
                      <Typography variant='body2' sx={{ mt: 1 }}>
                        {t('configDialog.reloadImageReplacementEmpty')}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={handleClose}>{t('button.cancel')}</Button>
        <Button
          onClick={handleApply}
          variant='contained'
          disabled={resolvedCount === 0}
          sx={{
            '&.Mui-disabled': {
              color: '#9aa0a6',
            }
          }}
        >
          {t('configDialog.reloadImageApply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
});
