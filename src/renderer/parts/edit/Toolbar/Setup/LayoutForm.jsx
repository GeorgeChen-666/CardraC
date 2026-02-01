import React from 'react';
import { FormControl, ControlType } from './FormControl';
import { useTranslation } from 'react-i18next';
import HelpIcon from '@mui/icons-material/Help';
import { useGlobalStore } from '../../../../state/store';
import { flipWay, layoutSides } from '../../../../../shared/constants';
import Tooltip from '@mui/material/Tooltip';

export const LayoutForm = () => {
  const { t } = useTranslation();
  const { mergeConfig } = useGlobalStore.getState();
  const { Config } = useGlobalStore.selectors;

  const sides = Config.sides();
  const autoConfigFlip = Config.autoConfigFlip();
  return (<div className={'FormPanel'}>
    <FormControl label={t('configDialog.size')} width={'260px'} attrKey={'pageSize'} type={ControlType.Select}
                 items={[
                   { label: t('configDialog.custom'), value: '' },
                   { label: 'A5', value: 'A5:148,210' },
                   { label: 'A4', value: 'A4:210,297' },
                   { label: 'A3', value: 'A3:297,420' },
                   { label: 'A2', value: 'A2:420,594' },
                   { label: 'A1', value: 'A1:594,841' },
                 ]}
                 onChange={(e) => {
                   const pageSize = e.target.value;
                   if (pageSize) {
                     const [width, height] = e.target.value.replace(/A\d:/, '').split(',');
                     mergeConfig({ pageSize, pageWidth: parseInt(width), pageHeight: parseInt(height) });
                   }
                 }}
    >
      <FormControl label={t('configDialog.landscape')} attrKey={'landscape'} type={ControlType.Checkbox}></FormControl>
    </FormControl>
    <FormControl label={t('configDialog.pageWidthHeight')} width={'145px'} attrKey={'pageWidth'} min={0}
                 type={ControlType.NumberInput} onChange={(e, v) => mergeConfig({ ['pageWidth']: v, pageSize: '' })}>
      <FormControl width={'145px'} attrKey={'pageHeight'} type={ControlType.NumberInput} min={0}
                   onChange={(e, v) => mergeConfig({ ['pageHeight']: v, pageSize: '' })}
      >
        mm
      </FormControl>
    </FormControl>
    <FormControl label={t('configDialog.offsetXY')} width={'145px'} attrKey={'offsetX'} type={ControlType.NumberInput}>
      <FormControl width={'145px'} attrKey={'offsetY'} type={ControlType.NumberInput}>
        mm
      </FormControl>
    </FormControl>
    <FormControl label={t('configDialog.side')} width={'310px'} attrKey={'sides'} type={ControlType.Select} items={[
      { label: t('configDialog.oneSide'), value: layoutSides.oneSide },
      { label: t('configDialog.foldInHalf'), value: layoutSides.foldInHalf },
      { label: t('configDialog.doubleSides'), value: layoutSides.doubleSides },
      { label: t('configDialog.brochure'), value: layoutSides.brochure },
    ]}>
    </FormControl>

    {![layoutSides.oneSide, layoutSides.foldInHalf].includes(sides) &&
      (<>
        <FormControl disabled={autoConfigFlip} label={t('configDialog.flip')} width={'230px'}
                     onChange={e => {
                       const flip = e.target.value;
                       mergeConfig({ flip, autoConfigFlip: (flip === '') });
                     }}
                     attrKey={'flip'} type={ControlType.Select} items={[
          // { label: t('configDialog.auto'), value: '' },
          { label: t('configDialog.longEdgeBinding'), value: flipWay.longEdgeBinding },
          { label: t('configDialog.shortEdgeBinding'), value: flipWay.shortEdgeBinding },
        ]}>
          <Tooltip title={t('configDialog.flipRemark')}>
            <HelpIcon />
          </Tooltip>
        </FormControl>
      </>)
    }
    {layoutSides.foldInHalf === sides &&
      (<FormControl label={t('configDialog.foldLine')} width={'145px'} attrKey={'foldLineType'}
                    type={ControlType.RadioGroup}
                    items={[
                      { label: t('configDialog.foldLineH'), value: '0' },
                      { label: t('configDialog.foldLineV'), value: '1' },
                    ]} />)}
    <FormControl label={t('configDialog.pageNumber')} attrKey={'pageNumber'} type={ControlType.Checkbox}></FormControl>
  </div>);
};