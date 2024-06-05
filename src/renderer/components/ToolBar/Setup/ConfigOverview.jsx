import './styles.css';
import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';


export const ConfigOverview = () => {
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'pageWidth',
      'pageHeight',
      'columns',
      'rows',
      'cardWidth',
      'cardHeight',
      'marginX',
      'marginY',
      'landscape',
    ])
  ), shallowEqual);
  const [boxCardSize, setBoxCardSize] = useState(`0,0`)
  useEffect(() => {
    setTimeout(()=>{
      const boxDiv = document.getElementsByClassName('ConfigOverview')?.[0];
      const boxWidth = boxDiv.offsetWidth - 20;
      const boxHeight = boxDiv.offsetHeight - 20;
      const boxScale = Math.min(boxWidth / Config.pageWidth, boxHeight / Config.pageHeight)
      const overviewDiv = document.getElementsByClassName('ConfigOverviewPage')?.[0];

      if (Config.landscape) {
        overviewDiv.style.gap = `${Config.marginY * boxScale}px ${Config.marginX * boxScale}px`
        overviewDiv.style.height = `${Config.pageWidth * boxScale}px`;
        overviewDiv.style.width = `${Config.pageHeight * boxScale}px`;

      } else {
        overviewDiv.style.gap = `${Config.marginX * boxScale}px ${Config.marginY * boxScale}px`
        overviewDiv.style.height = `${Config.pageHeight * boxScale}px`;
        overviewDiv.style.width = `${Config.pageWidth * boxScale}px`;
      }
    }, 100)
  }, [Config.landscape]);

  return (<div className={'ConfigOverview'}>
    <div className={'ConfigOverviewPage'}>
      <div></div>
      <div></div>
      <div></div>
      <div></div>
    </div>
  </div>);
};