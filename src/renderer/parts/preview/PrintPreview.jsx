import * as React from 'react';
import './styles.css';
import { useGlobalStore } from '../../state/store';
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { clearPreviewCache } from '../../functions';
import { PrintDrawer } from './ToolBar/Print/PrintDrawer';

const Ruler = ({ orientation, length }) => {
  const pixelsPerMM = 10;
  const majorTickInterval = 10;

  const ticks = [];
  const maxMM = Math.ceil(length / pixelsPerMM);

  for (let mm = 0; mm <= maxMM; mm++) {
    const position = mm * pixelsPerMM;
    const isMajor = mm % majorTickInterval === 0;

    ticks.push({
      position,
      mm,
      isMajor
    });
  }

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      style={{
        position: 'absolute',
        top: isHorizontal ? '-25px' : '0',
        left: isHorizontal ? '0' : '-25px',
        [isHorizontal ? 'width' : 'height']: `${length}px`,
        [isHorizontal ? 'height' : 'width']: '25px',
        backgroundColor: 'rgba(240, 240, 240, 0.9)',
        borderBottom: isHorizontal ? '1px solid #999' : 'none',
        borderRight: isHorizontal ? 'none' : '1px solid #999',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      {ticks.map((tick, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: `${tick.position}px`,
            [isHorizontal ? 'bottom' : 'right']: 0,
            [isHorizontal ? 'width' : 'height']: '1px',
            [isHorizontal ? 'height' : 'width']: tick.isMajor ? '10px' : '5px',
            backgroundColor: '#666'
          }}
        />
      ))}
      {ticks.filter(t => t.isMajor).map((tick, i) => (
        <div
          key={`label-${i}`}
          style={{
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: isHorizontal ? `${tick.position + 2}px` : `${tick.position + 8}px`,
            [isHorizontal ? 'top' : 'left']: '2px',
            fontSize: '10px',
            color: '#333',
            transform: isHorizontal ? 'none' : 'rotate(-90deg)',
            transformOrigin: isHorizontal ? 'none' : 'left top',
            whiteSpace: 'nowrap'
          }}
        >
          {tick.mm}
        </div>
      ))}
    </div>
  );
};

export const PrintPreview = forwardRef((props, ref) => {
  const drawerPrintRef = useRef(null);
  const { getExportPreview, setExportPreviewIndex, mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const exportPageCount = Global.exportPageCount() || 0;
  const exportPreviewIndex = Global.exportPreviewIndex() || 1;

  const [ready, setReady] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const svgRef = useRef(null);

  const isSvg = imageData && imageData.includes('svg');
  const ZOOM_STEP = 0.1;
  const MIN_SCALE = 0.1;
  const MAX_SCALE = 5;
  const DRAWER_WIDTH = 500;

  const handlePageChange = (page) => {
    mergeGlobal({ exportPreviewIndex: page });
  };

  const fitToContainer = () => {
    if (!containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();
    const imgWidth = imageRef.current?.naturalWidth || imageSize.width;
    const imgHeight = imageRef.current?.naturalHeight || imageSize.height;

    if (!imgWidth || !imgHeight) return;

    const rulerSize = isSvg ? 25 : 0;
    const drawerWidth = isDrawerOpen ? DRAWER_WIDTH : 0;
    const availableWidth = container.width - rulerSize - drawerWidth;
    const availableHeight = container.height - rulerSize;

    const scaleX = availableWidth / imgWidth;
    const scaleY = availableHeight / imgHeight;
    const newScale = Math.min(scaleX, scaleY);

    const scaledWidth = imgWidth * newScale;
    const scaledHeight = imgHeight * newScale;

    const newX = rulerSize + (availableWidth - scaledWidth) / 2;
    const newY = rulerSize + (availableHeight - scaledHeight) / 2;

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  useEffect(() => {
    if (imageSize.width && imageSize.height) {
      fitToContainer();
    }
  }, [isDrawerOpen, imageSize]);

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
    drawerPrintRef,
  }));

  const handleDoubleClick = () => {
    fitToContainer();
  };

  const handleWheel = (e) => {
    e.preventDefault();

    if (e.shiftKey) {
      if (e.deltaY < 0) {
        if (exportPreviewIndex > 1) {
          handlePageChange(exportPreviewIndex - 1);
        }
      } else if (e.deltaY > 0) {
        if (exportPreviewIndex < exportPageCount) {
          handlePageChange(exportPreviewIndex + 1);
        }
      }
      return;
    }

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

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const drawerElement = drawerPrintRef.current;
    if (drawerElement && e.target.closest('.print-drawer')) {
      return; // 如果点击在 Drawer 内，不处理拖拽
    }
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

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageSize({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight,
      });
      setTimeout(() => fitToContainer(), 0);
    }
  };

  useEffect(() => {
    if (isSvg && imageSize.width && imageSize.height) {
      setTimeout(() => fitToContainer(), 0);
    }
  }, [imageSize, isSvg]);

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

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      fitToContainer();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [imageSize, isDrawerOpen]);

  const [svgContent, setSvgContent] = useState('');

  const decodeSvg = (data) => {
    if (!data) return '';
    try {
      let decoded = '';
      if (data.startsWith('<svg')) {
        decoded = data;
      } else if (data.startsWith('data:image/svg+xml;charset=utf-8,')) {
        decoded = decodeURIComponent(data.replace('data:image/svg+xml;charset=utf-8,', ''));
      } else if (data.startsWith('data:image/svg+xml,')) {
        decoded = decodeURIComponent(data.replace('data:image/svg+xml,', ''));
      } else if (data.startsWith('data:image/svg+xml;base64,')) {
        const base64Data = data.replace('data:image/svg+xml;base64,', '');
        decoded = atob(base64Data);
      }
      if (decoded) {
        const widthMatch = decoded.match(/width="(\d+)"/);
        const heightMatch = decoded.match(/height="(\d+)"/);
        if (widthMatch && heightMatch) {
          setImageSize({
            width: parseInt(widthMatch[1]),
            height: parseInt(heightMatch[1])
          });
        }
      }
      return decoded;
    } catch (e) {
      console.error('Failed to decode SVG:', e);
    }
    return '';
  };

  useEffect(() => {
    if (!isSvg || !svgRef.current) return;

    const svgElement = svgRef.current.querySelector('svg');
    if (!svgElement) return;

    const images = svgElement.querySelectorAll('image[href^="cardrac://"]');

    images.forEach((img) => {
      const lowQualityUrl = img.getAttribute('href');
      const testImg = new Image();

      testImg.onload = () => {
        const highQualityUrl = lowQualityUrl.replace('quality=low', 'quality=high');
        setTimeout(() => {
          img.setAttribute('href', highQualityUrl);
        }, 100);
      };

      testImg.onerror = () => {
        console.error('Failed to load image:', lowQualityUrl);
      };

      testImg.src = lowQualityUrl;
    });
  }, [svgContent, isSvg]);

  useEffect(() => {
    if (ready) {
      (async () => {
        if (exportPageCount > 0) {
          const data = await getExportPreview(exportPreviewIndex);
          setImageData(data);

          if (data && data.includes('svg')) {
            setSvgContent(decodeSvg(data));
          } else {
            setSvgContent('');
          }
        }
      })();
    }
  }, [exportPreviewIndex, exportPageCount, ready]);

  useEffect(() => {
    setReady(true);
    return async () => {
      await clearPreviewCache();
      setReady(false);
    };
  }, []);

  return (
    <>
      <div
        className='PrintPreviewContainer'
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          overflow: 'hidden',
          position: 'relative',
          width: '100%',
          height: '100%'
        }}
      >
        {imageData ? (
          isSvg ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            >
              <Ruler orientation="horizontal" length={imageSize.width} />
              <Ruler orientation="vertical" length={imageSize.height} />

              <div
                ref={svgRef}
                dangerouslySetInnerHTML={{ __html: svgContent }}
                style={{
                  width: imageSize.width || 'auto',
                  height: imageSize.height || 'auto',
                  userSelect: 'none',
                }}
              />
            </div>
          ) : (
            <img
              ref={imageRef}
              src={imageData}
              alt='Preview'
              className='CardImage'
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
          )
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            color: '#999'
          }}>
            Loading...
          </div>
        )}
        <PrintDrawer
          ref={drawerPrintRef}
          onOpenChange={setIsDrawerOpen}
        />
      </div>
    </>
  );
});

PrintPreview.displayName = 'PrintPreview';
