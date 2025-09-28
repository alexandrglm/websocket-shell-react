// ============================================
// App-webshell.jsx - WebShell Application
// ============================================
import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import Footer from '../commons/Footer';

import AppWebshell from '../webshell/App-Webshell';


// Explícito, si no Vite no procesa sass
import '../../styles/main.scss';

const Index = () => {
    
    const { theme, isWebshellFullscreen } = useSelector(state => state.app);

    // SLICE WEB THEMES
    useEffect(() => {
        
        
        if (theme === 'light') {
            
            document.documentElement.setAttribute('data-theme', 'light');
        
        } else {
        
            document.documentElement.removeAttribute('data-theme');
        
        }
    
    }, [theme]);



    return (
        
        <div className="app">
            
            <div className='body-wrapper'>
                <AppWebshell />
            </div>
            
            <Footer />
        
        </div>
    );
};

export default Index;