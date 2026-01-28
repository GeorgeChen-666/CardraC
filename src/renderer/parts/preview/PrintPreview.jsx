import * as React from 'react';
import './styles.css';
import { useGlobalStore } from '../../state/store';
import { useEffect, useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { clearPreviewCache } from '../../functions';

export const PrintPreview = forwardRef((props, ref) => {
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

  const containerRef = useRef(null);
  const imageRef = useRef(null);
  const svgRef = useRef(null);

  const isSvg = imageData && imageData.includes('svg');
  const ZOOM_STEP = isSvg ? 2 : 0.1;
  const MIN_SCALE = isSvg ? 0.5 : 0.1;

  const MAX_SCALE = isSvg ? 40 : 5;

  const handlePageChange = (page) => {
    mergeGlobal({ exportPreviewIndex: page });
  };

  // 计算适配容器的缩放比例和位置
  const fitToContainer = () => {
    if (!containerRef.current) return;

    const container = containerRef.current.getBoundingClientRect();

    // 获取尺寸（img 用 naturalWidth，SVG 用 imageSize）
    const imgWidth = imageRef.current?.naturalWidth || imageSize.width;
    const imgHeight = imageRef.current?.naturalHeight || imageSize.height;

    if (!imgWidth || !imgHeight) return;

    const scaleX = container.width / imgWidth;
    const scaleY = container.height / imgHeight;
    const newScale = Math.min(scaleX, scaleY);

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

  const handleDoubleClick = () => {
    fitToContainer();
  };

  const handleWheel = (e) => {
    e.preventDefault();

    //Shift + 滚轮 = 切换页面
    if (e.shiftKey) {
      if (e.deltaY < 0) {
        // 向上滚 - 上一页
        if (exportPreviewIndex > 1) {
          handlePageChange(exportPreviewIndex - 1);
        }
      } else if (e.deltaY > 0) {
        // 向下滚 - 下一页
        if (exportPreviewIndex < exportPageCount) {
          handlePageChange(exportPreviewIndex + 1);
        }
      }
      return; //切换页面后不执行缩放
    }

    //添加缺失的缩放逻辑
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

  // 手动添加 wheel 事件监听器
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 添加非 passive 的监听器
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [scale, position]); // 依赖 scale 和 position

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
  //SVG 加载后触发适配
  useEffect(() => {
    if (isSvg && imageSize.width && imageSize.height) {
      setTimeout(() => fitToContainer(), 0);
    }
  }, [imageSize, isSvg]);

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


  const [svgContent, setSvgContent] = useState('');

  // 解码 SVG 内容
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
      //提取 SVG 尺寸并设置到 imageSize
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
  //SVG 加载后，将低清图片替换为高清
  useEffect(() => {
    if (!isSvg || !svgRef.current) return;

    const svgElement = svgRef.current.querySelector('svg');
    if (!svgElement) return;

    // 找到所有 cardrac:// 图片
    const images = svgElement.querySelectorAll('image[href^="cardrac://"]');

    images.forEach((img) => {
      const lowQualityUrl = img.getAttribute('href');

      // 创建一个临时 Image 对象测试加载
      const testImg = new Image();

      testImg.onload = () => {
        //低清图片加载成功，替换为高清
        const highQualityUrl = lowQualityUrl.replace('quality=low', 'quality=high');

        // 延迟替换，让低清图片先显示
        setTimeout(() => {
          img.setAttribute('href', highQualityUrl);
        }, 100);
      };

      testImg.onerror = () => {
        console.error('Failed to load image:', lowQualityUrl);
      };

      // 触发加载测试
      testImg.src = lowQualityUrl;
    });
  }, [svgContent, isSvg]);

  // 加载图片
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
      <div className='PrintPreviewContainer' ref={containerRef} onMouseDown={handleMouseDown} onDoubleClick={handleDoubleClick}
           style={{ cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden',
             position: 'relative', width: '100%', height: '100%' }}>
        {imageData ? (
          isSvg ? (
            <div
              ref={svgRef}
              dangerouslySetInnerHTML={{ __html: svgContent }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: imageSize.width || 'auto', //复用 imageSize
                height: imageSize.height || 'auto',
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                userSelect: 'none',
              }}
            />
          ) : (
            //非 SVG 使用 img 标签
            <img ref={imageRef} src={imageData} alt='Preview' className='CardImage'
                 onLoad={handleImageLoad}
                 style={{
                   position: 'absolute', top: 0, left: 0, maxWidth: 'none', maxHeight: 'none',
                   width: imageSize.width || 'auto', height: imageSize.height || 'auto',
                   transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                   transformOrigin: '0 0',
                   transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                   userSelect: 'none',
                 }}
                 draggable={false} />
          )
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', height: '100%', color: '#999' }}>
            Loading...
          </div>
        )}
      </div>
    </>

  );
});

PrintPreview.displayName = 'PrintPreview';
