// src/renderer/parts/edit/CardList/index.jsx

import React, { useRef, useMemo, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Card from '../CardEditor';
import CardDropTarget from './CardDropTarget';
import AddCard from './AddCard';
import { CardSettingDialog } from '../CardEditor/CardSettingDialog';
import { useGlobalStore } from '../../../state/store';

export const CardList = () => {
  const dialogCardSettingRef = useRef(null);
  const parentRef = useRef(null);

  const CardList = useGlobalStore(state => state.CardList);
  const dragHoverCancel = useGlobalStore(state => state.dragHoverCancel);

  const [containerWidth, setContainerWidth] = React.useState(0);
  const cardWidth = 225;
  const cardHeight = 282;
  const gap = 12;

  const cardsPerRow = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)));

  React.useEffect(() => {
    if (!parentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      setContainerWidth(width);
    });

    resizeObserver.observe(parentRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const isDragging = useMemo(() => {
    return CardList.some(c => c.id === 'dragTarget');
  }, [CardList]);

  const itemsWithAddCard = useMemo(() => {
    let displayList = CardList;

    if (isDragging) {
      displayList = CardList.filter(c => {
        if (c.id === 'dragTarget') return true;
        if (c.selected) return false;
        return true;
      });
    }

    return [...displayList, { id: '__addCard__', type: 'addCard' }];
  }, [CardList, isDragging]);

  const rows = useMemo(() => {
    const result = [];
    for (let i = 0; i < itemsWithAddCard.length; i += cardsPerRow) {
      result.push(itemsWithAddCard.slice(i, i + cardsPerRow));
    }
    return result;
  }, [itemsWithAddCard, cardsPerRow]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => cardHeight + gap,
    overscan: 4,
  });

  // ✅ 修复：等待 DOM 更新后再调用 measure
  useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        rowVirtualizer.measure();
      });
    });
  }, [isDragging, rows.length, rowVirtualizer]);

  return (
    <div className={'CardListContainer'}>
      <div
        ref={parentRef}
        className={'CardList'}
        onDragEnd={dragHoverCancel}
        style={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden'
        }}
      >
        <DndProvider backend={HTML5Backend}>
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const rowCards = rows[virtualRow.index];

              return (
                <div
                  key={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    display: 'flex',
                    gap: `${gap}px`,
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                    paddingLeft: '8px'
                  }}
                >
                  {rowCards.map((card, indexInRow) => {
                    const globalIndex = virtualRow.index * cardsPerRow + indexInRow;
                    if (card.type === 'addCard') {
                      return <AddCard key={card.id} />;
                    }
                    if (card.id === 'dragTarget') {
                      return (
                        <CardDropTarget
                          key={card.id}
                          index={globalIndex}
                        />
                      );
                    }
                    return (
                      <Card
                        key={card.id}
                        dialogCardSettingRef={dialogCardSettingRef}
                        index={globalIndex}
                        data={card}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </DndProvider>
      </div>
      <CardSettingDialog ref={dialogCardSettingRef} />
    </div>
  );
};
