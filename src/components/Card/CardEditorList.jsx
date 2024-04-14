import React, { useContext } from 'react';
import { CardEditor } from './CardEditor';
import { AddCard } from './AddCard';
import { Actions, StoreContext } from '../../store';
import styles from './styles.module.css';
import { ReactSortable } from 'react-sortablejs';

export const CardEditorList = () => {
  const { state, dispatch } = useContext(StoreContext);
  const { CardList } = state;
  const mergedList = CardList.map(c => {
    c && (c.selected = state.Global.selection.has(c.id));
    return c;
  });
  return <div className={styles.CardList}>
    <ReactSortable
      style={{ display: 'contents' }}
      handle={`.${styles.CardDragHandler}`}
      list={mergedList}
      setList={(newList) => {
        dispatch({ type: Actions.FillCardList, payload: newList });
      }}
    >
      {
        CardList.map((c, index) => (<CardEditor key={c.id} index={index} data={c}></CardEditor>))
      }
    </ReactSortable>
    <AddCard />
  </div>;
};