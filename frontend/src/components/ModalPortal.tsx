import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const el = useRef(document.createElement('div'));

  useEffect(() => {
    const root = document.body;
    root.appendChild(el.current);
    return () => { root.removeChild(el.current); };
  }, []);

  return createPortal(children, el.current);
};

export default ModalPortal;
