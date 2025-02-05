import './styles.css';
import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';
import { layoutSides } from '../../../../public/constants';


export const ConfigOverview = () => {
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'foldInHalfMargin',
      'pageWidth',
      'pageHeight',
      'columns',
      'rows',
      'cardWidth',
      'cardHeight',
      'marginX',
      'marginY',
      'landscape',
      'sides',
    ])
  ), shallowEqual);
  const isBrochure = Config.sides === layoutSides.brochure;
  const isFoldInHalf = Config.sides === layoutSides.foldInHalf;
  const [boxCardSize, setBoxCardSize] = useState(`0,0`);
  const [boxScale, setBoxScale] = useState(1);
  const scaledFoldInHalfMargin = Config.foldInHalfMargin * boxScale;
  let [boxCardWidth, boxCardHeight] = boxCardSize.split(',');
  useEffect(() => {
    setTimeout(() => {
      const boxDiv = document.getElementsByClassName('ConfigOverview')?.[0];
      const boxWidth = boxDiv.offsetWidth - 20;
      const boxHeight = boxDiv.offsetHeight - 20;
      const boxScale = Math.min(boxWidth / Config.pageWidth, boxHeight / Config.pageHeight);
      const overviewDiv = document.getElementsByClassName('ConfigOverviewPage')?.[0];
      const scaledPageHeight = Config.pageHeight * boxScale;
      const scaledPageWidth = Config.pageWidth * boxScale;
      const scaledCardHeight = Config.cardHeight * boxScale;
      const scaledCardWidth = Config.cardWidth * boxScale * (isBrochure ? 2:1);
      setBoxScale(boxScale);
      if (Config.landscape) {
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
  }, [JSON.stringify(Config)]);
  return (<div className={'ConfigOverview'}>
    <div className={'ConfigOverviewPage'}>
      <table className={isBrochure?'brochureTable':''}>
        {
          [...new Array(Config.rows)].map((e,i)=>(<tr key={'tr'+i}>
            {
              [...new Array(Config.columns)].map((e,ii) => {
                const cardStyle = { width: `${boxCardWidth - 1}px`, height: `${boxCardHeight - 1}px` }
                if(i === Config.rows / 2 - 1 && isFoldInHalf) {
                  cardStyle.marginBottom = `${Math.max(scaledFoldInHalfMargin - 1, 1)}px`
                }
                return (<td key={'td:' + i + '_' + ii} style={cardStyle} />)
              })
            }
          </tr>))
        }
      </table>
    </div>
  </div>);
};