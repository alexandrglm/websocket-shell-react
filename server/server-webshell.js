// ============================================
// WebShell Project -> Custom Server Setup
// ============================================
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from 'path';

import { WebShellManager } from './webshell/WebshellManager.js';

export function setupWebshell(app, server, options = {}) {
    

    // ============================================
    // WEBSHELL CONFIGURATION
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
            lockoutTime: 300000, // 5 minutes
            cleanupInterval: 600000, // 10 minutes
            socketRateLimit: {
                guest: {
                    maxRequests: 3,
                    windowMs: 1000,
                    blockDuration: 3600000000
                },
                authenticated: {
                    maxRequests: 20,
                    windowMs: 1000,
                    blockDuration: 0
                }
            }
        },
        sessions: {
            sessionTimeout: 3600000, // 1 hour
            cleanupInterval: 300000 // 5 minutes
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



    // ============================================
    // CORS CALLBAKCS
    // ============================================
    app.use(cors(webshellConfig.cors));



    // ============================================
    // RATE LIMITING
    // ============================================
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        max: 5,
        message: 'Too Many Attempts. Bye!',
        standardHeaders: true,
        legacyHeaders: false,
    });

    app.use('/auth', authLimiter);



    // ============================================
    // WEBSHELL INITIALIZATION
    // ============================================
    const webshell = new WebShellManager(app, server, webshellConfig);
    webshell.initialize();

    // ============================================
    // SPA ROUTING CATCHALL
    // ============================================
    app.get(/^(?!\/(auth|status)).*/, (_req, res) => {
    
        res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
    
    });

    // ============================================
    // SERVER START (if requested)
    // ============================================
    if (options.shouldStart) {
    
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
• Max attempts: 3
• Locktime: 5min
• Cleaning every: 10min

GUEST COMMANDS: ls, pwd, whoami, date, uptime, help, clear

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
    }

    return webshell;
}