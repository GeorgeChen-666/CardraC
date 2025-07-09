import { useStore } from '../../../State/store';
import { layoutSides } from '../../../../public/constants';
import { useEffect } from 'react';

export default () => {
  const { selectors: { Config }, mergeConfig } = useStore.getState();
  const marginFilling = Config.marginFilling();
  const bleedX = Config.bleedX();
  const bleedY = Config.bleedY();
  const cardWidth = Config.cardWidth();
  const cardHeight = Config.cardHeight();
  const marginX = Config.marginX();
  const marginY = Config.marginY();
  const pageSize = Config.pageSize();
  const autoColumnsRows = Config.autoColumnsRows();
  const pageWidth = Config.pageWidth();
  const pageHeight = Config.pageHeight();
  const foldInHalfMargin = Config.foldInHalfMargin();
  const landscape = Config.landscape();
  const sides = Config.sides();
  const isBrochure = Config.sides() === layoutSides.brochure;
  const isFoldInHalf = Config.sides() === layoutSides.foldInHalf;

  useEffect(() => {

  }, [pageSize]);

  useEffect(() => {
    if (autoColumnsRows) {
      const pWidth = landscape ? pageHeight : pageWidth;
      const pHeight = (landscape ? pageWidth : pageHeight) - foldInHalfMargin;
      const autoColumns = parseInt((pWidth * 0.95) / (cardWidth * (isBrochure ? 2 : 1) + marginX));
      let autoRows = parseInt((pHeight * 0.95) / (cardHeight + marginY));
      autoRows = autoRows - ((autoRows % 2 === 1 && isFoldInHalf) ? 1 : 0);
      const newConfig = { columns: autoColumns, rows: autoRows };
      mergeConfig(newConfig);
    }
  }, [
    marginFilling,
    autoColumnsRows,
    pageSize,
    pageWidth,
    pageHeight,
    cardWidth,
    cardHeight,
    marginX,
    marginY,
    landscape,
    foldInHalfMargin,
    sides,
  ]);

  useEffect(() => {
    if(bleedX > marginX / 2) {
      mergeConfig({ bleedX: marginX / 2 })
    }
    if(bleedY > marginY / 2) {
      mergeConfig({ bleedY: marginY / 2 })
    }
  }, [marginX, marginY, bleedX, bleedY]);
}