import React, { useRef, useEffect, useState, useCallback } from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useTranslation } from 'react-i18next';

// ✅ 定义尺寸配置
const SIZE_CONFIG = {
  S: {
    iconSize: 48,
    fontSize: '13px',
    itemWidth: 100,
    itemHeight: 110
  },
  M: {
    iconSize: 64,
    fontSize: '14px',
    itemWidth: 120,
    itemHeight: 130
  },
  L: {
    iconSize: 128,
    fontSize: '16px',
    itemWidth: 180,
    itemHeight: 200
  }
};

// ✅ 单个文件项组件
const FileGridItem = React.memo(({
                                   file,
                                   isSelected,
                                   config,
                                   size,
                                   onFileClick,
                                   onFileDoubleClick
                                 }) => {
  const itemRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = itemRef.current;
    if (!element) return;

    // ✅ 创建 IntersectionObserver
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      {
        root: document.querySelector('.windows-file-area'), // ✅ 监控容器
        rootMargin: '50px', // ✅ 提前 50px 开始加载
        threshold: 0.01
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  // ✅ 获取文件图标或占位符
  const getFileIcon = useCallback(() => {
    // ❌ 不可见时返回空白占位符
    if (!isVisible) {
      return (
        <div
          style={{
            width: config.iconSize,
            height: config.iconSize,
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: 4
          }}
        />
      );
    }

    // ✅ 可见时返回真实图标
    if (file.isDir) {
      return <FolderIcon sx={{ fontSize: config.iconSize, color: '#ffd700' }} />;
    }
    if (file.thumbnailUrl) {
      return (
        <img
          src={file.thumbnailUrl}
          alt={file.name}
          style={{
            width: config.iconSize,
            height: config.iconSize,
            objectFit: 'contain',
            borderRadius: 4
          }}
        />
      );
    }
    return <InsertDriveFileIcon sx={{ fontSize: config.iconSize, color: '#90a4ae' }} />;
  }, [isVisible, file, config.iconSize]);

  return (
    <div
      ref={itemRef}
      className={`grid-file-item ${isSelected ? 'selected' : ''} size-${size}`}
      onClick={(e) => onFileClick(file, e)}
      onDoubleClick={() => onFileDoubleClick(file)}
      style={{
        minHeight: config.itemHeight
      }}
    >
      <div className="grid-file-icon">
        {getFileIcon()}
      </div>
      <div
        className="grid-file-name"
        title={file.name}
        style={{ fontSize: config.fontSize }}
      >
        {file.name}
      </div>
    </div>
  );
});

// ✅ 主组件
export const FileGrid = React.memo(({
                                      files,
                                      selectedFiles,
                                      onFileClick,
                                      onFileDoubleClick,
                                      size = 'S'
                                    }) => {
  const { t } = useTranslation();
  const config = SIZE_CONFIG[size];

  if (files.length === 0) {
    return <div className="file-list-empty">{t('fileBrowser.nothingToShow')}</div>;
  }

  return (
    <>
      {files.map((file) => {
        const isSelected = selectedFiles.some(f => f.id === file.id);

        return (
          <FileGridItem
            key={file.id}
            file={file}
            isSelected={isSelected}
            config={config}
            size={size}
            onFileClick={onFileClick}
            onFileDoubleClick={onFileDoubleClick}
          />
        );
      })}
    </>
  );
});
