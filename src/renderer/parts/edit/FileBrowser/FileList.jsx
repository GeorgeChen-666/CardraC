import React from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useTranslation } from 'react-i18next';

export const FileList = React.memo(({ files, selectedFiles, onFileClick, onFileDoubleClick }) => {
  const { t } = useTranslation();
  const getFileIcon = (file) => {
    if (file.isDir) return <FolderIcon sx={{ color: '#ffd700' }} />;
    if (file.thumbnailUrl) return <ImageIcon sx={{ color: '#4fc3f7' }} />;
    return <InsertDriveFileIcon sx={{ color: '#90a4ae' }} />;
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      {/* 表头 */}
      <div className="file-list-header">
        <div className="file-list-cell file-name-cell">{t('fileBrowser.fileListTitle1')}</div>
        <div className="file-list-cell file-size-cell">{t('fileBrowser.fileListTitle2')}</div>
        <div className="file-list-cell file-date-cell">{t('fileBrowser.fileListTitle3')}</div>
      </div>

      {/* 文件列表内容 */}
      {files.length === 0 ? (
        <div className="file-list-empty">{t('fileBrowser.nothingToShow')}</div>
      ) : (
        files.map((file) => {
          const isSelected = selectedFiles?.some?.(f => f?.id === file?.id) || false;

          return (
            <div
              key={file.id}
              className={`file-list-row ${isSelected ? 'selected' : ''}`}
              onClick={(e) => onFileClick(file, e)}
              onDoubleClick={() => onFileDoubleClick(file)}
            >
              <div className="file-list-cell file-name-cell">
                <div className="file-name-content">
                  {getFileIcon(file)}
                  <span className="file-name-text" title={file.name}>
                    {file.name}
                  </span>
                </div>
              </div>
              <div className="file-list-cell file-size-cell">
                {file.isDir ? '-' : formatFileSize(file.size)}
              </div>
              <div className="file-list-cell file-date-cell">
                {formatDate(file.modDate)}
              </div>
            </div>
          );
        })
      )}
    </>
  );
});