import { useState, useEffect } from 'react';
import { getImageSrc } from '../../../functions';


export const useProgressiveImage = (imageData, version) => {
  const [src, setSrc] = useState(null);
  const [isHighQuality, setIsHighQuality] = useState(false);

  useEffect(() => {
    if (!imageData?.path) {
      setSrc(null);
      setIsHighQuality(false);
      return;
    }

    // ✅ 立即显示低清图
    const lowQualitySrc = getImageSrc(imageData, { quality: 'low', version });
    setSrc(lowQualitySrc);
    setIsHighQuality(false);

    // ✅ 后台加载高清图
    const highQualitySrc = getImageSrc(imageData, { quality: 'high', version });
    const img = new Image();

    img.onload = () => {
      setSrc(highQualitySrc);
      setIsHighQuality(true);
    };

    img.onerror = () => {
      console.warn('Failed to load high quality image:', imageData.path);
    };

    img.src = highQualitySrc;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [imageData?.path, imageData?.mtime, version]);

  return { src, isHighQuality };
};
