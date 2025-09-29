// ============================================
// WebShellServer.js - Main WebShell Server Class
// ============================================
import cors from "cors";
import rateLimit from "express-rate-limit";
import { Server as SocketIO } from "socket.io";


import { SecurityManager } from './webshell/SecurityManager.js';
import { AuthManager } from './webshell/AuthManager.js';
import { SessionManager } from './webshell/SessionManager.js';
import { CommandExecutor } from './webshell/CommandExecution.js';

/**
 * Main WebShell Server Class
 * 
 * Manages the complete WebShell server functionality including Socket.IO,
 * authentication, security, sessions, and command execution.
 * 
 * @class WebShellServer
 */
export class WebShellServer {
    

    /**
     * Creates a new WebShell server instance
     * 
     * @param {Object} app - Express application instance
     * @param {Object} server - HTTP server instance
     * @param {Object} options - Configuration options
     */
    constructor(app, server, options = {}) {

        this.app = app;
        this.server = server;
        this.options = options;
        
        // Configuration object with default values
        this.config = this._buildConfiguration();
    
        // Manager instances
        this.security = null;
        this.auth = null;
        this.sessions = null;
        this.executor = null;
        this.io = null;
        
    
        console.log('[WEBSHELL] WebShell Server instance created');
    
    }




    /**
     * Builds the complete configuration object with defaults
     * 
     * @private
     * @returns {Object} Complete configuration object
     */
    _buildConfiguration() {
    
        return {
            cors: {
                origin: [
                    /^https?:\/\/localhost(:\d+)?$/,
                    /^https?:\/\/0\.0\.0\.0(:\d+)?$/,
                    /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
                    process.env.WEBSHELL_CORS_1 || '',
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
                lockoutTime: 300000,
                cleanupInterval: 600000,
                socketRateLimit: {
                    guest: {
                        maxRequests: 3,
                        windowMs: 1000,
                        blockDuration: 9999999999999999999999999999999999
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
            },
            server: {
                port: process.env.WEBSHELL_SERVER_PORT || 3001,
                host: process.env.WEBSHELL_SERVER_HOST || '0.0.0.0'
            }
        };
    }


    /**
     * Initialises all WebShell components and services
     * 
     * Sets up managers, middleware, Socket.IO, and HTTP routes
     */
    async initialise() {
        try {
            console.log('[WEBSHELL] Initialising WebShell server...');
            
            this._initialiseManagers();
            this._setupMiddlewares();
            this._initialiseSocketIO();
            this._setupSocketHandlers();
            this._setupHTTPRoutes();
            
            console.log('[WEBSHELL] WebShell server initialised successfully');
        
        
        } catch (error) {
        
            console.error('[WEBSHELL] Failed to initialise WebShell server:', error.message);
            throw error;
        }
    }



    /**
     * Initialises all manager instances
     * 
     * @private
     */
    _initialiseManagers() {
    
        console.log('[WEBSHELL] Initialising managers...');
        
        this.security = new SecurityManager(this.config.security);
        this.auth = new AuthManager(this.config.auth);
        this.sessions = new SessionManager(this.config.sessions);
        this.executor = new CommandExecutor(this.config.executor);
        
        console.log('[WEBSHELL] All managers initialised');
    
    }

    
    
    /**
     * Sets up Express middleware including CORS and rate limiting
     * 
     * @private
     */
    _setupMiddlewares() {
    
        console.log('[WEBSHELL] Setting up middlewares...');
        
        // CORS setup
        this.app.use(cors(this.config.cors));
        
        // Rate limiting for authentication endpoints
        const authLimiter = rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 5,
            message: 'Too Many Attempts. Bye!',
            standardHeaders: true,
            legacyHeaders: false,
        });
        
        this.app.use('/auth', authLimiter);
        
        console.log('[WEBSHELL] Middlewares configured');
    }

    /**
     * Initialises Socket.IO server with configuration
     * 
     * @private
     */
    _initialiseSocketIO() {
        
        console.log('[WEBSHELL] Initialising Socket.IO...');
        
        this.io = new SocketIO(this.server, {
            cors: this.config.cors,
            allowEIO3: true,
            transports: ['websocket', 'polling']
        });
        
        console.log('[WEBSHELL] Socket.IO initialised');
    }


    /**
     * Sets up all Socket.IO event handlers
     * 
     * @private
     */
    _setupSocketHandlers() {
    
        console.log('[WEBSHELL] Setting up Socket.IO handlers...');
        
        this.io.on('connection', (socket) => {
    
            const clientIP = this._getClientIP(socket);
            console.log(`[WEBSHELL] Client connected: ${socket.id} from ${clientIP}`);

    
            // Create session for the new connection
            const session = this.sessions.createSession(socket.id, clientIP);

            // Set up individual event handlers
            this._handleAuthentication(socket, session, clientIP);
            this._handleCommandExecution(socket, session, clientIP);
            this._handleCommandInput(socket, session, clientIP);
            this._handleCommandCancel(socket, session);
            this._handleDisconnection(socket, session);
        });
        
        console.log('[WEBSHELL] Socket.IO handlers configured');
    }



    /**
     * Extracts client IP address from socket connection
     * 
     * @private
     * @param {Object} socket - Socket.IO socket instance
     * @returns {string} Client IP address
     */
    
    _getClientIP(socket) {
        return socket.handshake.headers['x-forwarded-for']?.split(',')[0] ||
               socket.handshake.headers['x-real-ip'] ||
               socket.handshake.address ||
               socket.conn.remoteAddress;
    }

    /**
     * Handles authentication socket events
     * 
     * @private
     * @param {Object} socket - Socket.IO socket instance
     * @param {Object} session - Session instance
     * @param {string} clientIP - Client IP address
     */
    _handleAuthentication(socket, session, clientIP) {
    
        socket.on('authenticate', async (data) => {
    
            console.log('[WEBSHELL] Authentication attempt from:', clientIP);

            // Validate incoming data structure
            if (!data || typeof data.password !== 'string') {
    
                console.log(`[SECURITY] Invalid authenticate data from ${clientIP}`);
                socket.disconnect(true);
    
                return;
            }

    
            const { password } = data;


            // Check if IP is currently locked out
            if (this.security.isIPLocked(clientIP)) {
            
                const lockoutInfo = this.security.getLockoutInfo(clientIP);

                socket.emit('auth_failed', {
                    error: 'Too many failed attempts. Session is now blocked.',
                    lockout: true,
                    remainingTime: lockoutInfo.remainingTime
                });
                return;
            }


            // Validate the provided password
            const isValidPassword = await this.auth.validatePassword(password);

            if (isValidPassword) {
            
                // Authentication successful
                const token = this.auth.generateJWT(socket.id, clientIP);

                this.sessions.authenticateSession(socket.id, token);
                this.security.clearIPRecord(clientIP);

                socket.emit('auth_success', {
                    message: 'Authorised access OK',
                    user: 'webshell-user',
                    server: `WebShell v0.1 (IP: ${clientIP})`,
                    timestamp: new Date().toISOString(),
                    token: token
                });

            
                console.log(`[WEBSHELL] Authentication success: ${socket.id} (IP: ${clientIP})`);
            
            
            } else {
            
            
                // Authentication failed
            
                const record = this.security.recordFailedAttempt(clientIP);
                const remainingAttempts = this.security.getRemainingAttempts(clientIP);

                socket.emit('auth_failed', {
                    error: `Wrong credentials! - Remaining attempts: ${remainingAttempts}`,
                    lockout: false,
                    remainingAttempts: remainingAttempts
                });

            
                console.log(`[WEBSHELL] Authentication failed: ${socket.id} (IP: ${clientIP})`);
            }
        });
    }




    /**
     * Handles command execution socket events
     * 
     * @private
     * @param {Object} socket - Socket.IO socket instance
     * @param {Object} session - Session instance
     * @param {string} clientIP - Client IP address
     */
    _handleCommandExecution(socket, session, clientIP) {
    
    
        socket.on('execute_command', async (data) => {
            // Validate incoming data
            if (!data || typeof data.command !== 'string') {
                console.log(`[SECURITY] Invalid execute_command data from ${clientIP}`);
                socket.disconnect(true);
                return;
            }

            const { command } = data;

    
            // Validate session and check authentication
            const sessionValidation = this.sessions.validateSession(socket.id, this.auth);
            const hasAuthSession = sessionValidation.valid && sessionValidation.session?.authenticated;

            // Apply rate limiting
            const rateLimitCheck = this.security.checkSocketRateLimit(clientIP, hasAuthSession);

            if (!rateLimitCheck.allowed) {
    
                socket.emit('command_error', {
                    error: `Rate limit exceeded. Try again in ${rateLimitCheck.remaining} seconds.`
                });
    
                return;
            }

    
            // Determine working session
            let workingSession = session;

            if (!hasAuthSession) {
    
                // Guest mode - validate command safety
                if (!this.security.isCommandSafe(command, false, this.config.executor.guestCommands)) {
                    console.log(`[SECURITY] Unauthorised command attempt from ${clientIP}: ${command.substring(0, 50)}`);
                    socket.emit('command_error', { error: 'Authentication required for this command' });
                    return;
                }
    
            } else {
    
                workingSession = sessionValidation.session;
            }

    
            console.log(`[WEBSHELL] Executing command: "${command}" from ${socket.id} (Auth: ${hasAuthSession})`);

    
    
            // Handle special built-in commands
            if (await this._handleSpecialCommands(command, workingSession, socket, clientIP, hasAuthSession)) {
    
                return;
            }

            // Execute system command
            try {
    
                const result = await this.executor.executeCommand(command, workingSession, socket, hasAuthSession);

    
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
    }




    /**
     * Handles special built-in commands (help, session, etc.)
     * 
     * @private
     * @param {string} command - Command to check and handle
     * @param {Object} session - Session instance
     * @param {Object} socket - Socket.IO socket instance
     * @param {string} clientIP - Client IP address
     * @param {boolean} isAuthenticated - Whether user is authenticated
     * @returns {boolean} True if command was handled, false otherwise
     */
    async _handleSpecialCommands(command, session, socket, clientIP, isAuthenticated) {
    
        const cmd = command.toLowerCase().trim();

        if (cmd === 'help') {
    
            const helpText = this.executor.generateHelpText(isAuthenticated, clientIP);
            socket.emit('command_output', { output: helpText });
    
            return true;
        }

    
        if (cmd === 'session') {
    
            const sessionInfo = this.sessions.getSessionInfo(session.socketId);
            const ipAttempts = this.security.ipAttempts.get(clientIP)?.attempts || 0;
            const isLocked = this.security.isIPLocked(clientIP);

            const sessionText = this.executor.generateSessionInfo(sessionInfo, ipAttempts, isLocked);
    
            socket.emit('command_output', { output: sessionText });
    
            return true;
        }

        return false;
    }



    /**
     * Handles command input for interactive processes
     * 
     * @private
     * @param {Object} socket - Socket.IO socket instance
     * @param {Object} session - Session instance
     * @param {string} clientIP - Client IP address
     */
    _handleCommandInput(socket, session, clientIP) {
   
        socket.on('command_input', (data) => {
   
            if (!data || typeof data.input !== 'string') {
                console.log(`[SECURITY] Invalid command_input data from ${clientIP}`);
                socket.disconnect(true);
   
                return;
            }

            const { input } = data;
            const sessionData = this.sessions.getSession(socket.id);
            
            if (sessionData && sessionData.currentProcess) {
   
                const success = this.executor.sendInput(sessionData, input);
   
                if (!success) {
   
                    socket.emit('command_error', {
                        error: 'No active process to receive input'
                    });
                }
   
            } else {
   
                socket.emit('command_error', {
                    error: 'No active process to receive input'
                });
            }
        });
    }




    /**
     * Handles command cancellation requests
     * 
     * @private
     * @param {Object} socket - Socket.IO socket instance
     * @param {Object} session - Session instance
     */
    _handleCommandCancel(socket, session) {
    
        socket.on('cancel_command', () => {
    
            console.log(`[WEBSHELL] Cancel command request from ${socket.id}`);
            
            const sessionData = this.sessions.getSession(socket.id);
    
            if (sessionData) {
    
                const success = this.executor.cancelCommand(sessionData);
    
                if (success) {
                    socket.emit('command_cancel');
                }
            }
        });
    }

    /**
     * Handles client disconnection
     * 
     * @private
     * @param {Object} socket - Socket.IO socket instance
     * @param {Object} session - Session instance
     */
    _handleDisconnection(socket, session) {
    
        socket.on('disconnect', () => {
            console.log(`[WEBSHELL] Client disconnected: ${socket.id}`);
            this.sessions.deleteSession(socket.id);
        });
    }



    /**
     * Sets up HTTP routes for the WebShell server
     * 
     * @private
     */
    _setupHTTPRoutes() {
    
        console.log('[WEBSHELL] Setting up HTTP routes...');
        
        // Health check endpoint
    
        this.app.get('/status', (req, res) => {
    
            const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
            const sessionStats = this.sessions.getStats();

            res.json({
                server: 'healthy',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                sessions: sessionStats,
                environment: process.env.NODE_ENV || 'development',
                ipLockout: {
                    yourIP: clientIP,
                    attempts: this.security.ipAttempts.get(clientIP)?.attempts || 0,
                    isLocked: this.security.isIPLocked(clientIP),
                    remainingAttempts: this.security.getRemainingAttempts(clientIP)
                }
            });
        });

        // Authentication validation endpoint
        this.app.post('/auth/validate', async (req, res) => {
    
            const { password } = req.body;
            const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;

            if (this.security.isIPLocked(clientIP)) {
    
                return res.status(429).json({
                    valid: false,
                    message: 'IP Lockdown enabled',
                    lockout: true
                });
            }

    
            const isValidPassword = await this.auth.validatePassword(password);

    
            if (isValidPassword) {
    
                this.security.clearIPRecord(clientIP);
                res.json({ valid: true, message: 'AUTH OK' });
    
            } else {
    
                this.security.recordFailedAttempt(clientIP);
    
                res.status(401).json({
                    valid: false,
                    message: 'WRONG PASSWORD',
                    remainingAttempts: this.security.getRemainingAttempts(clientIP)
                });
            }
        });
        
        console.log('[WEBSHELL] HTTP routes configured');
    }

    
    
    /**
     * Starts the WebShell server on the configured port and host
     * 
     * @returns {Promise} Resolves when server is listening
     */
    async start() {
    
        return new Promise((resolve, reject) => {
    
            const { port, host } = this.config.server;
            
            this.server.listen(port, host, (error) => {
    
                if (error) {
                    console.error('[WEBSHELL] Failed to start server:', error.message);
                    reject(error);
                    return;
                }
                
                const stats = this.getStats();
                
                console.log(`
WebShell Server Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Port: ${port}
Host: ${host}
Setup: ${process.env.NODE_ENV || 'development'}

LOGIN CONFIG:
• Max attempts: 3
• Locktime: 5min
• Cleaning every: 10min

GUEST COMMANDS: ls, pwd, whoami, date, uptime, help, clear

CORS enabled
Active Sessions: ${stats.sessions.total || 0}
Blocked IPs: ${stats.blockedIPs}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                `);
                
                this._setupErrorHandlers();
                resolve();
            });
        });
    }



    /**
     * Sets up process error handlers for graceful shutdown
     * 
     * @private
     */
    _setupErrorHandlers() {
    
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
    
            console.error('[SERVER ERROR] Uncaught exception:', error.message);
            console.error(error.stack);
    
        });

    
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
    
            console.error('[SERVER ERROR] Unhandled rejection at:', promise, 'reason:', reason);
    
        });


        // Handle graceful shutdown
        process.on('SIGTERM', () => {
        
            console.log('[SERVER] Received SIGTERM, shutting down gracefully...');

            this.server.close(() => {
                console.log('[SERVER] Server closed successfully');
                process.exit(0);
            });
        });
    }




    /**
     * Retrieves current server statistics
     * 
     * @returns {Object} Server statistics including sessions and blocked IPs
     */
    getStats() {
    
        return {
    
            sessions: this.sessions.getStats(),
            blockedIPs: Array.from(this.security.ipAttempts.keys())
                .filter(ip => this.security.isIPLocked(ip)).length,
            uptime: process.uptime()
        };
    }


    /**
     * Gracefully shuts down the WebShell server
     * 
     * @returns {Promise} Resolves when shutdown is complete
     */
    async shutdown() {
       
        console.log('[WEBSHELL] Initiating graceful shutdown...');
        
        return new Promise((resolve) => {
       
            this.server.close(() => {
                console.log('[WEBSHELL] Server shutdown complete');
                resolve();
            });
        });
    }
}