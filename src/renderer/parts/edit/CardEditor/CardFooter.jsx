import React, { memo } from 'react';
import Card from '@mui/material/Card';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import { NumberInput } from '../../../componments/NumberInput';
import { layoutSides } from '../../../../shared/constants';

export const CardFooter = memo(({
                                  selected,
                                  onSelectChange,
                                  bleedConfig,
                                  sides,
                                  repeat,
                                  onRepeatChange,
                                  onRemove,
                                  t
                                }) => {
  return (
    <>
      <div className={'CardBar'}>
        <div>
          <Checkbox
            checked={selected}
            onChange={onSelectChange}
          />
        </div>
        {sides !== layoutSides.brochure && bleedConfig && (
          <Card className={'CardOwnConfigDiv'}>
            <div title={t('configDialog.bleed')}>
              <div>{t('cardEditor.face')}:
                <pre> {bleedConfig?.faceBleedX ?? 'NoV'}|{bleedConfig?.faceBleedY ?? 'NoV'}</pre>
              </div>
              {sides !== layoutSides.oneSide && (
                <div>{t('cardEditor.back')}:
                  <pre> {bleedConfig?.backBleedX ?? 'NoV'}|{bleedConfig?.backBleedY ?? 'NoV'}</pre>
                </div>
              )}
            </div>
          </Card>
        )}
        {sides !== layoutSides.brochure && (
          <NumberInput
            width='50px'
            step={1}
            value={repeat}
            min={1}
            max={999}
            onClick={(e) => e.stopPropagation()}
            onChange={onRepeatChange}
          />
        )}
      </div>
      <div>
        <Button fullWidth onClick={onRemove}>
          {t('cardEditor.btnRemove')}
        </Button>
      </div>
    </>
  );
}, (prev, next) => {
  return prev.selected === next.selected &&
    prev.repeat === next.repeat &&
    prev.bleedConfig === next.bleedConfig &&
    prev.sides === next.sides;
});
