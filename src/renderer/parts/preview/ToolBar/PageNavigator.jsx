// PageNavigator.jsx
import React, { useState, useRef, useEffect } from 'react';
import { GeneralIconButton } from '../../../componments/GeneralIconButton';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { useTranslation } from 'react-i18next';

export const PageNavigator = ({ currentPage, totalPages, onPageChange }) => {
  const { t } = useTranslation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [inputValue, setInputValue] = useState(currentPage.toString());
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);  //添加 input ref
  const scrollPositionRef = useRef(0);  //记录滚动位置
  const isSelectingRef = useRef(false);

  // 同步当前页到输入框
  useEffect(() => {
    setInputValue(currentPage.toString());
  }, [currentPage]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
        inputRef.current?.blur();  //关闭时失焦
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  //保持滚动位置
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
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  const handlePageSelect = (page) => {
    const pageNum = parseInt(page);
    if (pageNum >= 1 && pageNum <= totalPages) {
      const dropdown = dropdownRef.current?.querySelector('[data-dropdown-list]');
      if (dropdown) {
        scrollPositionRef.current = dropdown.scrollTop;
      }

      onPageChange(pageNum);
      setInputValue(page);
      // setIsDropdownOpen(false);
      // inputRef.current?.blur();
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
    // if (isSelectingRef.current) {
    //   return;
    // }
    const pageNum = parseInt(inputValue);
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      setInputValue(currentPage.toString());
    } else if (pageNum !== currentPage) {
      onPageChange(pageNum);
    }
    setIsDropdownOpen(false);
  };

  const handleWheel = (e) => {
    e.preventDefault(); // 阻止默认滚动
    if (isDropdownOpen) {
      return;
    }
    if (e.deltaY < 0) {
      // 向上滚 - 上一页
      if (currentPage > 1) {
        onPageChange(currentPage - 1);
      }
    } else if (e.deltaY > 0) {
      // 向下滚 - 下一页
      if (currentPage < totalPages) {
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
          onFocus={() => setIsDropdownOpen(true)}
          onWheel={handleWheel}
          style={{
            width: '20px',
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
          / {totalPages}
        </span>

        {isDropdownOpen && totalPages > 0 && (
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
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
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
                  color: page === currentPage ? 'white' : '#333',
                  fontSize: '14px',
                  transition: 'background-color 0.2s',
                  borderBottom: page < totalPages ? '1px solid #f0f0f0' : 'none'
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
                Page {page}
              </div>
            ))}
          </div>
        )}
      </div>

      <GeneralIconButton
        label={t('toolbar.btnNext')}
        icon={<ArrowForwardIosIcon />}
        onClick={handleNextPage}
        disabled={currentPage >= totalPages}
      />
    </div>
  );
};
