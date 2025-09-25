// ============================================
// Devel.run main
// ============================================
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import Navbar from './components/navigation/Navbar';
import Terminal from './components/webshell/Terminal';
import Footer from './components/commons/Footer';

import { Icons } from './components/commons/FontAwesome';

// Explícito, si no Vite no procesa sass
import './styles/main.scss'


const App = () => {
  
  const { maintenance, theme } = useSelector(state => state.app);

  useEffect(() => {

    if (theme === 'light') {
    
      document.documentElement.setAttribute('data-theme', 'light');
    
    } else {
    
      document.documentElement.removeAttribute('data-theme');
    
    }
  }, [theme]);



  
  if (maintenance) {
    
    //  Futuro-> Pasarlo a render otra page concreta, entonces if será !maintenance
    return (

      <div className="app maintenance">
        
        <h1>Server under maintenance</h1>
      
      </div>
    
    );
  }
  

  return (
    
    <div className="app">
      
      <Navbar />
      
      
      <div className='body-wrapper'>
        <Terminal />
      </div>

      <Footer />
    
    </div>
  );
};

export default App