// ============================================
// App-ServerDos.jsx - ServerDos Module Main App
// ============================================
import React from 'react';

import './styles/main.scss'

import Maintenance from './pages/Maintenance';

const AppServerDos = () => {
  
  return (
    <div className="app-serverdos">
      
      {/* Por ahora solo mostramos maintenance */}
      <Maintenance />
      
      {/* 
      Futuro:
      - <Navbar-ServerDos />
      - React Router para múltiples pages
      - <Footer-ServerDos />
      */}
      
    </div>
  );
};

export default AppServerDos;