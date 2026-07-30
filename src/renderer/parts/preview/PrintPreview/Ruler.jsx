import * as React from 'react';

export const Ruler = ({ orientation, length }) => {
  const pixelsPerMM = 10;
  const majorTickInterval = 10;

  const ticks = [];
  const maxMM = Math.ceil(length / pixelsPerMM);

  for (let mm = 0; mm <= maxMM; mm++) {
    const position = mm * pixelsPerMM;
    const isMajor = mm % majorTickInterval === 0;

    ticks.push({
      position,
      mm,
      isMajor
    });
  }

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      style={{
        position: 'absolute',
        top: isHorizontal ? '-25px' : '0',
        left: isHorizontal ? '0' : '-25px',
        [isHorizontal ? 'width' : 'height']: `${length}px`,
        [isHorizontal ? 'height' : 'width']: '25px',
        backgroundColor: 'rgba(240, 240, 240, 0.9)',
        borderBottom: isHorizontal ? '1px solid #999' : 'none',
        borderRight: isHorizontal ? 'none' : '1px solid #999',
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    >
      {ticks.map((tick, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: `${tick.position}px`,
            [isHorizontal ? 'bottom' : 'right']: 0,
            [isHorizontal ? 'width' : 'height']: '1px',
            [isHorizontal ? 'height' : 'width']: tick.isMajor ? '10px' : '5px',
            backgroundColor: '#666'
          }}
        />
      ))}
      {ticks.filter(t => t.isMajor).map((tick, i) => (
        <div
          key={`label-${i}`}
          style={{
            position: 'absolute',
            [isHorizontal ? 'left' : 'top']: isHorizontal ? `${tick.position + 2}px` : `${tick.position + 8}px`,
            [isHorizontal ? 'top' : 'left']: '2px',
            fontSize: '10px',
            color: '#333',
            transform: isHorizontal ? 'none' : 'rotate(-90deg)',
            transformOrigin: isHorizontal ? 'none' : 'left top',
            whiteSpace: 'nowrap'
          }}
        >
          {tick.mm}
        </div>
      ))}
    </div>
  );
};