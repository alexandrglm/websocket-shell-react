// ============================================
// WEBSHELL -> Terminal Headers
// ============================================
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import ConnectionStatus from './ConnectionStatus';

import AppMenu from './AppMenu';
import HelpModal from './modals/HelpModal';
import AboutModal from './modals/AboutModal';

import { setIsWebshellFullscreen } from '../../store/slices/appSlice'



const TerminalHeader = ({ 
    isConnected, 
    title = 'WebShell v0.1', 
    onLogout,
    currentDirectory = '~',
    socket, 
    executeCommand, 
    setShowAuthForm 
  }) => {

  // const [ isFullScreen, setIsFullScreen ] = useState(false)
  const [showAppMenu, setShowAppMenu] = useState(false)

  console.log('TerminalHeader render - showAppMenu:', showAppMenu); // LOG 1

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showAboutModal, setShowAboutModal ] = useState(false)
  
  
  //const { isWebshellFullscreen } = useSelector( state => state.app )
  const dispatch = useDispatch()


  // ACCIONES
  const handleClose = () => {
    
    if (onLogout) onLogout();
  };

  const handleMinimize = () => {
    
    dispatch(setIsWebshellFullscreen(false))

  };

  const handleMaximize = () => {
    
    dispatch(setIsWebshellFullscreen(true) );
  
  };

  // MODAL HANDLERS
  const openModal = modal => {

    setShowHelpModal(false)
    setShowAboutModal(false)

    if ( modal === 'help' ) setShowHelpModal(true);
    if ( modal === 'about' ) setShowAboutModal(true)

  }
  
  
  return (
    
    <div className="terminal-header">
    
      <div className="terminal-controls">
    
        <span className="control close" onClick={handleClose}></span>
        <span className="control minimize" onClick={handleMinimize}></span>
        <span className="control maximize" onClick={handleMaximize}></span>
    
      </div>
    
      <div className="terminal-title">
        {currentDirectory} - {title}
      </div>
    
      <div className="connection-status" onClick={() => {
        console.log('Click detectado!'); // LOG 2
        setShowAppMenu(!showAppMenu);
        console.log('Nuevo estado:', !showAppMenu); // LOG 3
      }}>
          
        <span 
          className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}
          style={{ cursor: 'pointer' }}
        ></span>
        <AppMenu 
          isOpen={showAppMenu}
          onClose={() => setShowAppMenu(false)}
          onShowHelp={ () => openModal('help') }
          onShowAbout={ () =>  openModal('about') }
          socket={socket}
          executeCommand={executeCommand}
          setShowAuthForm={setShowAuthForm}
          onLogout={onLogout}
          
        />
    
      </div>

      {/* MODALS START HERE */}
      {showHelpModal && (
        <HelpModal 
          isOpen={showHelpModal}
          onClose={ () => { setShowHelpModal(false) } }
        />
      )}

      {/* MODALS START HERE */}
      {showAboutModal && (
        <AboutModal
          isOpen={showAboutModal}
          onClose={ () => { setShowAboutModal(false) } }
        />
      )}
    
    </div>
  );
};

export default TerminalHeader;