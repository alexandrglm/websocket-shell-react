// ============================================
// WEBSHELL BACKEND - REFACTORED
// ============================================
import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import path from 'path';

import { WebShellManager } from './server/webshell/WebshellManager.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ============================================
// BASIC MIDDLEWARES
// ============================================
//app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static('dist'));

// ============================================
// WEBSHELL INITIALIZATION
// ============================================
const webshellConfig = {
    cors: {
        origin: [
            /^https?:\/\/localhost(:\d+)?$/,
            /^https?:\/\/0\.0\.0\.0(:\d+)?$/,
            /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
            'https://websocket-shell-react.onrender.com',
            'https://devel.run',
            /\.onrender\.com$/
        ],
        methods: ['GET', 'POST'],
        credentials: true
    },
    auth: {
        jwtSecret: process.env.JWT_SECRET,
        shellPassword: process.env.SHELL_HASHWORD,
        jwtExpiresIn: '1h',
        jwtIssuer: 'webshell-server'
    },
    security: {
        maxAttempts: 3,
        lockoutTime: 9999999999999,
        cleanupInterval: 9999999999999,
        
        socketRateLimit: {
        
            guest: {
                maxRequests: 3,
                windowMs: 1000,
                blockDuration: 9999999999999
            },
            authenticated: {
                maxRequests: 20,
                windowMs: 1000,
                blockDuration: 0
            }
        }
    },
    sessions: {
        sessionTimeout: 3600000,
        cleanupInterval: 300000
    },
    executor: {
        maxCommandLength: 200,
        commandTimeout: 30000,
        guestCommands: [
            'ls', 'pwd', 'whoami', 'date', 'uptime', 
            'help', 'clear', 'echo', 'session'
        ]
    }
};

const webshell = new WebShellManager(app, server, webshellConfig);
webshell.initialize();




// ============================================
// SPA ROUTING CATCHALL
// ============================================
app.get(/^(?!\/(auth|status)).*/, (_req, res) => {

    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));

});


// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    
    const stats = webshell.getStats();
    
    console.log(`

 WebShell Server Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Port: ${PORT}
Host: ${HOST}
Setup: ${process.env.NODE_ENV || 'development'}

LOGIN CONFIG:
• Max attempts: ${webshellConfig.security.maxAttempts}
• Locktime: ${webshellConfig.security.lockoutTime / 60000}min
• Cleaning every: ${webshellConfig.security.cleanupInterval / 60000}min

GUEST COMMANDS: ${webshellConfig.executor.guestCommands.join(', ')}

CORS enabled
Active Sessions: ${stats.sessions.total}
Blocked IPs: ${stats.blockedIPs}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});

// ============================================
// ERROR HANDLING
// ============================================
process.on('uncaughtException', (error) => {
    
    console.error('[SERVER ERROR] Uncaught exception:', error.message);
    console.error(error.stack);

});


process.on('unhandledRejection', (reason, promise) => {
    
    console.error('[SERVER ERROR] Unhandled rejection at:', promise, 'reason:', reason);

});



// Graceful shutdown
process.on('SIGTERM', () => {
    
    console.log('[SERVER] Received SIGTERM, shutting down gracefully...');
    
    server.close(() => {
        console.log('[SERVER] Server closed successfully');
        process.exit(0);
    });
});


/*
process.on('SIGINT', () => {
    console.log('[SERVER] Received SIGINT, shutting down gracefully...');
    
    server.close(() => {
        console.log('[SERVER] Server closed successfully');
        process.exit(0);
    });
});
*/
export { app, server };