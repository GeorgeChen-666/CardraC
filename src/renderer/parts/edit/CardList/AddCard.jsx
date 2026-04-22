import Card from '@mui/material/Card';
import { useTranslation } from 'react-i18next';
import AddIcon from '@mui/icons-material/Add';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import React from 'react';
import { useGlobalStore } from '../../../state/store';
import { openMultiImage } from '../../../functions';
import { layoutSides } from '../../../../shared/constants';

export default () => {
  const { t } = useTranslation();
  const { cardAdd } = useGlobalStore.getState();
  const Config = useGlobalStore(state => state.Config);
  const isDoubleSides = Config.sides === layoutSides.doubleSides || Config.sides === layoutSides.foldInHalf
  return <Card className={'Card'}>
    <IconButton className={'AddCardButton'}
                onClick={async () => {
                  const imageData = await openMultiImage(isDoubleSides);
                  cardAdd(imageData);
                }}>
      <AddIcon fontSize="inherit" />
    </IconButton>
    <div>
      <Button
        fullWidth
        onClick={(e) => {
          e.stopPropagation();
          cardAdd([{}])
        }}
      >
        {t('cardEditor.addEmpty')}
      </Button>
    </div>
  </Card>
}