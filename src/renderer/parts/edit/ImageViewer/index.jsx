import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import './styles.css';
import { useGlobalStore } from '../../../state/store';
import Card from '@mui/material/Card';
import { CardMedia } from '@mui/material';
import Box from '@mui/material/Box';

export const ImageViewer = forwardRef((props, ref) => {
  const { Global } = useGlobalStore.selectors;
  const isShowOverView = Global.isShowOverView();
  const [frame, setFrame] = useState(0);
  const framePlus1 = useRef(() => {});
  framePlus1.current = useCallback(() => setFrame(frame + 1), [frame, setFrame]);
  const [isOpen, setIsOpen] = useState(false);
  const [path, setPath] = useState('');
  const [loc, setLoc] = useState('-17,-28');
  const getBoxStyle = () => {
    const [x, y] = loc.split(',');
    const ro = {};
    ro[x >= 0 ? 'left' : 'right'] = `${Math.abs(parseInt(x))}px`;
    ro[y >= 0 ? 'top' : 'bottom'] = `${Math.abs(parseInt(y))}px`;
    return ro;
  }
  useImperativeHandle(ref, () => ({
    close: () => {
      setIsOpen(false);
      setPath('');
    },
    update: async (path = '') => {
      if(isShowOverView && path) {
        setPath(path);
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setPath('');
      }
    },
  }));
  const imageKey = path?.replaceAll?.('\\', '');
  useEffect(() => {
    if(!imageKey) {
      setIsOpen(false);
    }
  }, [imageKey]);

  const leaveMouse = (e) => {
    let [x, y] = loc.split(',');
    const rect = e.target.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    if (mx < e.target.offsetWidth / 2 || mx > e.target.offsetWidth / 2) {
      x = x * -1;
    }
    // if (my < e.target.offsetHeight / 2 || my > e.target.offsetHeight / 2) {
    //   y = y * -1;
    // }
    setLoc(`${x},${y}`);
  }
  if (isOpen && isShowOverView) {
    return (<Box
      id={'ImageViewer'}
      onMouseOver={leaveMouse}
      onDragOver={leaveMouse}
      // borderWidth='1px'
      borderRadius='lg'
      style={getBoxStyle()}
    >
      {/*{loading && (<Spinner />)}*/}
      <Card sx={{ width: '100%', height: '100%', margin: '1px', padding: '1px' }}>
        <CardMedia
          component="img"
          className={'CardImage'}
          style={{ maxWidth: '346px', maxHeight: '346px', minWidth: '346px', minHeight: '346px'}}
          image={`cardrac://image/${imageKey}?quality=high`}
        />
      </Card>
    </Box>);
  } else {
    return <></>;
  }

});

