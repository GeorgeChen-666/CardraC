import React from 'react';
import CardEditor from './CardEditor';
import { AddCard } from './AddCard';
import './styles.css';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CardDragTarget } from './CardDragTarget';
import { Actions } from '../../store';

export const CardEditorList = () => {
  const CardList = useSelector((state) => state.pnp.CardList, shallowEqual);
  const dispatch = useDispatch();
  return <div className={'CardListContainer'}>
    <div className={'CardList'} onDragEnd={() => dispatch(Actions.DragHoverCancel())}>
      <DndProvider backend={HTML5Backend}>
        {
          CardList.map((c, index) => {
            if (c.id === 'dragTarget') {
              return (<CardDragTarget key={c.id} index={index} />)
            } else {
              return (<CardEditor key={c.id} index={index} data={c} />);
            }
          })
        }
      </DndProvider>
      <AddCard />
    </div>
  </div>;
};