import React, { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Box, Image } from '@chakra-ui/react';
import './styles.css';
import { callMain } from '../../functions';
import { eleActions } from '../../../public/constants';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';

export const ImageViewer = forwardRef((props, ref) => {
  const Global = useSelector((state) => (
    _.pick(state.pnp.Global, [
      'isShowOverView'
    ])
  ), shallowEqual);
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
  const { ImageStorage } = window;
  useImperativeHandle(ref, () => ({
    update: (path = '') => {
      if(Global.isShowOverView) {
        setIsOpen(true);
        setPath(path);
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
    else if (!Object.keys(ImageStorage).includes(imageKey)) {
      (async () => {
        ImageStorage[imageKey] = await callMain(eleActions.getImageContent, { path });
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
  if (isOpen) {
    return (<Box
      id={'ImageViewer'}
      onMouseOver={leaveMouse}
      onDragOver={leaveMouse}
      borderWidth='1px'
      borderRadius='lg'
      opacity={opacity}
      style={getBoxStyle()}
    >
      {loading}
      <Image className={'CardImage'}
             src={ImageStorage[imageKey]}

      />
    </Box>);
  } else {
    return <></>;
  }

});

