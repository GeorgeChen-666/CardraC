import React, { memo } from 'react';
import { GeneralIconButton } from '../../../componments/GeneralIconButton';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

export const CardToolbar = memo(({
                                   index,
                                   onSwap,
                                   onMenuOpen,
                                   onDragStart,
                                   dragRef
                                 }) => {
  return (
    <div className={'CardBar'}>
      <GeneralIconButton
        icon={<SwapHorizIcon fontSize={'small'} />}
        size={'small'}
        onClick={onSwap}
      />
      <span
        ref={dragRef}
        className={'CardDragHandler'}
        onMouseDown={onDragStart}
        onClick={e => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize={'small'} />
        <span style={{ color: '#fff' }}>#{index + 1}</span>
        <DragIndicatorIcon fontSize={'small'} />
      </span>
      <GeneralIconButton
        icon={<MoreHorizIcon fontSize={'small'} />}
        size={'small'}
        onClick={onMenuOpen}
      />
    </div>
  );
}, (prev, next) => {
  return prev.index === next.index;
});
