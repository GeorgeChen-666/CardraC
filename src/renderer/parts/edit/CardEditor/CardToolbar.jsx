import React, { memo } from 'react';
import { GeneralIconButton } from '../../../componments/GeneralIconButton';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

export const CardToolbar = memo(({
                                   index,
                                   showSwap = true,
                                   onSwap,
                                   onMenuOpen,
                                   onDragStart,
                                   dragRef
                                 }) => {
  return (
    <div className={'CardBar'}>
      {showSwap && <GeneralIconButton
        data-testid={`card-swap-button-${index}`}
        icon={<SwapHorizIcon fontSize={'small'} />}
        size={'small'}
        onClick={onSwap}
      />}
      <span
        ref={dragRef}
        data-testid={`card-drag-handle-${index}`}
        className={'CardDragHandler'}
        onMouseDown={onDragStart}
        onClick={e => e.stopPropagation()}
      >
        <DragIndicatorIcon fontSize={'small'} />
        <span style={{ color: '#fff' }}>#{index + 1}</span>
        <DragIndicatorIcon fontSize={'small'} />
      </span>
      <GeneralIconButton
        data-testid={`card-menu-button-${index}`}
        icon={<MoreHorizIcon fontSize={'small'} />}
        size={'small'}
        onClick={onMenuOpen}
      />
    </div>
  );
}, (prev, next) => {
  return prev.index === next.index;
});
