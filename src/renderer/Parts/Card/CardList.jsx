import React from 'react';
import { useGlobalStore } from '../../State/store';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Card from './Card';
import CardDropTarget from './CardDropTarget';
import AddCard from './AddCard'

export const CardList = () => {
  // const { selectors, dragHoverCancel } = useGlobalStore.getState();
  // const { CardList: CardListFn } = useGlobalStore.selectors;
  // const CardList = CardListFn();

  // 数组类型的state有bug暂时先这么写。
  const CardList = useGlobalStore(state => state.CardList);
  const dragHoverCancel = useGlobalStore(state => state.dragHoverCancel);
  return (<div className={'CardListContainer'}>
    <div className={'CardList'} onDragEnd={dragHoverCancel}>
      <DndProvider backend={HTML5Backend}>
        {
          CardList.map((c, index) => {
            if (c.id === 'dragTarget') {
              return (<CardDropTarget  key={c.id} index={index} />)
            } else {
              return (<Card key={c.id} index={index} data={c} />);
            }
          })
        }
      </DndProvider>
      <AddCard />
    </div>
  </div>)
}