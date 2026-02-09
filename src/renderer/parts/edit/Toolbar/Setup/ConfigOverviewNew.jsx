import React, { useEffect, useRef, useState } from 'react';
import { useGlobalStore } from '../../../../state/store';
import { decodeSvg } from '../../../../../shared/functions';
import { shallow } from 'zustand/shallow';
import { clearPreviewCache } from '../../../../functions';

export const ConfigOverviewNew = () => {
  const { getExportPreview } = useGlobalStore.getState();
  const [imageData, setImageData] = useState(null);
  const [svgContent, setSvgContent] = useState(null);
  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const [scale, setScale] = useState(1);
  const containerRef = useRef(null);

  const Config = useGlobalStore(state => state.Config, shallow);

  const calculateScale = () => {
    if (!containerRef.current || !svgSize.width || !svgSize.height) return;

    const container = containerRef.current.getBoundingClientRect();
    const scaleX = container.width / svgSize.width;
    const scaleY = container.height / svgSize.height;
    const newScale = Math.min(scaleX, scaleY) * 0.9;
    setScale(newScale);
  };

  //处理 SVG 中的特定图片 URL
  const processSvgImages = (svgString) => {
    if (!svgString) return svgString;

    // 创建临时 DOM 解析 SVG
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // 查找所有 image 元素
    const images = doc.querySelectorAll('image');

    images.forEach(img => {
      const href = img.getAttribute('href') || img.getAttribute('xlink:href');

      if (href && decodeURIComponent(href).startsWith('cardrac://image/data:image/png;base64')) {
        const x = img.getAttribute('x');
        const y = img.getAttribute('y');
        const width = img.getAttribute('width');
        const height = img.getAttribute('height');
        const transform = img.getAttribute('transform');
        const rect = doc.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', width);
        rect.setAttribute('height', height);
        rect.setAttribute('fill', '#5d8bb3'); // 设置为指定颜色

        if (transform) {
          rect.setAttribute('transform', transform);
        }

        // 在原图片位置插入矩形
        img.parentNode.insertBefore(rect, img);

        //替换图片 URL 为空白 URL（避免报错）
        img.setAttribute('href', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');

        // 隐藏原图片
        img.setAttribute('opacity', '0');
      }
    });

    // 转回字符串
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  };

  useEffect(() => {
    (async () => {
      await clearPreviewCache();
      const data = await getExportPreview(1, true);
      setImageData(data);

      if (data && data.includes('svg')) {
        const decoded = decodeSvg(data);

        if (decoded) {
          const widthMatch = decoded.match(/width="(\d+)"/);
          const heightMatch = decoded.match(/height="(\d+)"/);
          if (widthMatch && heightMatch) {
            setSvgSize({
              width: parseInt(widthMatch[1]),
              height: parseInt(heightMatch[1])
            });
          }

          //处理 SVG 图片
          const processedSvg = processSvgImages(decoded);
          setSvgContent(processedSvg);
        }
      } else {
        setSvgContent('');
      }
    })();
  }, [Config]);

  useEffect(() => {
    if (svgSize.width && svgSize.height) {
      calculateScale();
    }
  }, [svgSize]);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      calculateScale();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [svgSize]);

  return (
    <div
      ref={containerRef}
      className={'ConfigOverview'}
      style={{
        border: '1px solid #ccc',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#757575',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {svgContent ? (
        <div
          dangerouslySetInnerHTML={{ __html: svgContent }}
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            width: svgSize.width || 'auto',
            height: svgSize.height || 'auto',
          }}
        />
      ) : (
        <div style={{ color: '#999' }}>Loading...</div>
      )}
    </div>
  );
};
