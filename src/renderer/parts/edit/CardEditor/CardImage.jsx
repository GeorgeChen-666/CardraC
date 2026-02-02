import React, { memo, useState, useEffect, useRef } from 'react';
import Card from '@mui/material/Card';
import { CardMedia } from '@mui/material';

export const CardImage = memo(({ imageSrc, path, isBackEditing, isFace }) => {
  const imageViewerRef = window.imageViewerRef;
  const [isVisible, setIsVisible] = useState(false);
  const imgRef = useRef(null);

  const size = (isBackEditing && isFace) || (!isBackEditing && !isFace) ? '160px' : '50px';

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <Card
      ref={imgRef}
      sx={{ minWidth: size, height: '100%', margin: '1px', padding: '1px' }}
    >
      {isVisible ? (
        <CardMedia
          component="img"
          className={'CardImage'}
          height={size}
          style={{ maxWidth: size }}
          image={imageSrc}
          onMouseOver={() => imageViewerRef.current?.update?.(path)}
          onMouseLeave={() => imageViewerRef.current?.close?.()}
        />
      ) : (
        <div style={{ width: size, height: size, background: '#f0f0f0' }} />
      )}
    </Card>
  );
}, (prev, next) => {
  return prev.imageSrc === next.imageSrc &&
    prev.isBackEditing === next.isBackEditing;
});
