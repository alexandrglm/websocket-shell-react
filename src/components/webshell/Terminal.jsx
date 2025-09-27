// ============================================
// WEBSHELL -> MAIN 
// ============================================
import React, { useEffect, useRef, useState } from 'react';

import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';
import { useTerminal } from '../../hooks/useTerminal';

// import { TERMINAL_CONFIG } from './TerminalConfig';
import TerminalHeader from './TerminalHeader';
import TerminalOutput from './TerminalOutput';
import TerminalInput from './TerminalInput';
import AuthForm from './modals/AuthModal';

import { Icons, faHeartCrack } from '../commons/FontAwesome';

const Terminal = ({ className = '' }) => {
  
  const { socket, isConnected, connect, disconnect, emit } = useSocket();

  // En paralelo a useTerminal ->  if ( cmd === 'login' ) 
  const [showAuthForm, setShowAuthForm ] = useState(false)
  const [guestMode, useGuestMode ] = useState(true)

  const [showReconnectModal, setShowReconnectModal ] = useState(false)

  // Para el PWD MARKER del header
  const [currentDirectory, setCurrentDirectory ] = useState('~')

  // para handleWebshellFocus()
  // Para mejorar inputm focus-captura click, useRef inicial  
  const terminalInputRef = useRef(null)

  
  
  const { 
  
    isAuthenticated, 
    isAuthenticating, 
    authError, 
    remainingAttempts, 
    isLockedOut, 
    authenticate, 
    logout 
  
  } = useAuth(socket, () => setShowAuthForm(false));
  
  const {
    output,
    currentCommand,
    setCurrentCommand,
    isExecuting,
    isWaitingForInput,
    isPtyActive,
    outputRef,
    executeCommand,
    navigateHistory,
    clearOutput
  
  } = useTerminal(socket, isAuthenticated, guestMode, setShowAuthForm, terminalInputRef, setCurrentDirectory);

  
  
  // CONECTAR:  Mount -> Y connect el Socket; mucho cuidado con mount los estados constantemente
  useEffect(() => {
  
    connect();
    return () => disconnect();
  
  }, [])  
  //}, [connect, disconnect]); !!!!!!!!!!



  // DESCONECTAR: Unmount -> Lo mismo, mucho cuidado con los estados
  useEffect(() => {
    
    if (socket) {
    
      const handleDisconnect = () => {
        logout();
        clearOutput();
      };
      
      socket.on('disconnect', handleDisconnect);
    
      return () => socket.off('disconnect', handleDisconnect);
    }
  
  }, [socket] )
  // }, [socket, logout, clearOutput]); !!!!!!!!!!!!!!!!!!!!!

// LOGOUT (socket.disconnect(true) )
useEffect(() => {
  if (socket) {
    
    const handleDisconnect = (reason) => {
      
      console.log('[DEBUG] Socket disconnected:', reason);
      
      setShowReconnectModal(true);
      logout();
      clearOutput();
    
    };
    
    socket.on('disconnect', handleDisconnect);
    
    return () => socket.off('disconnect', handleDisconnect);
  }
}, [socket, logout, clearOutput]);






  const handleWebshellFocus = () => {

    if ( terminalInputRef.current && ( isAuthenticated || guestMode )  ){

      terminalInputRef.current.focus()

    }

  }


  
  return (
    
    <div className={`webshell ${className}`} >
    
      <div className="terminal-container" onClick={handleWebshellFocus}>
    
        <TerminalHeader 
          isConnected={isConnected}
          onLogout={ () => { socket?.disconnect(); logout();}}
          currentDirectory={currentDirectory}
          socket={socket}
          executeCommand={executeCommand}
          setShowAuthForm={setShowAuthForm}
        />
        
        <div className="terminal-body" ref={outputRef}>
    
          <TerminalOutput 
            output={output} 
            isExecuting={isExecuting}
            isWaitingForInput={isWaitingForInput}
            outputRef={outputRef}
          />
          
          <TerminalInput
            currentCommand={currentCommand}
            setCurrentCommand={setCurrentCommand}
            onExecuteCommand={executeCommand}
            onNavigateHistory={navigateHistory}
            isExecuting={isExecuting}
            isWaitingForInput={isWaitingForInput}
            isPtyActive={isPtyActive}
            isAuthenticated={isAuthenticated || guestMode }
            terminalInputRef={terminalInputRef}
            socket={socket}
            disabled={showAuthForm}
          />
    
        </div>

        {/* MODALS  */}


        {showAuthForm && (
          
          
          <div className="auth-modal">
            
            <div className="auth-overlay" onClick={() => setShowAuthForm(false)}></div>
            <AuthForm
              onAuthenticate={authenticate}
              isAuthenticating={isAuthenticating}
              authError={authError}
              remainingAttempts={remainingAttempts}
              isLockedOut={isLockedOut}
              isConnected={isConnected}
              onBack={() => setShowAuthForm(false)}
            />
          </div>
        )}


        {/* Modal de reconexión */}
        {showReconnectModal && (
          
          <div className="auth-modal">
          
            <div className="auth-overlay"></div>
          
            <div className="auth-container">

              <div className="auth-icon red">
                <Icons icon={faHeartCrack} />
              </div>
          
              <h2>Connection Ended</h2>
              <p>Your session has ended, but you can reconnect by signing in again.  
              If you did not sign out yourself, please check your connection.</p>
          
          
              <button 
                type="button"
                onClick={() => {
                  setShowReconnectModal(false);
                  connect();
                }} 
                className="auth-button"
              >
                Sign In Again
              </button>
          
            </div>
          
          </div>
        )}


        
      </div>
    </div>
  );
};

export default Terminal;