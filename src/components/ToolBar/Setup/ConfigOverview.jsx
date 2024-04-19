import styles from './styles.module.css';
import React, { useEffect } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import _ from 'lodash';


export const ConfigOverview = () => {
  const Config = useSelector((state) => (
    _.pick(state.pnp.Config, [
      'landscape',
    ])
  ), shallowEqual);
  useEffect(() => {
    const overviewDiv = document.getElementsByClassName(styles.ConfigOverviewPage)?.[0];
    if (Config.landscape) {
      overviewDiv.style.width = '100%';
      overviewDiv.style.height = '30px';
    } else {
      overviewDiv.style.height = '100%';
      overviewDiv.style.width = '30px';
    }
  }, [Config.landscape]);

  return (<div className={styles.ConfigOverview}>
    <div className={styles.ConfigOverviewPage}></div>
  </div>);
};