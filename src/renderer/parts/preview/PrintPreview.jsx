import * as React from 'react';
import './styles.css';
import { useGlobalStore } from '../../state/store';
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';

export const PrintPreview = forwardRef((props, ref) => {
  const { getExportPreview } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const exportPageCount = Global.exportPageCount() || 0;
  const exportPreviewIndex = Global.exportPreviewIndex() || 1;
  const [imageData, setImageData] = useState(null);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const containerRef = useRef(null);
  const imageRef = useRef(null);

  const ZOOM_STEP = 0.1;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;

  // 计算适配容器的缩放比例和位置
  const fitToContainer = () => {
    if (!containerRef.current || !imageRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;

    // 获取图片原始尺寸
    const imgWidth = img.naturalWidth || imageSize.width;
    const imgHeight = img.naturalHeight || imageSize.height;

    if (!imgWidth || !imgHeight) return;

    // 计算缩放比例（取较小值以确保完整显示）
    const scaleX = container.width / imgWidth;
    const scaleY = container.height / imgHeight;
    const newScale = Math.min(scaleX, scaleY, 1); // 不超过原始大小

    // 计算居中位置
    const scaledWidth = imgWidth * newScale;
    const scaledHeight = imgHeight * newScale;
    const newX = (container.width - scaledWidth) / 2;
    const newY = (container.height - scaledHeight) / 2;

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  // 暴露给父组件的控制函数
  useImperativeHandle(ref, () => ({
    zoomIn: () => {
      setScale(prev => Math.min(prev + ZOOM_STEP, MAX_SCALE));
    },
    zoomOut: () => {
      setScale(prev => Math.max(prev - ZOOM_STEP, MIN_SCALE));
    },
    fitToContainer: fitToContainer,
    getScale: () => scale,
    canZoomIn: () => scale < MAX_SCALE,
    canZoomOut: () => scale > MIN_SCALE,
  }));

  // 鼠标滚轮缩放
  const handleWheel = (e) => {
    e.preventDefault();

    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const scaleRatio = newScale / scale;
      const newX = x - (x - position.x) * scaleRatio;
      const newY = y - (y - position.y) * scaleRatio;

      setPosition({ x: newX, y: newY });
    }

    setScale(newScale);
  };

  // 鼠标拖拽
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 图片加载完成
  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      // 图片加载后自动适配
      setTimeout(() => fitToContainer(), 0);
    }
  };

  // 监听全局鼠标事件
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart]);

  // 监听容器大小变化
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      fitToContainer();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageSize]);

  // 加载图片
  useEffect(() => {
    (async () => {
      if (exportPageCount > 0) {
        const data = await getExportPreview(exportPreviewIndex);
        setImageData(data);
      }
    })();
  }, [exportPreviewIndex, exportPageCount]);

  return (
    <div
      className="PrintPreviewContainer"
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: '100%',
      }}
    >
      {imageData ? (
        <img
          ref={imageRef}
          src={imageData}
          alt="Preview"
          className="CardImage"
          onLoad={handleImageLoad}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            maxWidth: 'none',
            maxHeight: 'none',
            width: imageSize.width || 'auto',
            height: imageSize.height || 'auto',
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            userSelect: 'none',
          }}
          draggable={false}
        />
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          color: '#999'
        }}>

        </div>
      )}
    </div>
  );
});

PrintPreview.displayName = 'PrintPreview';
