// src/renderer/components/BackendTasksIndicator.jsx
import React, { useState } from 'react';
import {
  Box,
  Popover,
  LinearProgress,
  Typography,
  Stack,
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

  const visibleJobs = Object.entries(backendJobs)
    .filter(([_, job]) => job.visible && job.progress > 0 && job.progress < 1)
    .map(([key, job]) => ({ key, ...job }));

  const primaryJob = visibleJobs[0];
  const hasMultipleTasks = visibleJobs.length > 1;

  if (!primaryJob) return null;

  const averageProgress = hasMultipleTasks
    ? visibleJobs.reduce((sum, job) => sum + (job.progress || 0), 0) / visibleJobs.length
    : primaryJob.progress;

  const open = Boolean(anchorEl);

  return (
    <>
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
        {open ? (
          <Typography variant="caption" sx={{ flex: 1, fontSize: '0.75rem' }}>
            {t('footer.backendJobs.title', { num: visibleJobs.length })}
          </Typography>
        ) : (
          <>
            <Typography variant="caption" noWrap sx={{ flex: 1, fontSize: '0.75rem' }}>
              {hasMultipleTasks
                ? t('footer.backendJobs.multipleTasks', '多个后台任务...')
                : t(`footer.backendJobs.${primaryJob.key}`, primaryJob.key)
              }
            </Typography>

            <Typography variant="caption" sx={{ fontSize: '0.7rem', opacity: 0.7 }}>
              {(averageProgress * 100).toFixed(0)}%
            </Typography>

            <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2 }}>
              <LinearProgress
                variant="determinate"
                value={averageProgress * 100}
                sx={{ height: 2 }}
              />
            </Box>
          </>
        )}
        {open && (
          <ExpandLessIcon fontSize="small" />
        )}
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center'
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        PaperProps={{ sx: { width: 400, maxHeight: 300 } }}
      >
        <Box sx={{ p: 2 }}>
          <Stack spacing={2}>
            {visibleJobs.map((job) => (
              <Box key={job.key}>
                <Stack direction="row" justifyContent="space-between" mb={0.5}>
                  <Typography variant="body2" noWrap>
                    {t(`footer.backendJobs.${job.key}`, job.key)}
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
