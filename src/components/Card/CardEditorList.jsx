import React, { useContext } from 'react';
import { CardEditor } from './CardEditor';
import { AddCard } from './AddCard';
import { Actions } from '../../store';
import styles from './styles.module.css';
import { ReactSortable } from 'react-sortablejs';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';

export const CardEditorList = () => {
  const Global = useSelector((state) => state.pnp.Global, shallowEqual);
  const CardList = useSelector((state) => state.pnp.CardList, shallowEqual);

  const mergedList = CardList.map(c => {
    const rc = {...(c || {})};
    rc.selected = Global.selection.includes(rc.id);
    return rc;
  });
  return <div className={styles.CardList}>
    <ReactSortable
      style={{ display: 'contents' }}
      handle={`.${styles.CardDragHandler}`}
      list={mergedList}
      setList={(newList) => {
        dispatch()
        //dispatch({ type: Actions.FillCardList, payload: newList });
      }}
    >
      {
        //CardList.map((c, index) => (<CardEditor key={c.id} index={index} data={c}></CardEditor>))
      }
    </ReactSortable>
    <AddCard />
  </div>;
};