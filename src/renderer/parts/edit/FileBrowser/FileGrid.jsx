import React from 'react';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

export const FileGrid = React.memo(({ files, selectedFiles, onFileClick, onFileDoubleClick }) => {
  const getFileIcon = (file) => {
    if (file.isDir) return <FolderIcon sx={{ fontSize: 48, color: '#ffd700' }} />;
    if (file.thumbnailUrl) {
      return (
        <img
          src={file.thumbnailUrl}
          alt={file.name}
          style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4 }}
        />
      );
    }
    return <InsertDriveFileIcon sx={{ fontSize: 48, color: '#90a4ae' }} />;
  };

  if (files.length === 0) {
    return <div className="file-list-empty">此文件夹为空</div>;
  }

  return (
    <>
      {files.map((file) => {
        const isSelected = selectedFiles.some(f => f.id === file.id);

        return (
          <div
            key={file.id}
            className={`grid-file-item ${isSelected ? 'selected' : ''}`}
            onClick={(e) => onFileClick(file, e)}
            onDoubleClick={() => onFileDoubleClick(file)}
          >
            <div className="grid-file-icon">
              {getFileIcon(file)}
            </div>
            <div className="grid-file-name" title={file.name}>
              {file.name}
            </div>
          </div>
        );
      })}
    </>
  );
});