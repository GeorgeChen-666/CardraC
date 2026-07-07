import React, { memo, useEffect, useMemo, useState } from 'react';
import Card from '@mui/material/Card';
import '../CardList/styles.css';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';
import { openImage } from '../../../functions';
import { layoutSides } from '../../../../shared/constants';
import { useGlobalStore } from '../../../state/store';
import Menu from '@mui/material/Menu';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import { CardImage } from './CardImage';
import { CardToolbar } from './CardToolbar';
import { CardFooter } from './CardFooter';
import { useEvent } from './useEvent';
import { webUtils } from 'electron';
import { imagePathToImageSrc } from '../../../../shared/functions';

const useMenuState = (items) => {
  const [anchorEl, setAnchorEl] = React.useState(null);
  const open = Boolean(anchorEl);

  const onOpen = useEvent((event) => {
    event?.stopPropagation?.();
    setAnchorEl(event.currentTarget);
  });

  const onClose = useEvent(() => {
    setAnchorEl(null);
  });

  return {
    onOpen,
    MenuElement: (
      <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
        {items.map((option) => (
          <MenuItem
            key={option.label}
            onClick={(e) => {
              e.stopPropagation();
              option?.onClick?.();
              onClose();
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
    ),
  };
};

export default memo(({ data, dialogCardSettingRef, index, sharedPreviewRef, currentLang }) => {
  const { t } = useTranslation();
  const {
    cardEditById, cardRemoveByIds, cardSelect,
    cardShiftSelect, cardCtrlSelect, dragHoverMove, dragCardsMove, dragHoverCancel
  } = useGlobalStore.getState();
  const { Config, Global, CardList } = useGlobalStore.selectors;
  const sides = Config.sides();
  const selected = CardList[index].selected() || false;
  const isBackEditing = Global.isBackEditing();
  const imageVersion = Global.imageVersion();
  const bleedConfig = data?.config?.bleed;
  const [isDragOver, setIsDragOver] = useState(false);
  const isDoubleSidedMode = useMemo(() =>
      [layoutSides.doubleSides, layoutSides.foldInHalf].includes(sides),
    [sides]
  );
  const hasIndependentSettings = sides !== layoutSides.brochure;

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();

    //获取拖拽的项目
    const items = Array.from(e.dataTransfer.items);
    //过滤出文件类型的项目
    const fileItems = items.filter(item => item.kind === 'file');
    //检查是否都是图片
    const imageItems = fileItems.filter(item =>
      item.type.startsWith('image/')
    );

    //获取文件数量
    const fileCount = fileItems.length;
    const imageCount = imageItems.length;

    //只有当全部是图片时才高亮
    if (imageCount > 0 && imageCount === fileCount) {
      setIsDragOver(true);
      e.dataTransfer.dropEffect = 'copy'; // 显示复制图标
    } else {
      setIsDragOver(false);
      e.dataTransfer.dropEffect = 'none'; // 显示禁止图标
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    //获取拖拽的文件
    const files = Array.from(e.dataTransfer.files);

    //在 Electron 中，file.path 包含完整路径
    files.forEach(file => {
      console.log('文件名:', file.name);
      console.log('文件路径:', file.path);  //完整路径
      console.log('文件大小:', file.size);
      console.log('文件类型:', file.type);
      const path = webUtils.getPathForFile(file);
      console.log('aaa', path)
    });

    //过滤图片并获取路径
    const imagePaths = files
      .filter(f => /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name))
      .map(f => f.path);

    console.log('图片路径列表:', imagePaths);
    // ['C:\\Users\\xxx\\image1.jpg', 'C:\\Users\\xxx\\image2.png']
  };

  const handleSwap = useEvent((e) => {
    e.stopPropagation();
    if (!isDoubleSidedMode) return;
    cardEditById({ id: data.id, face: data.back, back: data.face });
  });

  const handleSelect = useEvent((event) => {
    if (event.type === 'change' ||
      event.target.nodeName.toLowerCase() === 'svg' ||
      event.target.classList.contains('MuiBackdrop-root')) return;

    if (event.shiftKey) {
      cardShiftSelect(data.id);
    } else if (event.ctrlKey || event.target.type === 'checkbox') {
      cardCtrlSelect(data.id);
    } else {
      cardSelect(data.id);
    }
  });

  const handleRemove = useEvent((e) => {
    e.stopPropagation();
    cardRemoveByIds([data.id]);
  });

  const handleDragStart = useEvent((e) => {
    e.stopPropagation();
    if (!selected) {
      cardSelect(data.id);
    }
  });

  const handleRepeatChange = useEvent(($, value) => {
    cardEditById({ id: data.id, repeat: isNaN(value) ? 1 : value });
  });

  const handleMenuOpen = useEvent((e) => {
    e.stopPropagation();
    if (!selected) {
      cardSelect(data.id);
    }
    onOpen(e);
  });

  //缓存菜单项
  const menuItems = useMemo(() => [
    {
      label: t('cardEditor.face'),
      onClick: async () => {
        const [ imageData ] = await openImage();
        imageData && cardEditById({ id: data.id, face: imageData?.face });
      },
    },
    {
      label: t('cardEditor.clearFace'),
      onClick: () => {
        cardEditById({ id: data.id, face: null });
      },
    },
    ...(isDoubleSidedMode ? [
      {
        label: t('cardEditor.back'),
        onClick: async () => {
          const [ imageData ] = await openImage();
          imageData && cardEditById({ id: data.id, back: imageData?.face });
        },
      },
      {
        label: t('cardEditor.clearBack'),
        onClick: () => {
          cardEditById({ id: data.id, back: null });
        },
      }
    ] : []),
    ...(hasIndependentSettings ? [{
      label: t('cardEditor.spicalConfig'),
      onClick: () => {
        dialogCardSettingRef.current.openDialog([data.id]);
      },
    }] : [])
  ], [isDoubleSidedMode, hasIndependentSettings, data.id, t]);

  const { onOpen, MenuElement } = useMenuState(menuItems);

  //缓存图片 URL
  const faceUrl = useMemo(() => imagePathToImageSrc(data?.face?.path, { quality: 'low' ,version: imageVersion }), [data?.face?.path, data?.face?.mtime, imageVersion]);
  const backUrl = useMemo(() => imagePathToImageSrc(data?.back?.path, { quality: 'low' , version: imageVersion }), [data?.back?.path, data?.back?.mtime, imageVersion]);

  //缓存计算结果
  const isShowBack = isDoubleSidedMode;

  const [, dropRef] = useDrop({
    accept: 'Card',
    hover({ id: draggedId }) {
      if (draggedId !== data.id) {
        dragHoverMove(index);
      }
    },
    drop: dragCardsMove,
  });

  const [{ isDragging }, dragRef, previewRef] = useDrag({
    item: () => {
      return ({ id: data.id, originalIndex: index })
    },
    isDragging: (monitor) => selected || monitor.getItem().id === data.id,
    type: 'Card',
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    end: (item, monitor) => {
      // 如果没有成功放置（didDrop 返回 false）
      if (!monitor.didDrop()) {
        dragHoverCancel();
      }
    },
  });

  useEffect(() => {
    if (sharedPreviewRef.current) {
      previewRef(sharedPreviewRef.current);
    }
  }, [previewRef]);

  return (
    <>
      <Card
        ref={dropRef}
        sx={{
          opacity: isDragging ? 0.1 : 1,
        }}
        onClick={handleSelect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          border: isDragOver ? '2px solid #2196F3' : 'none',
          backgroundColor: isDragOver ? '#e3f2fd' : 'revert-layer'
        }}
      >
        <CardToolbar
          index={index}
          showSwap={isDoubleSidedMode}
          onSwap={handleSwap}
          onMenuOpen={handleMenuOpen}
          onDragStart={handleDragStart}
          dragRef={dragRef}
        />
        {MenuElement}

        <div className={'CardMain'}>
          <Stack direction='row' justifyContent={'center'}>
            <CardImage
              imageSrc={faceUrl}
              path={data?.face?.path}
              isBackEditing={isBackEditing}
              isFace={true}
            />
            {isShowBack && (
              <CardImage
                imageSrc={backUrl}
                path={data?.back?.path}
                isBackEditing={isBackEditing}
                isFace={false}
              />
            )}
          </Stack>
        </div>

        <CardFooter
          selected={selected}
          onSelectChange={handleSelect}
          bleedConfig={bleedConfig}
          sides={sides}
          repeat={data.repeat}
          onRepeatChange={handleRepeatChange}
          onRemove={handleRemove}
          t={t}
        />
      </Card>
    </>
  );
}, (prev, next) => {
  return (
    prev.data.id === next.data.id &&
    prev.data.face?.path === next.data.face?.path &&
    prev.data.back?.path === next.data.back?.path &&
    prev.data.back?.mtime === next.data.back?.mtime &&
    prev.data.face?.mtime === next.data.face?.mtime &&
    prev.data.face === next.data.face &&
    prev.data.back === next.data.back &&
    prev.data.repeat === next.data.repeat &&
    prev.data.config?.bleed === next.data.config?.bleed &&
    prev.index === next.index &&
    prev.data.selected === next.data.selected &&
    prev.currentLang === next.currentLang
  );
});