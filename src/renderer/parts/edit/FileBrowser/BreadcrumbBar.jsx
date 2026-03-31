// src/renderer/parts/BreadcrumbBar.jsx

import React, { useState, useEffect, useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import IconButton from '@mui/material/IconButton';

export const BreadcrumbBar = ({
                                folderChain,
                                currentPath,
                                onNavigate
                              }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleCount, setVisibleCount] = useState(folderChain.length);
  const containerRef = useRef(null);
  const isFirstRender = useRef(true);

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
  }, [folderChain]); // ✅ 依赖 folderChain

  // ✅ 首次渲染后延迟计算
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;

      const timer = setTimeout(() => {
        calculateVisibleItems();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [calculateVisibleItems]); // ✅ 依赖 calculateVisibleItems

  // ✅ folderChain 变化时重新计算
  useLayoutEffect(() => {
    if (isFirstRender.current) return;

    const timer = setTimeout(() => {
      calculateVisibleItems();
    }, 0);

    return () => clearTimeout(timer);
  }, [folderChain, calculateVisibleItems]); // ✅ 依赖 calculateVisibleItems

  // ✅ 监听容器大小变化
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      console.log('📐 Container resized, recalculating...');
      calculateVisibleItems(); // ✅ 现在能访问到最新的 folderChain
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [calculateVisibleItems]); // ✅ 依赖 calculateVisibleItems

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

  return (
    <div className="windows-address-bar" ref={containerRef}>
      {hiddenChain.length > 0 && (
        <>
          <IconButton
            size="small"
            onClick={handleDropdownClick}
            className="breadcrumb-dropdown-button"
            title={`显示 ${hiddenChain.length} 个隐藏项`}
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
            onClick={() => handleNavigate(folder)}
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
