import React, { useEffect, useState } from 'react';
import { layoutSides } from '../../../../public/constants';
import { useGlobalStore } from '../../../State/store';


export const ConfigOverview = () => {
  const { selectors } = useGlobalStore;
  const Config = selectors.Config
  const foldInHalfMargin = Config.foldInHalfMargin();
  const pageWidth = Config.pageWidth();
  const pageHeight = Config.pageHeight();
  const columns = Config.columns();
  const rows = Config.rows();
  const cardWidth = Config.cardWidth();
  const cardHeight = Config.cardHeight();
  // const marginX = Config.marginX();
  // const marginY = Config.marginY();
  const landscape = Config.landscape();
  const sides = Config.sides();

  const isBrochure = sides === layoutSides.brochure;
  const isFoldInHalf = sides === layoutSides.foldInHalf;
  const foldLineType = Config.foldLineType();
  const [boxCardSize, setBoxCardSize] = useState(`0,0`);
  const [boxScale, setBoxScale] = useState(1);
  const scaledFoldInHalfMargin = foldInHalfMargin * boxScale;
  let [boxCardWidth, boxCardHeight] = boxCardSize.split(',');
  useEffect(() => {
    setTimeout(() => {
      const boxDiv = document.getElementsByClassName('ConfigOverview')?.[0];
      const boxWidth = boxDiv.offsetWidth - 20;
      const boxHeight = boxDiv.offsetHeight - 20;
      const boxScale = Math.min(boxWidth / pageWidth, boxHeight / pageHeight);
      const overviewDiv = document.getElementsByClassName('ConfigOverviewPage')?.[0];
      const scaledPageHeight = pageHeight * boxScale;
      const scaledPageWidth = pageWidth * boxScale;
      const scaledCardHeight = cardHeight * boxScale;
      const scaledCardWidth = cardWidth * boxScale * (isBrochure ? 2:1);
      setBoxScale(boxScale);
      if (landscape) {
        overviewDiv.style.gap = `1px`;
        overviewDiv.style.height = `${scaledPageWidth}px`;
        overviewDiv.style.width = `${scaledPageHeight}px`;
        setBoxCardSize(`${scaledCardWidth},${scaledCardHeight}`);
      } else {
        overviewDiv.style.gap = `1px`;
        overviewDiv.style.height = `${scaledPageHeight}px`;
        overviewDiv.style.width = `${scaledPageWidth}px`;
        setBoxCardSize(`${scaledCardWidth},${scaledCardHeight}`);
      }
    }, 0);
  }, [pageHeight, pageWidth, cardHeight, cardWidth, landscape, isBrochure]);
  return (<div className={'ConfigOverview'}>
    <div className={'ConfigOverviewPage'}>
      <table className={isBrochure?'brochureTable':''}>
        <tbody>
          {
            [...new Array(rows)].map((e,i)=>(<tr key={'tr'+i}>
              {
                [...new Array(columns)].map((e,ii) => {
                  const cardStyle = { width: `${boxCardWidth - 1}px`, height: `${boxCardHeight - 1}px` }
                  if(i === rows / 2 - 1 && isFoldInHalf && foldLineType === '0') {
                    cardStyle.marginBottom = `${Math.max(scaledFoldInHalfMargin - 1, 1)}px`
                  }
                  if(ii === columns / 2 - 1 && isFoldInHalf && foldLineType === '1') {
                    cardStyle.marginRight = `${Math.max(scaledFoldInHalfMargin - 1, 1)}px`
                  }
                  return (<td key={'td:' + i + '_' + ii} style={cardStyle} />)
                })
              }
            </tr>))
          }
        </tbody>
      </table>
    </div>
  </div>);
};