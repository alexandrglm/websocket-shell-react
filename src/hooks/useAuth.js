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

    const handleAuthFailed = (data) => {
      
      const newAttempts = attempts + 1;
      
      setAttempts(newAttempts);
      setIsAuthenticating(false);
      
      
      
      if (newAttempts >= AUTH_CONFIG.maxAttempts) {
        
        setIsLockedOut(true);
        setAuthError('Too many attempts. Bye!');
        
        setTimeout(() => {
          
          setIsLockedOut(false);
          setAttempts(0);
          setAuthError(null);
        }, AUTH_CONFIG.lockoutTime);
      
      
      } else {
        
        setAuthError(`Wrong credentials. Attempts: ${AUTH_CONFIG.maxAttempts - newAttempts}`);
      
      }
      
      socket.off('auth_success', handleAuthSuccess);
      socket.off('auth_failed', handleAuthFailed);
    };

    socket.on('auth_success', handleAuthSuccess);
    socket.on('auth_failed', handleAuthFailed);
    
    socket.emit('authenticate', { password });
  }, [socket]);
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