import { useRef, useLayoutEffect, useCallback } from 'react';

export const useEvent = (handler) => {
  const handlerRef = useRef(null);

  useLayoutEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback((...args) => {
    const fn = handlerRef.current;
    return fn(...args);
  }, []);
};
