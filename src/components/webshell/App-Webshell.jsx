// ============================================
// App-webshell.jsx - WebShell Application
// ============================================
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';


import Terminal from './Terminal';


// Explícito, si no Vite no procesa sass
import '../../styles/main.scss';

const AppWebshell = () => {
  
  const { maintenance, theme, isWebshellFullscreen } = useSelector(state => state.app);

  // SLICE WEB THEMES
  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  // SLICE WEBAPP FULLSCREEN
  useEffect(() => {
    document.documentElement.setAttribute('data-fullscreen', isWebshellFullscreen);
  }, [isWebshellFullscreen]);


  return (
      <Terminal />
  );
};

export default AppWebshell;