import React from 'react';
import { useStore } from '../../State/store';
import { DndProvider, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useTranslation } from 'react-i18next';
import Card from './Card';
import AddCard from './AddCard'

export const CardDragTarget = ({index}) => {
  const { t } = useTranslation();
  const [, dropRef] = useDrop({
    accept: 'Card',
    drop: () => {
      //dispatch(Actions.SelectedCardsMove());
    },
  });
  return (<Card ref={dropRef} className={'Card'} size={'sm'} padding={2}>{t('cardEditor.lblHere')}</Card>)
}

export const CardList = () => {
  //const { selectors: { CardList }, mergeConfig } = useStore.getState();
  // const CardList = useStore(state => state.CardList);
  const { selectors, mergeGlobal } = useStore.getState();
  const { CardList: CardListFn } = selectors;
  const CardList = CardListFn();
  console.log('cccccc', CardList);
  // const dispatch = useDispatch();
  return (<div className={'CardListContainer'}>
    <div className={'CardList'} onDragEnd={() => {}}>
      <DndProvider backend={HTML5Backend}>
        {
          CardList.map((c, index) => {
            if (c.id === 'dragTarget') {
              return (<div key={c.id}>{JSON.stringify(c)}</div>)
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