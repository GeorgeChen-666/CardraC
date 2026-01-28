import React from 'react';
import { useGlobalStore } from '../state/store';
import Dialog from '@mui/material/Dialog';
import { DialogContent, DialogContentText } from '@mui/material';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';

export const LoadingModal = () => {
  const { Global } = useGlobalStore.selectors;
  const isLoading = Global.isLoading();
  const isInProgress = Global.isInProgress();
  const progress = Global.progress();
  const loadingText = Global.loadingText();
  return (<Dialog open={isLoading}>
    <DialogContent>
      <DialogContentText sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        width: '170px'
      }}>
        {isInProgress && (<Box sx={{ position: 'relative', display: 'inline-flex' }}>
          <CircularProgress variant="determinate" value={Math.round(progress)} />
          <Box
            sx={{
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              position: 'absolute',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="caption"
              component="div"
              sx={{ color: '#fff' }}
            >{`${Math.round(progress)}%`}</Typography>
          </Box>
        </Box>)}
        {!isInProgress && (<CircularProgress />)}
        <span>{loadingText}</span>
      </DialogContentText>
    </DialogContent>
  </Dialog>)
}