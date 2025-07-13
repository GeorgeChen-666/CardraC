import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
// import { Box, Image, Spinner } from '@chakra-ui/react';
import './styles.css';
import { getMainImage } from '../../functions';
import { useGlobalStore } from '../../State/store';
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
  const [loading, setLoading] = useState(false);
  const [loc, setLoc] = useState('-10,-25');
  const [opacity, setOpacity] = useState(1);
  const getBoxStyle = () => {
    const [x, y] = loc.split(',');
    const ro = {};
    ro[x >= 0 ? 'left' : 'right'] = `${Math.abs(parseInt(x))}px`;
    ro[y >= 0 ? 'top' : 'bottom'] = `${Math.abs(parseInt(y))}px`;
    return ro;
  }
  const [imageData, setImageData] = useState(null);
  useImperativeHandle(ref, () => ({
    close: () => {
      setIsOpen(false);
      setPath('');
    },
    update: async (path = '') => {
      if(isShowOverView && path) {
        setPath(path);
        setImageData(null)
        setIsOpen(true);
      } else {
        setIsOpen(false);
        setPath('');
      }
    },
  }));
  const imageKey = path?.replaceAll?.('\\', '');
  useEffect(() => {
    setLoading(true);
    if(!imageKey) {
      setLoading(false);
      setIsOpen(false);
    }
    else {
      (async () => {
        const data = await getMainImage(path);
        setImageData(data);
        setLoading(false);
      })();
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
      borderWidth='1px'
      borderRadius='lg'
      opacity={opacity}
      style={getBoxStyle()}
    >
      {/*{loading && (<Spinner />)}*/}
      {!loading && (<Card sx={{ width: '100%', height: '100%', margin: '1px', padding: '1px' }}>
        <CardMedia
          component="img"
          className={'CardImage'}
          style={{ maxWidth: '346px', maxHeight: '346px', minWidth: '346px', minHeight: '346px'}}
          image={imageData}
        />
      </Card>)}
    </Box>);
  } else {
    return <></>;
  }

});

