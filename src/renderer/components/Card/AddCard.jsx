import React from 'react';
import { Button, Card, IconButton } from '@chakra-ui/react';
import { IoIosAdd } from 'react-icons/io';
import { Actions, loading } from '../../store';
import './styles.css';
import { openMultiImage } from '../../functions';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

export const AddCard = () => {
  const dispatch = useDispatch();
  const { t } = useTranslation();
  return (<Card className={'Card'} size={'sm'} padding={2}>
    <IconButton
      fontSize={100}
      height={238}
      width={'100%'}
      icon={<IoIosAdd />}
      variant='outline'
      border={'none'}
      onClick={() => loading(async () => {
        const imageData = await openMultiImage('CardAddByFaces');
        dispatch(Actions.CardAddByFaces([...imageData]));
      })}
    />
    <div>
      <Button width='100%' size='sm' onClick={() => { //
        dispatch(Actions.CardAddByFaces([null]));
      }}>
        {t('cardEditor.addEmpty')}
      </Button>
    </div>
  </Card>);
};