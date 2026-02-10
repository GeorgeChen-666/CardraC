import React, { useRef, useState, useEffect, useCallback } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Card from '../CardEditor';
import CardDropTarget from './CardDropTarget';
import AddCard from './AddCard';
import { CardSettingDialog } from '../CardEditor/CardSettingDialog';
import { useGlobalStore } from '../../../state/store';

const CardWrapper = ({ card, index, dialogCardSettingRef, isAddCard, isDragTarget, realIndex }) => {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!cardRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            setIsVisible(entry.isIntersecting);
          }, 50);
        });
      },
      {
        root: null,
        rootMargin: '200px',
        threshold: 0,
      },
    );

    observer.observe(cardRef.current);

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!isVisible) {
    return (
      <div
        ref={cardRef}
        className={'Card'}
        style={{
          backgroundColor: 'rgba(115,115,115,.6)',
          borderRadius: '8px',
        }}
      />
    );
  }
  return (
    <div ref={cardRef} className={'Card'}>
      {isAddCard ? (
        <AddCard />
      ) : isDragTarget ? (
        <CardDropTarget index={realIndex} />
        ) : (
        <Card
        dialogCardSettingRef={dialogCardSettingRef}
         index={realIndex}
         data={card}
    />
  )}
</div>
);};

export const CardList = () => {
  const dialogCardSettingRef = useRef(null);
  const parentRef = useRef(null);
  const scrollIntervalRef = useRef(null);

  const CardList = useGlobalStore(state => state.CardList);
  const dragHoverCancel = useGlobalStore(state => state.dragHoverCancel);

  const isDragging = CardList.some(c => c.id === 'dragTarget');

  const handleAutoScroll = useCallback((e) => {
    if (!parentRef.current || !isDragging) return;

    const container = parentRef.current;
    const rect = container.getBoundingClientRect();
    const mouseY = e.clientY;

    const SCROLL_ZONE = 100;
    const SCROLL_SPEED = 10;

    if (scrollIntervalRef.current) {
      cancelAnimationFrame(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }

    // 检查是否在上边界
    if (mouseY < rect.top + SCROLL_ZONE) {
      const scroll = () => {
        if (container.scrollTop > 0) {
          container.scrollTop -= SCROLL_SPEED;
          scrollIntervalRef.current = requestAnimationFrame(scroll);
        }
      };
      scrollIntervalRef.current = requestAnimationFrame(scroll);
    }
    // 检查是否在下边界
    else if (mouseY > rect.bottom - SCROLL_ZONE) {
      const scroll = () => {
        const maxScroll = container.scrollHeight - container.clientHeight;
        if (container.scrollTop < maxScroll) {
          container.scrollTop += SCROLL_SPEED;
          scrollIntervalRef.current = requestAnimationFrame(scroll);
        }
      };
      scrollIntervalRef.current = requestAnimationFrame(scroll);
    }
  }, [isDragging]);

  const stopAutoScroll = useCallback(() => {
    if (scrollIntervalRef.current) {
      cancelAnimationFrame(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAutoScroll();
    };
  }, [stopAutoScroll]);

  let displayList = CardList;
  if (isDragging) {
    displayList = CardList.filter(c => {
      if (c.id === 'dragTarget') return true;
      if (c.selected) return false;
      return true;
    });
  }

  const itemsWithAddCard = [...displayList, { id: '__addCard__', type: 'addCard' }];

  return (
    <div
      ref={parentRef}
      className={'CardListContainer'}
      onDragEnd={() => {
        dragHoverCancel();
        stopAutoScroll();
      }}
      onDragOver={handleAutoScroll}
      onDragLeave={stopAutoScroll}
    >
      <DndProvider backend={HTML5Backend}>
        <div
          className={'CardList'}
          style={{
            padding: '8px',
            gap: '12px',
            justifyContent: 'flex-start',
          }}
        >
          {itemsWithAddCard.map((card, displayIndex) => {
            const realIndex = card.id === '__addCard__'
              ? CardList.length
              : CardList.findIndex(c => c.id === card.id);

            return (
              <CardWrapper
                key={card.id}
                card={card}
                index={displayIndex}
                realIndex={realIndex}
                dialogCardSettingRef={dialogCardSettingRef}
                isAddCard={card.type === 'addCard'}
                isDragTarget={card.id === 'dragTarget'}
              />
            );
          })}
        </div>
      </DndProvider>
      <CardSettingDialog ref={dialogCardSettingRef} />
    </div>
  );
};

