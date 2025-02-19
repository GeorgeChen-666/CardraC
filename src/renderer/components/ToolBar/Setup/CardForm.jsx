import { Checkbox } from '@chakra-ui/react';
import React, { useEffect } from 'react';
import { Control, ControlType } from './Control';
import './styles.css';
import { Actions } from '../../../store';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import _ from 'lodash';
import { useTranslation } from 'react-i18next';
import { layoutSides } from '../../../../public/constants';

export const CardForm = () => {
  const { t } = useTranslation();
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'marginFilling',
      'avoidDislocation',
      'columns',
      'rows',
      'cardWidth',
      'cardHeight',
      'marginX',
      'marginY',
      'autoColumnsRows',
      'bleedX',
      'bleedY',
      'landscape',
      'pageSize',
      'pageWidth',
      'pageHeight',
      'sides',
      'foldInHalfMargin',
      'brochureRepeatPerPage'
    ])
  ), shallowEqual);
  const dispatch = useDispatch();
  const isBrochure = Config.sides === layoutSides.brochure;
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  useEffect(() => {
    if (Config.autoColumnsRows) {
      const pageWidth = Config.landscape ? Config.pageHeight : Config.pageWidth;
      const pageHeight = (Config.landscape ? Config.pageWidth : Config.pageHeight) - Config.foldInHalfMargin;
      const autoColumns = parseInt((pageWidth * 0.95) / (Config.cardWidth * (isBrochure ? 2:1) + Config.marginX));
      let autoRows = parseInt((pageHeight * 0.95) / (Config.cardHeight + Config.marginY));
      autoRows = autoRows - ((autoRows % 2 === 1 && isFoldInHalf) ? 1 : 0);
      const newConfig = { columns: autoColumns, rows: autoRows };
      dispatch(Actions.ConfigEdit(newConfig));
    }
  }, [
    Config.marginFilling,
    Config.autoColumnsRows,
    Config.pageSize,
    Config.pageWidth,
    Config.pageHeight,
    Config.cardWidth,
    Config.cardHeight,
    Config.marginX,
    Config.marginY,
    Config.landscape,
    Config.foldInHalfMargin,
    Config.sides
  ]);

  useEffect(() => {
    if(Config.bleedX > Config.marginX / 2) {
      dispatch(Actions.ConfigEdit({ bleedX: Config.marginX / 2 }))
    }
    if(Config.bleedY > Config.marginY / 2) {
      dispatch(Actions.ConfigEdit({ bleedY: Config.marginY / 2 }))
    }
  }, [
    Config.marginX,
    Config.marginY,
    Config.bleedX,
    Config.bleedY
  ]);

  return (<div className={'FormPanel'}>
    <Control label={t('configDialog.cardWidth')} attrKey={'cardWidth'} type={ControlType.NumberInput}>
      mm
    </Control>
    <Control label={t('configDialog.cardHeight')} attrKey={'cardHeight'} type={ControlType.NumberInput}>
      mm
    </Control>
    {!isBrochure && (
      <Control
        label={`${t('configDialog.marginX')} / ${t('configDialog.marginY')}`}
        attrKey={'marginX'}
        type={ControlType.NumberInput}
        style={{ width: '90px' }}
      >
        mm
        <Control attrKey={'marginY'} type={ControlType.NumberInput} style={{ width: '90px', marginLeft: '41px' }}>
          mm
        </Control>
      </Control>
    )}
    {isFoldInHalf && (
      <Control label={'对贴间距'} type={ControlType.NumberInput} attrKey={'foldInHalfMargin'} style={{ width: '90px' }} min={0}>
        mm
      </Control>
    )}
    <Control
      label={t('configDialog.bleed')}
      attrKey={'bleedX'}
      type={ControlType.NumberInput}
      style={{ width: '90px' }}
      step={0.1}
      max={Config.marginX / 2}
    >
      mm
      <Control
        attrKey={'bleedY'}
        type={ControlType.NumberInput}
        style={{ width: '90px', marginLeft: '41px' }}
        step={0.1}
        max={Config.marginY / 2}
      >
        mm
      </Control>
    </Control>
    <Control
      label={t('configDialog.columns_rows')}
      type={ControlType.NumberInput}
      attrKey={'rows'}
      style={{ width: '90px' }}
      min={isFoldInHalf ? 2 : 1}
      step={isFoldInHalf ? 2 : 1}
    >
      <Control type={ControlType.NumberInput} attrKey={'columns'} style={{ width: '90px' }} min={1}>

      </Control>
      <Checkbox value={'true'} isChecked={Config.autoColumnsRows}
                onChange={(event) => dispatch(Actions.ConfigEdit({ autoColumnsRows: event.target.checked }))}
      >{t('configDialog.auto')}</Checkbox>
    </Control>
    <Control
      label={t('configDialog.scale')}
      attrKey={'scale'}
      type={ControlType.NumberInput}
      style={{ width: '90px' }}
      min={1}
    >%
      {/*<span style={{ width: '113px' }}></span>*/}
    </Control>
    <Control label={' '}>
      {Config.sides === layoutSides.brochure && (<>
        <Checkbox value={'true'} isChecked={Config.brochureRepeatPerPage}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ brochureRepeatPerPage: event.target.checked }))}
        >{t('configDialog.brochureRepeatPerPage')}</Checkbox>
      </>)}
      {Config.sides !== layoutSides.brochure && (<>
        <Checkbox value={'true'} isChecked={Config.marginFilling}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ marginFilling: event.target.checked }))}
        >{t('configDialog.marginFilling')}</Checkbox>
        <span style={{width: '65px'}}></span>
      </>)}
      {Config.sides === layoutSides.doubleSides && (<>
        <Checkbox value={'true'} isChecked={Config.avoidDislocation}
                  onChange={(event) => dispatch(Actions.ConfigEdit({ avoidDislocation: event.target.checked }))}
        >{t('configDialog.avoidDislocation')}</Checkbox>
      </>)}


    </Control>

  </div>);
};