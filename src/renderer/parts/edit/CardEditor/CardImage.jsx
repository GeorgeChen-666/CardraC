// src/renderer/parts/edit/CardEditor/CardImage.jsx

import React, { memo, useState, useEffect, useRef } from 'react';
import Card from '@mui/material/Card';
import { CardMedia } from '@mui/material';
import { useUiRuntimeStore } from '../../../state/uiRuntimeStore';

export const CardImage = memo(({ imageSrc, path, isBackEditing, isFace }) => {
  const imageViewerApi = useUiRuntimeStore(state => state.imageViewerApi);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef(null);

  const size = (isBackEditing && isFace) || (!isBackEditing && !isFace) ? '50px' : '160px';

  //简化：只处理错误状态
  useEffect(() => {
    if (!imageSrc) {
      setImageError(true);
      return;
    }

    setImageError(false);

    // 预加载图片以检测错误
    const img = new Image();
    img.onerror = () => setImageError(true);
    img.src = imageSrc;

    return () => {
      img.onerror = null;
    };
  }, [imageSrc]);

  return (
    <Card
      ref={imgRef}
      sx={{
        minWidth: size,
        height: '100%',
        margin: '1px',
        padding: '1px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fafafa'
      }}
    >
      {imageError ? (
        // 错误状态
        <div style={{
          width: size,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '12px'
        }}>
        </div>
      ) : (
        //直接渲染图片，浏览器自动处理加载
        <CardMedia
          component="img"
          className={'CardImage'}
          data-testid={isFace ? 'card-face-image' : 'card-back-image'}
          height={size}
          style={{ maxWidth: size, objectFit: 'contain' }}
          image={imageSrc}
          onError={() => setImageError(true)}
          onMouseOver={() => imageViewerApi?.update?.(path)}
          onMouseLeave={() => imageViewerApi?.close?.()}
        />
      )}
    </Card>
  );
}, (prev, next) => {
  return prev.imageSrc === next.imageSrc &&
    prev.isBackEditing === next.isBackEditing &&
    prev.path === next.path;
});
