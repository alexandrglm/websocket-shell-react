// ============================================
// HOOKS -> Componente Auth para todo
// ============================================
import { useState, useCallback } from 'react';


const AUTH_CONFIG = {
  
  maxAttempts: 3,
  lockoutTime: 9999999999999999999999999999

};

export const useAuth = (socket, onAuthSuccess = null ) => {
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  const [authError, setAuthError] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [isLockedOut, setIsLockedOut] = useState(false);

  const authenticate = useCallback(async (password) => {
    if (!socket || !password.trim()) return;
    
    setIsAuthenticating(true);
    setAuthError(null);

    
    const handleAuthSuccess = (data) => {

      // console.log('[DEBUG JWT] TOKEN -> :', data.token); // SOLO DEBUG!!! RETIRAR PROD
      
      setIsAuthenticated(true);
      setIsAuthenticating(false);
      setAttempts(0);
      setAuthError(null);

      if (onAuthSuccess) onAuthSuccess();
      //if ( onBack ) onBack();
      
      socket.off('auth_success', handleAuthSuccess);
      socket.off('auth_failed', handleAuthFailed);
    };


    //
    const handleAuthFailed = (data) => {

      // Si el servidor indica lockout, mostrar solo ese mensaje
      if (data.lockout) {
        setIsLockedOut(true);
        setAuthError(data.error);
        setAuthError(null); // Limpiar error anterior primero
        setAuthError(data.error); // Mostrar solo el lockout
      
      } else {
      
        setAuthError(data.error);
        setAttempts(prev => prev + 1);
      
      }
      
      setIsAuthenticating(false);
      
      socket.off('auth_success', handleAuthSuccess);
      socket.off('auth_failed', handleAuthFailed);
    };

    socket.on('auth_success', handleAuthSuccess);
    socket.on('auth_failed', handleAuthFailed);
    
    socket.emit('authenticate', { password });
  }, [socket, attempts]);
  // }, [socket, attempts]);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setAuthError(null);
    setAttempts(0);
  }, []);

  return {
    isAuthenticated,
    isAuthenticating,
    authError,
    attempts,
    isLockedOut,
    authenticate,
    logout,
    remainingAttempts: AUTH_CONFIG.maxAttempts - attempts
  };
};