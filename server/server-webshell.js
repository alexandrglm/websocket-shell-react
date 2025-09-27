// ============================================
// WebShell Project -> Custom Server Setup
// ============================================
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from 'path';
import { Server as socketIo } from "socket.io";

import { SecurityManager } from './webshell/SecurityManager.js';
import { AuthManager } from './webshell/AuthManager.js';
import { SessionManager } from './webshell/SessionManager.js';
import { CommandExecutor } from './webshell/CommandExecution.js';

export function setupWebshell(app, server, options = {}) {

    console.log('[WEBSHELL] Initializing WebShell module...');

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
    // CORS SETUP
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
    // INITIALIZE MANAGERS
    // ============================================
    const security = new SecurityManager(webshellConfig.security);
    const auth = new AuthManager(webshellConfig.auth);
    const sessions = new SessionManager(webshellConfig.sessions);
    const executor = new CommandExecutor(webshellConfig.executor);

    // ============================================
    // SOCKET.IO SETUP
    // ============================================
    const io = new socketIo(server, {
        cors: webshellConfig.cors,
        allowEIO3: true,
        transports: ['websocket', 'polling']
    });

    console.log('[WEBSHELL] Socket.IO initialized');

    // ============================================
    // SOCKET EVENT HANDLERS
    // ============================================
    io.on('connection', (socket) => {
        const clientIP = socket.handshake.headers['x-forwarded-for']?.split(',')[0] ||
        socket.handshake.headers['x-real-ip'] ||
        socket.handshake.address ||
        socket.conn.remoteAddress;

        console.log(`[WEBSHELL] Client connected: ${socket.id} from ${clientIP}`);

        // Create session
        const session = sessions.createSession(socket.id, clientIP);

        // Authentication handler
        socket.on('authenticate', async (data) => {
            console.log('[WEBSHELL] Authentication attempt from:', clientIP);

            if (!data || typeof data.password !== 'string') {
                console.log(`[SECURITY] Invalid authenticate data from ${clientIP}`);
                socket.disconnect(true);
                return;
            }

            const { password } = data;

            // Check IP lockout
            if (security.isIPLocked(clientIP)) {
                const lockoutInfo = security.getLockoutInfo(clientIP);

                socket.emit('auth_failed', {
                    error: 'Too many failed attempts. Your session is now blocked.',
                    lockout: true,
                    remainingTime: lockoutInfo.remainingTime
                });
                return;
            }

            // Validate password
            const isValidPassword = await auth.validatePassword(password);

            if (isValidPassword) {
                // Success
                const token = auth.generateJWT(socket.id, clientIP);

                sessions.authenticateSession(socket.id, token);
                security.clearIPRecord(clientIP);

                socket.emit('auth_success', {
                    message: 'Authorised access OK',
                    user: 'webshell-user',
                    server: `WebShell v0.1 (IP: ${clientIP})`,
                            timestamp: new Date().toISOString(),
                            token: token
                });

                console.log(`[WEBSHELL] Authentication success: ${socket.id} (IP: ${clientIP})`);
            } else {
                // Failure
                const record = security.recordFailedAttempt(clientIP);
                const remainingAttempts = security.getRemainingAttempts(clientIP);

                socket.emit('auth_failed', {
                    error: `Wrong credentials! - Remaining attempts: ${remainingAttempts}`,
                    lockout: false,
                    remainingAttempts: remainingAttempts
                });

                console.log(`[WEBSHELL] Authentication failed: ${socket.id} (IP: ${clientIP})`);
            }
        });

        // Command execution handler
        socket.on('execute_command', async (data) => {
            if (!data || typeof data.command !== 'string') {
                console.log(`[SECURITY] Invalid execute_command data from ${clientIP}`);
                socket.disconnect(true);
                return;
            }

            const { command } = data;

            // Rate limiting
            const sessionValidation = sessions.validateSession(socket.id, auth);
            const hasAuthSession = sessionValidation.valid && sessionValidation.session?.authenticated;

            const rateLimitCheck = security.checkSocketRateLimit(clientIP, hasAuthSession);

            if (!rateLimitCheck.allowed) {
                socket.emit('command_error', {
                    error: `Rate limit exceeded. Try again in ${rateLimitCheck.remaining} seconds.`
                });
                return;
            }

            // Get working session
            let workingSession = session;

            if (!hasAuthSession) {
                // Guest mode - validate command safety
                if (!security.isCommandSafe(command, false, webshellConfig.executor.guestCommands)) {
                    console.log(`[SECURITY] Unauthorized command attempt from ${clientIP}: ${command.substring(0, 50)}`);
                    socket.emit('command_error', { error: 'Authentication required for this command' });
                    return;
                }
            } else {
                workingSession = sessionValidation.session;
            }

            console.log(`[WEBSHELL] Executing command: "${command}" from ${socket.id} (Auth: ${hasAuthSession})`);

            // Handle special commands
            const cmd = command.toLowerCase().trim();

            if (cmd === 'help') {
                const helpText = executor.generateHelpText(hasAuthSession, clientIP);
                socket.emit('command_output', { output: helpText });
                return;
            }

            if (cmd === 'session') {
                const sessionInfo = sessions.getSessionInfo(session.socketId);
                const ipAttempts = security.ipAttempts.get(clientIP)?.attempts || 0;
                const isLocked = security.isIPLocked(clientIP);

                const sessionText = executor.generateSessionInfo(sessionInfo, ipAttempts, isLocked);
                socket.emit('command_output', { output: sessionText });
                return;
            }

            // Execute system command
            try {
                const result = await executor.executeCommand(command, workingSession, socket, hasAuthSession);

                if (result.success) {
                    socket.emit('command_output', {
                        output: result.output,
                        currentDirectory: workingSession.currentDirectory,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    socket.emit('command_error', {
                        error: result.error,
                        currentDirectory: workingSession.currentDirectory,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                socket.emit('command_error', {
                    error: `Internal error: ${error.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Disconnect handler
        socket.on('disconnect', () => {
            console.log(`[WEBSHELL] Client disconnected: ${socket.id}`);
            sessions.deleteSession(socket.id);
        });
    });

    // ============================================
    // HTTP ROUTES
    // ============================================

    // Status endpoint
    app.get('/status', async (req, res) => {
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
        const sessionStats = sessions.getStats();

        res.json({
            server: 'healthy',
            uptime: process.uptime(),
                 memory: process.memoryUsage(),
                 sessions: sessionStats,
                 environment: process.env.NODE_ENV || 'development',
                 ipLockout: {
                     yourIP: clientIP,
                     attempts: security.ipAttempts.get(clientIP)?.attempts || 0,
                 isLocked: security.isIPLocked(clientIP),
                 remainingAttempts: security.getRemainingAttempts(clientIP)
                 }
        });
    });

    // Auth validation endpoint
    app.post('/auth/validate', async (req, res) => {
        const { password } = req.body;
        const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

        if (security.isIPLocked(clientIP)) {
            return res.status(429).json({
                valid: false,
                message: 'IP Lockdown enabled',
                lockout: true
            });
        }

        const isValidPassword = await auth.validatePassword(password);

        if (isValidPassword) {
            security.clearIPRecord(clientIP);
            res.json({ valid: true, message: 'AUTH OK' });
        } else {
            security.recordFailedAttempt(clientIP);
            res.status(401).json({
                valid: false,
                message: 'WRONG PASSWORD',
                remainingAttempts: security.getRemainingAttempts(clientIP)
            });
        }
    });



    // ============================================
    // STATS AND UTILITIES
    // ============================================
    function getStats() {
        return {
            sessions: sessions.getStats(),
            blockedIPs: Array.from(security.ipAttempts.keys())
            .filter(ip => security.isIPLocked(ip)).length,
            uptime: process.uptime()
        };
    }

    // ============================================
    // SERVER START (if requested)
    // ============================================
    if (options.shouldStart) {
        const PORT = process.env.PORT || 3001;
        const HOST = process.env.HOST || '0.0.0.0';

        server.listen(PORT, HOST, () => {
            const stats = getStats();

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
            Active Sessions: ${stats.sessions.total || 0}
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

    console.log('[WEBSHELL] WebShell module initialized successfully');

    return {
        io,
        getStats,
        security,
        auth,
        sessions,
        executor
    };
}
