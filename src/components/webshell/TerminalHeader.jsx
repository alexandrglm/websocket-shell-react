// ============================================
// WEBSHELL -> Terminal Headers
// ============================================
import React, { useState, useEffect } from 'react';
import ConnectionStatus from './ConnectionStatus';

const TerminalHeader = ({ isConnected, title = 'WebShell v0.1', onLogout }) => {

  const [ isFullScreen, setIsFullScreen ] = useState(false)


  // PARA DETECTAR FULLSCREEEN, o no, TIENE QUE IR ANTES DE LOS HANDLERS
  useEffect(() => {
    const handleFullscreenChange = () => {
      
      setIsFullscreen(!!document.fullscreenElement);
    
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);



  // ACCIONES
  const handleClose = () => {
    
    if (onLogout) onLogout();
  };

  const handleMinimize = () => {
    
    if (document.fullscreenElement) {
    
      document.exitFullscreen();
    
    }
  };

  const handleMaximize = () => {
    
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    
    }
  
  };
  
  
  return (
    
    <div className="terminal-header">
    
      <div className="terminal-controls">
    
        <span className="control close" onClick={handleClose}></span>
        <span className="control minimize" onClick={handleMinimize}></span>
        <span className="control maximize" onClick={handleMaximize}></span>
    
      </div>
    
      <div className="terminal-title">
        {title}
      </div>
    
      <div className="connection-status">
    
        <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></span>
    
      </div>
    
    </div>
  );
};

export default TerminalHeader;