// ============================================
// WEBSHELL -> Hook -> Pesadilla de terminal
// ============================================
import { useState, useCallback, useRef, useEffect } from 'react';

export const useTerminal = (
    socket, 
    isAuthenticated, 
    guestMode = false, 
    setShowAuthForm = null,
    terminalInputRef = null,
    setCurrentDirectory = null
  ) => {

  const [output, setOutput] = useState([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isWaitingForInput, setIsWaitingForInput] = useState(false)
  const [isPtyActive, setIsPtyActive ] = useState(false)
  const [initialPwdSent, setInitialPwdSent] = useState(false);

  const outputRef = useRef(null);



  // TERM HEADER MESSAGE CONDITIONS
  useEffect(() => {
    
    // Ahora SI tenemos condiciones.
    if (isAuthenticated || guestMode) {
      
      const welcomeMessage = isAuthenticated 
        ? [
            '🚀 Authenticated access to WebShell',
            '',
            'Type "help" to see available commands.',
            'Type "clear" to clear the screen.',
            'Type "exit" to close the session.',
            ''
          ]
        : [
            '👋 Welcome to WebShell - Guest Mode',
            '',
            'Type "help" to see available commands.',
            'Type "login" to authenticate for full access.',
            'Type "clear" to clear the screen.',
            ''
          ];

      setOutput([{
        type: 'system',
        content: welcomeMessage
      }]);
    }
  }, [isAuthenticated, guestMode]);

  
  // Socket event listeners
  useEffect(() => {
   
    if (!socket || !(isAuthenticated || guestMode)) return;
    
    //
    const handleCommandOutput = (data) => {


      // HEADER PWD MARKER
      if (data.currentDirectory && setCurrentDirectory) {

        setCurrentDirectory(data.currentDirectory);
      }

      // Only show output if there's actual content
      if (data.output && data.output.trim() !== '' && data.output !== 'Command OK') {
        
        setOutput(prev => [...prev, {
          type: 'response',
          content: data.output.split('\n')
        }]);
      }
      
      setIsExecuting(false);
    };

    
    
    const handleCommandError = (data) => {


    
      setOutput(prev => [...prev, {
        type: 'error',
        content: [data.error || 'Error executing command']
      }]);
    
      setIsExecuting(false);
    };

    // STDOUT STDERR de INTERACTIVOS
    const handleCommandStream = (data) => {

      console.log('[DEBUG STREAM RECEIVED] -> ', data.type,' : ',  data.data) 
      
      if (data.type === 'stdout' || data.type === 'stderr') {

        console.log('[DEBUG] Adding stream to output, isPtyActive:', isPtyActive); // Debug
        
        setOutput(prev => {
        
          const lastItem = prev[prev.length - 1];
          
        
          if (lastItem && lastItem.type === 'streaming') {
        
            return [
              ...prev.slice(0, -1),
              {
                ...lastItem,
                content: [...lastItem.content, data.data]
              }
            ];
          }
          
          return [...prev, {
            type: 'streaming',
            content: [data.data]
          }];
        });

      }
    };

    // COMMAND COMPLETE FINAL FLOW
    const handleCommandComplete = (data) => {


      
      setIsExecuting(false);
      setIsWaitingForInput(false);
      setIsPtyActive(false);

      /*
      if (!data.success && data.exitCode !== 0) {
        setOutput(prev => [...prev, {
          type: 'error',
          content: [`Command exited with code: ${data.exitCode}`]
        }]);
      }
      */
    };

    const handlePtyInputReady = () => {

      console.log('[DEBUG] PTY ready for input');
      //setIsPtyActive(true);
      setIsWaitingForInput(true);
      setIsExecuting(false)
    };
    


    const handlePtySessionStarted = () => {

      console.log('[DEBUG] Handle PTY Session Handler WORKING');

      setIsPtyActive(true);
      setIsExecuting(true)

    }

    // CHANGE BLOCK ENTERO
    const handleCommandCancel = () => {
      console.log('[DEBUG] Command canceled by user');
      setIsExecuting(false);
      setIsWaitingForInput(false);
      setIsPtyActive(false);
      
      setOutput(prev => [...prev, {
          type: 'error',
          content: ['^C - Command canceled']
      }]);
  };



    socket.on('command_output', handleCommandOutput);
    socket.on('command_error', handleCommandError);
    socket.on('command_stream', handleCommandStream);
    socket.on('command_complete', handleCommandComplete)
    socket.on('pty_input_ready', handlePtyInputReady)
    socket.on('pty_session_started', handlePtySessionStarted)
    socket.on('command_cancel', handleCommandCancel)  // CHANGE

    
    return () => {
      socket.off('command_output', handleCommandOutput);
      socket.off('command_error', handleCommandError);
      socket.off('command_stream', handleCommandStream)
      socket.off('command_complete', handleCommandComplete)
      socket.off('pty_input_ready', handlePtyInputReady)
      socket.off('pty_session_started', handlePtySessionStarted)
      socket.off('command_cancel', handleCommandCancel) // CHANGE
    };
  
  }, [socket, isAuthenticated, guestMode ]);

  // CAPTURE PWD INITIAL
  useEffect(() => {

    if (socket && (isAuthenticated || guestMode) && !initialPwdSent) {
      executeCommand('pwd');
      setInitialPwdSent(true);
  
    }
  }, [socket, isAuthenticated, guestMode, initialPwdSent]);
  
  // Auto scroll to bottom
  useEffect(() => {
  
    if (outputRef.current) {
  
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  
    }
  
  }, [output]);

  // Auto-refocus input when command execution finishes
  useEffect(() => {
    if (!isExecuting && terminalInputRef?.current && (isAuthenticated || guestMode)) {
      terminalInputRef.current.focus();
    }
  }, [isExecuting, terminalInputRef, isAuthenticated, guestMode]);

  


  
  const executeCommand = useCallback((command) => {
  
    if (!command.trim() || isExecuting || !socket || !(isAuthenticated || guestMode)) return;


      // Block new commands during PTY session, but allow PTY input
      if (isPtyActive && isWaitingForInput) {
        
        console.log('[DEBUG] Sending to PTY:', command.trim());
        socket.emit('command_input', { input: command.trim() });
        
        setCurrentCommand('');
        setHistoryIndex(-1);
        
        return;
      }
      
      if (isExecuting) return; // Only block if truly executing, not PTY

      // If PTY is active, send as input instead of new command
      if (isPtyActive && isWaitingForInput) {
        
        console.log('[DEBUG] Sending to PTY:', command.trim());
        socket.emit('command_input', { input: command.trim() });
        
        setCurrentCommand('');
        setHistoryIndex(-1);
        
        return;
      }

      // Add to history (resto del código normal)
      if (command && !commandHistory.includes(command)) {
        
        setCommandHistory(prev => [command, ...prev].slice(0, 50));
      }



    // Add to history
    if (command && !commandHistory.includes(command)) {
  
      setCommandHistory(prev => [command, ...prev].slice(0, 50));
  
    }


  
    // Handle special client commands
    const cmd = command.toLowerCase().trim();

    // Login command - only available in guest mode
    if (cmd === 'login') {
    
      if (guestMode && setShowAuthForm) {
        setShowAuthForm(true);
        setCurrentCommand('');
        setHistoryIndex(-1);
        return;
    
      } else if (isAuthenticated) {
    
        setOutput(prev => [...prev, {
          type: 'error',
          content: ['Already authenticated']
        }]);
    
        setCurrentCommand('');
        setHistoryIndex(-1);
        return;
    
      }
    }
    
    
    if (cmd === 'clear') {
      setOutput([]);
      setCurrentCommand('');
      setHistoryIndex(-1);
      return;
    }

    if (cmd === 'exit') {
      socket.disconnect();
      setCurrentCommand('');
      setHistoryIndex(-1);
      return;
    }

    // Execute on server
    setIsExecuting(true);


    // ENVIO EXPLIICITO, POSTERIORES EJECUCIONES y CLEANUPS
    socket.emit('execute_command', { command });
    setCurrentCommand('');
    setHistoryIndex(-1);
    
  
  }, [socket, isAuthenticated, guestMode, isExecuting, commandHistory, setShowAuthForm, isPtyActive, isWaitingForInput]);



  const navigateHistory = useCallback((direction) => {
    
    if (direction === 'up' && historyIndex < commandHistory.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setCurrentCommand(commandHistory[newIndex]);
    
    
    
    } else if (direction === 'down') {
    
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
    
      } else {
        setHistoryIndex(-1);
        setCurrentCommand('');
      }
    
    }
  }, [historyIndex, commandHistory]);

  
  const clearOutput = useCallback(() => {
  
    setOutput([]);
  
  }, []);

  
  return {
    output,
    currentCommand,
    setCurrentCommand,
    commandHistory,
    historyIndex,
    isExecuting, // CHANGE
    isWaitingForInput,
    isPtyActive,
    outputRef,
    executeCommand,
    navigateHistory,
    clearOutput
  };
};