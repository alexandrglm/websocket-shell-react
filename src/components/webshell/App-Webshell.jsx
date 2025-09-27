// ============================================
// WebShell App jsx module
// ============================================
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import Navbar from '../navigation/Navbar';
import Footer from '../commons/Footer';
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



  if (maintenance) {
    // Futuro-> Pasarlo a render otra page concreta, entonces if será !maintenance
    return (
      <div className="app maintenance">
        <h1>Server under maintenance</h1>
      </div>
    );
  }

  return (
    <div className="app" data-fullscreen={isWebshellFullscreen}>
      <Navbar />
      <div className='body-wrapper'>
        <Terminal />
      </div>
      <Footer />
    </div>
  );
};

export default AppWebshell;