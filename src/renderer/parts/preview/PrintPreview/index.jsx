import * as React from 'react';
import './styles.css';
import { useGlobalStore } from '../../../state/store';
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { PrintDrawer } from '../../ToolBar/Print/PrintDrawer';
import { decodeSvg } from '../../../../shared/functions';
import { Ruler } from './Ruler';
import { ImageContextMenu } from './ImageContextMenu';
import { emptyImg } from '../../../../shared/constants';



export const PrintPreview = forwardRef((props, ref) => {
  const { getExportPreview, mergeGlobal } = useGlobalStore.getState();
  const { Global } = useGlobalStore.selectors;
  const exportPageCount = Global.exportPageCount() || 0;
  const exportPreviewIndex = Global.exportPreviewIndex() || 1;

  const [frame, setFrame] = useState(0);
  const [ready, setReady] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const drawerPrintRef = window.drawerPrintRef
  const isDrawerOpen = false; //const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [contextMenu, setContextMenu] = useState(null);

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
  }));

  const handleDoubleClick = () => {
    fitToContainer();
  };

  const handleWheel = (e) => {
    e.preventDefault();

    if (e.shiftKey) {
      if (e.deltaY < 0) {
        handlePageChange(exportPreviewIndex - 1);
      } else if (e.deltaY > 0) {
        handlePageChange(exportPreviewIndex + 1);
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

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const [svgContent, setSvgContent] = useState('');


  useEffect(() => {
    if (!isSvg || !svgRef.current) return;

    const svgElement = svgRef.current.querySelector('svg');
    if (!svgElement) return;

    const images = svgElement.querySelectorAll('image[data-card-mark]');

    images.forEach((img) => {
      const currentUrl = img.getAttribute('href');
      let isUnmounted = false;
      let retryTimeoutId = null;

      // ✅ 检查是否是 emptyImg
      const isEmptyImage = currentUrl === emptyImg.path;

      // ✅ 检查 URL 是否已经是高清
      const isAlreadyHigh = currentUrl.includes('quality=high');

      // ✅ 只有非空白图且不是高清的才加载高清
      if (!isEmptyImage && !isAlreadyHigh) {
        const loadHighQuality = (retryCount = 0) => {
          if (isUnmounted) return;

          const highQualityUrl = currentUrl.replace('quality=low', 'quality=high')
            .replace('quality=auto', 'quality=high');

          const testImg = new Image();

          testImg.onload = () => {
            if (!isUnmounted) {
              img.setAttribute('href', highQualityUrl);
              console.log(`✅ [HIGH] Loaded: ${img.dataset.cardMark}`);
            }
          };

          testImg.onerror = () => {
            if (!isUnmounted && retryCount < 10) {
              console.log(`⏳ [HIGH] Retry ${retryCount + 1}/10: ${img.dataset.cardMark}`);
              retryTimeoutId = setTimeout(() => loadHighQuality(retryCount + 1), 2000);
            }
          };

          testImg.src = highQualityUrl;
        };

        // 延迟加载高清
        retryTimeoutId = setTimeout(() => loadHighQuality(), 500);
      } else if (isAlreadyHigh) {
        console.log(`⚡ Already high quality: ${img.dataset.cardMark}`);
      }

      // ✅ 所有图片都添加事件监听器
      const handleContextMenuEvent = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
          top: e.clientY,
          left: e.clientX,
          imageElement: img
        });
      };

      const handleHoverEvent = (e) => {
        const mark = e.srcElement.dataset.cardMark;
        const allSameMarkDoms = document.querySelectorAll(`[data-card-mark="${mark}"]`);
        allSameMarkDoms.forEach(dom => dom.classList.toggle('mouseHover'));
      };

      img.addEventListener('contextmenu', handleContextMenuEvent);
      img.addEventListener('mouseenter', handleHoverEvent);
      img.addEventListener('mouseleave', handleHoverEvent);

      return () => {
        isUnmounted = true;
        if (retryTimeoutId) {
          clearTimeout(retryTimeoutId);
        }
        img.removeEventListener('contextmenu', handleContextMenuEvent);
        img.removeEventListener('mouseenter', handleHoverEvent);
        img.removeEventListener('mouseleave', handleHoverEvent);
      };
    });
  }, [svgContent, isSvg, exportPreviewIndex]);


  useEffect(() => {
    if (ready) {
      (async () => {
        const data = await getExportPreview(exportPreviewIndex);
        setImageData(data);

        if (data && data.includes('svg')) {
          const decoded = decodeSvg(data)
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
          setSvgContent(decoded);
        } else {
          setSvgContent('');
        }
      })();
    }
  }, [exportPreviewIndex, exportPageCount, ready, frame]);

  useEffect(() => {
    setReady(true);
    return async () => {
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

        <ImageContextMenu
          anchorPosition={contextMenu ? { top: contextMenu.top, left: contextMenu.left } : null}
          onClose={handleCloseContextMenu}
          imageElement={contextMenu?.imageElement}
          setFrame={setFrame}
        />
      </div>
    </>
  );
});

PrintPreview.displayName = 'PrintPreview';
