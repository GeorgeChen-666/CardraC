// PageNavigator.jsx
import React, { useState, useRef, useEffect } from 'react';
import { GeneralIconButton } from '../../../componments/GeneralIconButton';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useTranslation } from 'react-i18next';
import { useGlobalStore } from '../../../state/store';
import { layoutSides } from '../../../../shared/constants';

export const PageNavigator = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [inputValue, setInputValue] = useState(currentPage.toString());
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const isSelectingRef = useRef(false);

  // ✅ 获取 sides 配置
  const { Config } = useGlobalStore.selectors;
  const sides = Config.sides();

  // ✅ 根据 sides 计算额外页面数量
  const getExtraPageCount = () => {
    if (sides === layoutSides.oneSide) {
      return 1;
    } else if ([layoutSides.doubleSides, layoutSides.foldInHalf, layoutSides.brochure].includes(sides)) {
      return 2;
    }
    return 1;
  };

  const extraPageCount = getExtraPageCount();
  const totalPagesWithExtra = totalPages + extraPageCount;  // ✅ 总页数（包括虚拟页）

  useEffect(() => {
    setInputValue(currentPage.toString());
  }, [currentPage]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isDropdownOpen && dropdownRef.current) {
      const dropdown = dropdownRef.current.querySelector('[data-dropdown-list]');
      if (dropdown) {
        dropdown.scrollTop = scrollPositionRef.current;
      }
    }
  }, [isDropdownOpen, currentPage]);

  const handlePrevPage = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPagesWithExtra) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageSelect = (page) => {
    const pageNum = parseInt(page);
    if (pageNum >= 1 && pageNum <= totalPagesWithExtra) {
      const dropdown = dropdownRef.current?.querySelector('[data-dropdown-list]');
      if (dropdown) {
        scrollPositionRef.current = dropdown.scrollTop;
      }

      onPageChange(pageNum);
      setInputValue(page);
    }
  };

  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      handlePageSelect(inputValue);
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setInputValue(currentPage.toString());
      inputRef.current?.blur();
    }
  };

  const handleInputBlur = () => {
    const pageNum = parseInt(inputValue);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPagesWithExtra) {
      setInputValue(currentPage.toString());
    } else if (pageNum !== currentPage) {
      onPageChange(pageNum);
    }
    setIsDropdownOpen(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    if (isDropdownOpen) {
      return;
    }
    if (e.deltaY < 0) {
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    } else if (e.deltaY > 0) {
      if (currentPage < totalPagesWithExtra) {
        onPageChange(currentPage + 1);
      }
    }
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', verticalAlign: 'middle' }}>
      <GeneralIconButton
        label={t('toolbar.btnPrev')}
        icon={<ArrowBackIosIcon />}
        onClick={handlePrevPage}
        disabled={currentPage <= 1}
      />

      <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          onBlur={handleInputBlur}
          onFocus={() => setIsDropdownOpen(true)}  // ✅ 总是可以打开下拉
          onWheel={handleWheel}
          style={{
            width: '22px',
            textAlign: 'center',
            padding: '6px 8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            outline: 'none'
          }}
        />
        <span style={{ margin: '0 8px', fontSize: '14px', color: '#666' }}>
          / {totalPagesWithExtra}
        </span>

        {isDropdownOpen && (  // ✅ 移除 totalPages > 0 的检查
          <div
            data-dropdown-list
            onMouseDown={() => {
              isSelectingRef.current = true;
            }}
            onMouseUp={() => {
              setTimeout(() => {
                isSelectingRef.current = false;
              }, 100);
            }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              maxHeight: '240px',
              overflowY: 'auto',
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              zIndex: 1000,
              minWidth: '120px'
            }}
          >
            {/* ✅ 渲染所有页面（包括虚拟页） */}
            {Array.from({ length: totalPagesWithExtra }, (_, i) => i + 1).map(page => {
              const isEmptyPage = page > totalPages;  // ✅ 判断是否是虚拟页

              return (
                <div
                  key={page}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handlePageSelect(page);
                  }}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    backgroundColor: page === currentPage ? '#1976d2' : 'white',
                    color: page === currentPage ? 'white' : (isEmptyPage ? '#999' : '#333'),  // ✅ 虚拟页灰色
                    fontSize: '14px',
                    fontStyle: isEmptyPage ? 'italic' : 'normal',  // ✅ 虚拟页斜体
                    transition: 'background-color 0.2s',
                    borderBottom: page < totalPagesWithExtra ? '1px solid #f0f0f0' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (page !== currentPage) {
                      e.target.style.backgroundColor = '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (page !== currentPage) {
                      e.target.style.backgroundColor = 'white';
                    }
                  }}
                >
                  {t('toolbar.page', {num: page})}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <GeneralIconButton
        label={t('toolbar.btnNext')}
        icon={<ArrowForwardIosIcon />}
        onClick={handleNextPage}
        disabled={currentPage >= totalPagesWithExtra}
      />
    </div>
  );
};
