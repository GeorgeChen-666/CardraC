import Card from '@mui/material/Card';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import React from 'react';
import { useGlobalStore } from '../../State/store';
import { openMultiImage } from '../../functions';

export default () => {
  const { t } = useTranslation();
  const {
    openImage, cardAdd
  } = useGlobalStore.getState();
  return <Card className={'Card'}>
    <IconButton className={'AddCardButton'}
                onClick={async () => {
                  const imageData = await openMultiImage('CardAddByFaces');
                  cardAdd(imageData);
                }}>
      <AddIcon fontSize="inherit" />
    </IconButton>
    <div>
      <Button
        fullWidth
        onClick={(e) => {
          e.stopPropagation();
          addCard([null])
        }}
      >
        {t('cardEditor.addEmpty')}
      </Button>
    </div>
  </Card>
}