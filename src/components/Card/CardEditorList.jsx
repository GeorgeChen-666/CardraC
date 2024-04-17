import React from 'react';
import CardEditor from './CardEditor';
import { AddCard } from './AddCard';
import styles from './styles.module.css';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

export const CardEditorList = () => {
  const dispatch = useDispatch();
  // const Global = useSelector((state) => state.pnp.Global, shallowEqual);
  const CardList = useSelector((state) => state.pnp.CardList, shallowEqual);

  const mergedList = CardList.map(c => {
    const rc = {...(c || {})};
    //rc.selected = Global.selection.has(rc.id);
    return rc;
  });
  // const memoCardList = useMemo(() => CardList.map(c=>({...c})), [CardList])
  return <div className={styles.CardList}>
    <DndProvider backend={HTML5Backend}>
      {
        CardList.map((c, index) => (<CardEditor key={c.id} index={index} data={c}></CardEditor>))
      }
    </DndProvider>
    <AddCard />
  </div>;
};