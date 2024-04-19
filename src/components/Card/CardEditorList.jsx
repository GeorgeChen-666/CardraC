import React from 'react';
import CardEditor from './CardEditor';
import { AddCard } from './AddCard';
import styles from './styles.module.css';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { CardDragTarget } from './CardDragTarget';

export const CardEditorList = () => {
  const CardList = useSelector((state) => state.pnp.CardList, shallowEqual);

  return <div className={styles.CardList}>
    <DndProvider backend={HTML5Backend}>
      {
        CardList.map((c, index) => {
          if(c.id === 'dragTarget') {
            return (<CardDragTarget  key={c.id} index={index} />)
          } else {
            return (<CardEditor key={c.id} index={index} data={c} />);
          }
        })
      }
    </DndProvider>
    <AddCard />
  </div>;
};