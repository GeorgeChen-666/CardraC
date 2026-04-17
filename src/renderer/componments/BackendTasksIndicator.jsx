// src/renderer/components/BackendTasksIndicator.jsx
import React, { useState } from 'react';
import {
  Box,
  Popover,
  LinearProgress,
  Typography,
  Stack,
  Chip,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useGlobalStore } from '../state/store';
import { useTranslation } from 'react-i18next';

export const BackendTasksIndicator = () => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const backendJobs = useGlobalStore(state => state.Global.backendJobs || {});

  // ✅ 获取可见的任务
  const visibleJobs = Object.entries(backendJobs)
    .filter(([_, job]) => job.visible)
    .map(([key, job]) => ({ key, ...job }));

  const primaryJob = visibleJobs[0];
  const hasMultipleTasks = visibleJobs.length > 1;

  if (!primaryJob) return null;

  const open = Boolean(anchorEl);

  return (
    <>
      {/* ✅ 默认显示的进度条 */}
      <Box
        onClick={(e) => hasMultipleTasks && setAnchorEl(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: hasMultipleTasks ? 'pointer' : 'default',
          padding: '4px 8px',
          borderRadius: 1,
          '&:hover': hasMultipleTasks ? { backgroundColor: 'action.hover' } : {},
          minWidth: 200,
          maxWidth: 300,
          position: 'relative',
        }}
      >
        <Typography variant="caption" noWrap sx={{ flex: 1, fontSize: '0.75rem' }}>
          {t(`backendJobs.${primaryJob.key}`, primaryJob.key)}
        </Typography>

        <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
          {(primaryJob.progress * 100).toFixed(0)}%
        </Typography>

        {hasMultipleTasks && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Chip label={visibleJobs.length} size="small" sx={{ height: 16, fontSize: '0.65rem' }} />
            {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </Box>
        )}

        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }}>
          <LinearProgress
            variant="determinate"
            value={primaryJob.progress * 100}
            sx={{ height: 2 }}
          />
        </Box>
      </Box>

      {/* ✅ 下拉面板 */}
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        PaperProps={{ sx: { width: 400, maxHeight: 300 } }}
      >
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" mb={2}>
            {t('backendJobs.title', 'Background Tasks')} ({visibleJobs.length})
          </Typography>
          <Stack spacing={2}>
            {visibleJobs.map((job) => (
              <Box key={job.key}>
                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" noWrap>
                    {t(`backendJobs.${job.key}`, job.key)}
                  </Typography>
                  <Typography variant="caption">
                    {(job.progress * 100).toFixed(1)}%
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={job.progress * 100} sx={{ height: 6 }} />
              </Box>
            ))}
          </Stack>
        </Box>
      </Popover>
    </>
  );
};
