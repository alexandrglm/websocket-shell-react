// ============================================
// Hooke -> SocketIO para todo
// ============================================
import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';


const SOCKET_CONFIG = {

  url: process.env.REACT_APP_SHELL_URI,
  options: {
    autoConnect: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  }
};

export const useSocket = () => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);

  const connect = useCallback(() => {
    if (socket?.connected) return;

    const newSocket = io(SOCKET_CONFIG.url, SOCKET_CONFIG.options);
    
    newSocket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      console.log('Socket connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket disconnected');
    });

    newSocket.on('connect_error', (error) => {
      setConnectionError(error.message);
      setIsConnected(false);
      console.error('Connection error:', error);
    });

    newSocket.connect();
    setSocket(newSocket);
  }, [])
  // }, [socket]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [])
  // }, [socket]);
  const emit = useCallback((event, data) => {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  }, [socket]);


  
  // DEBUGGING SEGURIDAD SOCKETTTT RETIRAR!!!!
  useEffect(() => {
    if (socket) {
      window.socket = socket;
    }
  }, [socket]);


  useEffect(() => {
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [socket]);

  return { 
    socket, 
    isConnected, 
    connectionError, 
    connect, 
    disconnect, 
    emit 
  };
};
