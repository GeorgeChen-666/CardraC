// src/renderer/parts/BreadcrumbBar.jsx

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { browsePath } from '../../../functions';  // ✅ 导入路径验证函数

export const BreadcrumbBar = ({
                                folderChain,
                                currentPath,
                                onNavigate
                              }) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleCount, setVisibleCount] = useState(folderChain.length);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const isFirstRender = useRef(true);

  // ✅ 编辑模式状态
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [hasError, setHasError] = useState(false);

  // ✅ 使用 useCallback，依赖 folderChain
  const calculateVisibleItems = useCallback(() => {
    if (!containerRef.current || folderChain.length === 0) {
      setVisibleCount(folderChain.length);
      return;
    }

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;

    if (containerWidth === 0) {
      console.log('⚠️ Container width is 0, skipping calculation');
      setVisibleCount(folderChain.length);
      return;
    }

    console.log('📐 Container width:', containerWidth, 'folderChain length:', folderChain.length);

    const dropdownButtonWidth = 60;
    const separatorWidth = 20;

    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.visibility = 'hidden';
    tempContainer.style.whiteSpace = 'nowrap';
    tempContainer.style.display = 'flex';
    tempContainer.style.alignItems = 'center';
    document.body.appendChild(tempContainer);

    let totalWidth = 0;
    let count = 0;

    for (let i = folderChain.length - 1; i >= 0; i--) {
      const item = folderChain[i];

      const tempButton = document.createElement('button');
      tempButton.textContent = item.name;
      tempButton.className = 'breadcrumb-button MuiButton-root MuiButton-text MuiButton-sizeSmall';
      tempButton.style.minWidth = 'auto';
      tempButton.style.maxWidth = '150px';
      tempButton.style.padding = '4px 8px';
      tempButton.style.fontSize = '13px';
      tempContainer.appendChild(tempButton);

      const buttonWidth = tempButton.offsetWidth;
      const itemWidth = buttonWidth + (count > 0 ? separatorWidth : 0);

      const availableWidth = count === 0
        ? containerWidth
        : containerWidth - dropdownButtonWidth;

      if (totalWidth + itemWidth <= availableWidth || count === 0) {
        totalWidth += itemWidth;
        count++;
      } else {
        break;
      }
    }

    document.body.removeChild(tempContainer);

    if (count === 0) count = 1;

    console.log('📏 Calculated visible count:', count, 'of', folderChain.length);
    setVisibleCount(count);
  }, [folderChain]);

  // ✅ 首次渲染后延迟计算
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      const timer = setTimeout(() => {
        calculateVisibleItems();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [calculateVisibleItems]);

  // ✅ folderChain 变化时重新计算
  useLayoutEffect(() => {
    if (isFirstRender.current) return;

    const timer = setTimeout(() => {
      calculateVisibleItems();
    }, 0);

    return () => clearTimeout(timer);
  }, [folderChain, calculateVisibleItems]);

  // ✅ 监听容器大小变化
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      console.log('📐 Container resized, recalculating...');
      calculateVisibleItems();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateVisibleItems]);

  // ✅ 进入编辑模式时自动聚焦
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const { visibleChain, hiddenChain } = useMemo(() => {
    const hiddenCount = folderChain.length - visibleCount;

    if (hiddenCount <= 0) {
      return { visibleChain: folderChain, hiddenChain: [] };
    }

    return {
      visibleChain: folderChain.slice(hiddenCount),
      hiddenChain: folderChain.slice(0, hiddenCount)
    };
  }, [folderChain, visibleCount]);

  const handleDropdownClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleDropdownClose = () => {
    setAnchorEl(null);
  };

  const handleNavigate = (folder) => {
    const targetPath = folder.id === 'root' ? '' : folder.id;
    onNavigate(targetPath);
    handleDropdownClose();
  };

  // ✅ 点击地址栏进入编辑模式
  const handleAddressBarClick = () => {
    setInputValue(currentPath);
    setHasError(false);
    setIsEditing(true);
  };

  // ✅ 失去焦点退出编辑模式
  const handleBlur = () => {
    setIsEditing(false);
    setHasError(false);
  };

  // ✅ 验证并导航到新路径
  const handleKeyDown = async (e) => {
    if (e.key === 'Enter') {
      const newPath = inputValue.trim();

      try {
        // ✅ 验证路径是否存在
        const result = await browsePath({ path: newPath, query: {} });

        if (result.type === 'directory') {
          // ✅ 路径有效，导航
          setHasError(false);
          setIsEditing(false);
          onNavigate(newPath);
        } else {
          // ❌ 路径无效
          setHasError(true);
        }
      } catch (error) {
        // ❌ 路径不存在或错误
        console.error('Invalid path:', error);
        setHasError(true);
      }
    } else if (e.key === 'Escape') {
      // ✅ ESC 键取消编辑
      setIsEditing(false);
      setHasError(false);
    }
  };

  // ✅ 渲染编辑模式
  if (isEditing) {
    return (
      <div className="windows-address-bar" ref={containerRef}>
        <TextField
          inputRef={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          fullWidth
          size="small"
          error={hasError}
          sx={{
            '& .MuiOutlinedInput-root': {
              backgroundColor: '#3c3c3c',
              color: '#ffffff',
              fontSize: '13px',
              '&.Mui-error fieldset': {
                borderColor: '#f44336 !important',
              },
              '&.Mui-error.Mui-focused fieldset': {
                borderColor: '#f44336 !important',
              }
            },
            '& .MuiInputBase-input': {
              padding: '4px 8px',
              color: '#ffffff'
            }
          }}
        />
      </div>
    );
  }

  // ✅ 渲染面包屑模式
  return (
    <div
      className="windows-address-bar"
      ref={containerRef}
      onClick={handleAddressBarClick}
      style={{ cursor: 'text' }}
    >
      {hiddenChain.length > 0 && (
        <>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDropdownClick(e);
            }}
            className="breadcrumb-dropdown-button"
            title={t('fileBrowser.expandHiddenItems', { num: hiddenChain.length })}
          >
            <MoreHorizIcon fontSize="small" />
          </IconButton>
          <span className="breadcrumb-separator">›</span>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleDropdownClose}
          >
            {[...hiddenChain].reverse().map((folder) => (
              <MenuItem
                key={folder.id}
                onClick={() => handleNavigate(folder)}
              >
                {folder.name}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}

      {visibleChain.map((folder, index) => (
        <React.Fragment key={folder.id}>
          <Button
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleNavigate(folder);
            }}
            className="breadcrumb-button"
            title={folder.name}
          >
            {folder.name}
          </Button>
          {index < visibleChain.length - 1 && (
            <span className="breadcrumb-separator">›</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};
