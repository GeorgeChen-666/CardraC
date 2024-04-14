import styles from './styles.module.css';
import React, { useContext, useEffect, useRef } from 'react';
import { StoreContext } from '../../../store';


export const ConfigOverview = () => {
  const { state } = useContext(StoreContext);
  const {Config} = state;

  useEffect(()=>{
    const timer = setInterval(()=> {
      const overviewDiv = document.getElementsByClassName(styles.ConfigOverviewPage)?.[0];
      if(overviewDiv) {
        const objData = {};
        new FormData(document.getElementById('formConfigDialog'))
          .forEach((value, key) => objData[key] = value);
        if(objData.landscape) {
          overviewDiv.style.width ='100%';
          overviewDiv.style.height = '30px'
        } else {
          overviewDiv.style.height ='100%';
          overviewDiv.style.width = '30px'
        }
      }
    }, 500);
    return ()=> {
      clearInterval(timer);
    }
  },[])

  return (<div className={styles.ConfigOverview}>
    <div className={styles.ConfigOverviewPage}></div>
  </div>)
}