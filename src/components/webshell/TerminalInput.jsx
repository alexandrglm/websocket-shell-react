// ============================================
// WEBSHELL -> Terminal input (footer)
// ============================================
import React, { useRef, useEffect } from 'react';

const TerminalInput = ({ 

  currentCommand, 
  setCurrentCommand, 
  onExecuteCommand, 
  onNavigateHistory, 
  isExecuting,
  isWaitingForInput,
  isPtyActive,
  isAuthenticated,
  terminalInputRef,
  socket,
  disabled

}) => {
  
  // Al haber añadido handleWebshellFocus() ya no podemos edjar null las inputref
  // const inputRef = useRef(null);

  // Auto focus
  useEffect(() => {
  
    if (isAuthenticated && terminalInputRef.current) {
      
      terminalInputRef.current.focus();
    
    }
  
  }, [isAuthenticated]);

  
  const handleKeyPress = (e) => {

    if (e.key === 'Enter') {
    
      if (isWaitingForInput && socket) {
    
    
        // Send input to running process
        socket.emit('command_input', { input: currentCommand });
        setCurrentCommand('');
    
    
      } else {
        // Execute new command
        onExecuteCommand(currentCommand);
    
      }
    }
  };

  const handleKeyDown = (e) => {
  
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigateHistory('up');
  
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigateHistory('down');
  
    } else if (e.ctrlKey && e.key === 'd') { // CHANGE ENTIRE BLOCK
      e.preventDefault();
      
      // Cancelar comando spawn en ejecución
      if (isExecuting && !isPtyActive && socket) {
        console.log('[DEBUG] CTRL+D: Canceling spawn command');
        socket.emit('cancel_command');
        return;
      }
      
      // Enviar EOF si hay proceso PTY activo
      if (isPtyActive && socket) {
        console.log('[DEBUG] Sending EOF (CTRL+D) to PTY process');
        socket.emit('command_input', { input: '\x04' });
      }
    }

  };






  return (
  
    <div className="terminal-input-container">
    
      {!isPtyActive && (
        <div className="terminal-prompt">
      
          <span className="prompt-user">user@webshell</span>
          <span className="prompt-separator">:</span>
          <span className="prompt-path">~</span>
          <span className="prompt-symbol">$</span>
      
        </div>
      )}

      <input
    
        ref={terminalInputRef}
        type="text"
        value={currentCommand}
        onChange={(e) => setCurrentCommand(e.target.value)}
        onKeyPress={handleKeyPress}
        onKeyDown={handleKeyDown}
        className="terminal-input"
        disabled={disabled} // CHANGE
        autoComplete="off"
        spellCheck="false"
        placeholder={isExecuting ? 'Executing ...' : ( isWaitingForInput ? '' : '' )} // no hay otra solucón quedoble elvis
      
      />
    
    </div>
  );
};

export default TerminalInput;