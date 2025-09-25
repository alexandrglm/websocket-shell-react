// ============================================
// WEBSHELL BACKEND
// ============================================
import express from "express";
import http from "http";
import { Server as socketIo } from "socket.io";
import cors from "cors";
import { spawn } from "child_process";
import rateLimit from "express-rate-limit";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';
import pty from 'node-pty';

dotenv.config();


const app = express();
const server = http.createServer(app);

// ============================================
// CONFIGURATION CORS FOR RENDER.COM
// ============================================

const corsOptions = {

  
    origin: [
        
        'http://localhost:3000',
        'http://localhost:7777',
        'https://devel.run',
        /\.onrender\.com$/,
        /localhost:\d+$/
    ],
    methods: ['GET', 'POST'],
    credentials: true
};



const io = new socketIo( server, {

    cors: corsOptions,
    allowEIO3: true,
    transports: ['websocket', 'polling']



});




// ============================================
// MIDDLEWARES
// ============================================

app.use(cors(corsOptions));
app.use(express.json());



// Rate limiting HTTP
const authLimiter = rateLimit({
    
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: 'Too Many Attempts. Bye!',
    standardHeaders: true,
    legacyHeaders: false,

});


// ============================================
// SECURITY CONFIGURATION
// ============================================

const CONFIG = {

    jwt: {
        
        secret: process.env.JWT_SECRET,
        expiresIn: '1h',
        issuer: 'webshell-server'
    
    },
    shell: {
        
        password: process.env.SHELL_HASHWORD,
        sessionTimeout: 3600000, // 1 hour
        maxCommandLength: 200,
        
        // Commands allowed for GUEST users (no auth required)
        guestCommands: [
            'ls', 'pwd', 'whoami', 'date', 'uptime', 
            'help', 'clear', 'echo'
        ]
    },
    forbidden: { // ESPECIFICOS aunque GUEST ya limite.
        commands: [
            'rm', 'rmdir', 'mv', 'cp', 'dd', 'mkfs', 'mount', 'umount',
            'chmod', 'chown', 'sudo', 'su', 'passwd', 'usermod',
            'kill', 'killall', 'pkill', 'reboot', 'shutdown', 'halt',
            'iptables', 'ufw', 'systemctl', 'service',
            'crontab', 'at', 'ssh', 'scp', 'rsync',
            ':(){ :|:& };:', // Fork bomb
            'bash', 'sh', 'zsh', '/bin/', '/usr/', '/etc/'
        ],
        patterns: [
            /\$\(.*\)/, // Command substitution
            /`.*`/, // Backticks
            /&&/, /\|\|/, /;/, // Command chaining
            /\.\.\//, // Directory traversal
            /\/dev\//, /\/proc\//, /\/sys\//, // System directories
            />/, /</, /\|/ // Redirection and pipes
        ]
    },
    ipLockout: {
        maxAttempts: 3,
        lockoutTime: 300000, // 5 minutes
        cleanupInterval: 600000 // 10 minutes
    }
};


  // BUILTINs
const SHELL_BUILTINS = [
    'cd'
]


// ============================================
// PASSWORD HASHWORD HANDLER + JWT
// ============================================
const validatePassHash = async (password) => {


    return await bcrypt.compare(password, CONFIG.shell.password);

}
// Se asigna por IP pero, probablemente, haya que añadir ip && useragent
function generateJWT(socketId, ip) {

    const payload = {
        
        socketId: socketId,
        ip: ip,
        authenticated: true,
        iat: Math.floor(Date.now() / 1000)
    
    };
    
    return jwt.sign(payload, CONFIG.jwt.secret, {
        
        expiresIn: CONFIG.jwt.expiresIn,
        issuer: CONFIG.jwt.issuer
    
    });
}

function verifyJWT(token) {
    
    try {

        console.log('[DEBUG JWT] Token assigned:', token);
    
        return jwt.verify(token, CONFIG.jwt.secret, {
            
            issuer: CONFIG.jwt.issuer
        
        });
    
    } catch (error) {

        console.log('[JWT] Token verification failed:', error.message);
        return null;
    }
}
// ============================================
// JWT MIDDLEWARE FOR HTTP ROUTES
// ============================================
const jwtMiddleware = (req, res, next) => {

    console.log('[DEBUG] JWT Middleware called for:', req.path); // LOG TEMPORAL

    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
    
        console.log('[DEBUG] NO TOKEN'); // LOG TEMPORAL
    
        return res.status(401).json({ error: 'No token provided' });
    
    }
    
    
    const payload = verifyJWT(token);
    
    if (!payload) {
    
        return res.status(401).json({ error: 'Invalid or expired token' });
    
    }
    
    req.user = payload;
    next();
};



// ============================================
// IP LOCKOUT MANAGEMENT
// ============================================

const ipAttempts = new Map(); // IP -> { attempts, lockTime, firstAttempt }

class IPLockoutManager {

    
    static getClientIP(socket) {
    
        return socket.handshake.headers['x-forwarded-for']?.split(',')[0] || 
    
            socket.handshake.headers['x-real-ip'] || 
            socket.handshake.address || 
            socket.conn.remoteAddress;
    }


    static isIPLocked(ip) {
        
        const record = ipAttempts.get(ip);
        if (!record) return false;

        const now = Date.now();
        
        // If lockout expired, clear record
        if (record.lockTime && now > record.lockTime) {
        
            ipAttempts.delete(ip);
            return false;
        }

        // Check if in lockout
        return record.attempts >= CONFIG.ipLockout.maxAttempts;
    }

    static recordFailedAttempt(ip) {
        
        const now = Date.now();
        
        const record = ipAttempts.get(ip) || { 
        
            attempts: 0, 
        
            lockTime: null, 
        
            firstAttempt: now 
        };

        record.attempts++;

        
        // If reaches max attempts, establish lockout
        if (record.attempts >= CONFIG.ipLockout.maxAttempts) {
        
            record.lockTime = now + CONFIG.ipLockout.lockoutTime;
        
            console.log(`[SERVER DEBUG] IP LOCKDOWN: ${ip} (${record.attempts} attempts)`);
        }

        ipAttempts.set(ip, record);
        return record;
    }

    static clearIPRecord(ip) {

        ipAttempts.delete(ip);
    
    }

    
    static getRemainingAttempts(ip) {
        
        const record = ipAttempts.get(ip);
        if (!record) return CONFIG.ipLockout.maxAttempts;
        
        return Math.max(0, CONFIG.ipLockout.maxAttempts - record.attempts);
    }

    static getLockoutInfo(ip) {
        
        const record = ipAttempts.get(ip);
        
        if (!record || !record.lockTime) return null;

        const remainingTime = Math.max(0, record.lockTime - Date.now());
        
        return {
        
            locked: remainingTime > 0,
        
            remainingTime: remainingTime,
        
            remainingMinutes: Math.ceil(remainingTime / 60000)
        };
    }
}


// ============================================
// SOCKET RATE LIMITING
// ============================================
const socketRateLimit = new Map(); // IP -> { count, resetTime }

const SOCKET_RATE_CONFIG = {

    guest: {

        maxRequests: 3,         // 1 comando por segundo
        windowMs: 1000,         // 1 segundo  
        blockDuration: 3600000000  // 1 hora de bloqueo
    },
    authenticated: {
   
        maxRequests: 20,
        windowMs: 1000,
        blockDuration: 0
    }
};

function checkSocketRateLimit(ip, isAuthenticated = false) {
    

    // Hay que profundizar; un auth puede enviar por error sin ser exploit o attack    
    if (isAuthenticated) {
        
        return { allowed: true, remaining: 999999 };
    }
    
    const config = SOCKET_RATE_CONFIG.guest;
    const now = Date.now();
    const record = socketRateLimit.get(ip) || { count: 0, resetTime: now + config.windowMs, blocked: false };
    
    // Si está bloqueado
    if (record.blocked && now < record.blockUntil) {
        return { 
            allowed: false, 
            remaining: Math.ceil((record.blockUntil - now) / 1000),
            isBlocked: true 
        };
    }
    
    // Reset ventana si expiró
    if (now > record.resetTime) {
        record.count = 0;
        record.resetTime = now + config.windowMs;
        record.blocked = false;
    }
    
    record.count++;
    
    // Si excede límite - ROBOT/EXPLOIT DETECTADO
    if (record.count > config.maxRequests) {
        
        record.blocked = true;
        record.blockUntil = now + config.blockDuration;
        
        socketRateLimit.set(ip, record);
        
        console.log(`[SECURITY ALERT] Socket rate limit exceeded - Possible bot/exploit from ${ip}. Banned.`);
        
        return { 
            allowed: false, 
            remaining: 0,
            isBlocked: true,
            shouldDisconnect: true 
        };
    }
    
    socketRateLimit.set(ip, record);
    
    return { allowed: true, remaining: config.maxRequests - record.count };
}

// Clear expired records every X minutes
setInterval(() => {

    const now = Date.now();
    let cleaned = 0;
    
    for (const [ip, record] of ipAttempts.entries()) {
        
        // Clear if lockout expired or too old
        const isExpired = record.lockTime && now > record.lockTime;
        const isTooOld = now - record.firstAttempt > CONFIG.ipLockout.cleanupInterval;
        
        
        
        if (isExpired || isTooOld) {
        
            ipAttempts.delete(ip);
        
            cleaned++;
        }
    }
    
    if (cleaned > 0) {
        console.log(`[SERVER DEBUG] Cleaning ${cleaned} expired IP locks`);
    }


}, CONFIG.ipLockout.cleanupInterval)






// ============================================
// AUTHENTICATED SESSION MANAGEMENT
// ============================================

const authenticatedSessions = new Map();

class ShellSession {

    constructor(socketId, ip) {
        
        this.socketId = socketId;
        this.ip = ip;
        this.authenticated = false;
        this.startTime = Date.now();
        this.lastActivity = Date.now();
        this.commandCount = 0;
        this.currentDirectory = process.cwd();
    
    }

    updateActivity() {
        
        this.lastActivity = Date.now();
    
    }

    isExpired() {
        

        // return true -> Para los pentest de validSession
        return (Date.now() - this.lastActivity) > CONFIG.shell.sessionTimeout;
    
    }

    
    incrementCommands() {
    
        this.commandCount++;
        this.updateActivity();
    
    }
}


// Clear expired sessions every 5 minutes
setInterval(() => {


    for (const [socketId, session] of authenticatedSessions.entries()) {
        
        if (session.isExpired()) {
        
            authenticatedSessions.delete(socketId);
        
            console.log(`[DEBUG SESSION] Expired Session: ${socketId}`);
        }
    }
}, 300000);



// ============================================
// COMMAND VALIDATION
// ============================================

function isCommandSafe(command, isAuthenticated = false) {
    
    const cmd = command.toLowerCase().trim();
    
    // Check length
    if (command.length > CONFIG.shell.maxCommandLength) {
        return false;
    }

    // Para usuarios NO autenticados, aplicar forbidden commands y patterns
    if (!isAuthenticated) {
        
        // Check forbidden commands
        for (const forbidden of CONFIG.forbidden.commands) {
            if (cmd.startsWith(forbidden)) {
                return false;
            }
        }

        // Check dangerous patterns (incluye redirecciones)
        for (const pattern of CONFIG.forbidden.patterns) {
            if (pattern.test(command)) {
                return false;
            }
        }

        // Solo permitir comandos guest
        const baseCommand = cmd.split(' ')[0];
        return CONFIG.shell.guestCommands.includes(baseCommand);
    }

    // If authenticated, allow everything except forbidden
    return true;
}


// String cleaning for commands, might need removal
function sanitizeCommand(command) {

    return command
        /*.replace(/[;&|`$(){}[\]]/g, '')
        .replace(/\s+/g, ' ')*/
        /*.trim() */
        .substring(0, CONFIG.shell.maxCommandLength);
}





// ============================================
// BUILT-IN COMMAND HANDLER
// ============================================
function handleBuiltInCommand(cmd, args, session) {

    return new Promise( (resolve) => {
        
        if (cmd === 'cd') {
            
            // Handle cd command
            const targetPath = args[0] || process.env.HOME || '/';
            
            // Resolve path (basic implementation for now)
            let newPath;
            
            if (targetPath.startsWith('/')) {
                // Absolute path
                newPath = targetPath;
            
            } else {
                // Relative path
                newPath = path.join(session.currentDirectory, targetPath)
            }
            
            
            // Check if directory exists
            if ( fs.existsSync(newPath) && fs.statSync(newPath).isDirectory() ) {
            
                session.currentDirectory = newPath;
            
                resolve({
                    success: true,
                    output: `Actual PWD: ${newPath}`
                });
            
            
            } else {
            
                resolve({
                    success: false,
                    error: `cd: ${targetPath}: No such file or directory`
                });
            }
        
        } else {
            // Other built-in commands not supported yet
            resolve({
                success: false,
                error: `${cmd}: Command not supported in WebShell. Please, open an request issue on GitHub`
            });
        }
    });
}

// ============================================
// PTY COMMAND EXECUTION (for interactive commands)
// ============================================
function executePtyCommand(command, session, socket) {
    return new Promise((resolve) => {
        
        console.log('[DEBUG PTY] Executing with PTY:', command);

        socket.emit('pty_session_started')
        
        const ptyProcess = pty.spawn('bash', ['-c', command], {
            name: 'xterm-color',
            cols: 80,
            rows: 30,
            cwd: session.currentDirectory,
            env: {
                ...process.env,
                TERM: 'xterm-256color',
                USER: 'webshell',
                HOME: '/tmp'
            }
        });
        
        console.log('[DEBUG PTY] Process PID:', ptyProcess.pid);
        
        // Store PTY reference
        session.currentProcess = ptyProcess;
        session.isPtyMode = true;
        
        // Stream PTY output
        ptyProcess.onData((data) => {

            console.log('[DEBUG PTY OUTPUT]:', data);
            
            socket.emit('command_stream', { 
                type: 'stdout', 
                data: data 
            });
            
            // If data looks like a prompt, enable input mode
            if (data.includes(':') || data.includes('$') || data.includes('#')) {

                socket.emit('pty_input_ready');
                console.log('[DEBUG PTY] Emitted pty_input_ready');
            }
        });
        
        // Handle PTY exit
        ptyProcess.onExit(({ exitCode, signal }) => {

            console.log('[DEBUG PTY EXIT] Code:', exitCode, 'Signal:', signal);
            
            clearTimeout(statusTimeout);
            
            session.currentProcess = null;
            session.isPtyMode = false;
            session.incrementCommands();
            
            socket.emit('command_complete', { 
                success: exitCode === 0,
                exitCode: exitCode 
            });
            
            resolve({
                success: true,
                output: ''
            });
        });
        
        // Add error handler
        ptyProcess.on('error', (error) => {
            console.log('[DEBUG PTY ERROR]:', error);
        });
        
        // Guardar referencia del timeout
        const statusTimeout = setTimeout(() => {
            console.log('[DEBUG PTY STATUS] Still alive after 5s, PID:', ptyProcess.pid);
        }, 5000);
    });
}

// ============================================
// SECURE COMMAND EXECUTION
// ============================================

async function executeCommand(command, session, socket) {

    return new Promise(async (resolve) => {
        
        const sanitized = sanitizeCommand(command);
        
        if (!isCommandSafe(sanitized, session.authenticated)) {
            
            resolve({
                success: false,
                error: `Command not allowed: ${command.split(' ')[0]}`
            });
        
            return;
        }

        // Detectar si el comando tiene redirecciones
        const hasRedirection = /[>|<&;]/.test(sanitized);

        let cmd, args;

        if (hasRedirection) {
            
            
            // Comando con redirecciones - usar bash
            console.log('[DEBUG] Using bash for redirection:', sanitized);
        
            cmd = 'bash';
            args = ['-c', sanitized];
        
        
        } else {
        
            // Comando normal - dividir argumentos
            args = sanitized.split(' ');
            cmd = args.shift();
        }

        // De BUILTINs
        if (SHELL_BUILTINS.includes(cmd) ) {

            const result = await handleBuiltInCommand(cmd, args, session)

            session.incrementCommands()

            resolve(result)

            return result

        }



        const childProcess = spawn(cmd, args, {


            
        
            cwd: session.currentDirectory,
        
            timeout: 30000,
        
            env: {
        
                ...process.env,
        
                PATH: process.env.PATH,
        
                USER: 'webshell',
        
                HOME: '/tmp',
        
                SHELL: '/bin/bash'
        
            },
        
            stdio: ['pipe', 'pipe', 'pipe']
        
        });

        let stdout = '';
        let stderr = '';

        childProcess.stdout.on('data', (data) => {
        
            stdout += data.toString();
            console.log('[DEBUG STDOUT]:', data.toString());

            // STREAM STDOUT PARA INTERACTIVOS
            socket.emit('command_stream', {

                type: 'stdout',
                data: data.toString()

            })
        
        });

        childProcess.stderr.on('data', (data) => {
        
            stderr += data.toString();
            console.log('[DEBUG STDERR]:', data.toString());

            // STREAM STDERRR PARA INTERACTIVOS
            socket.emit('command_stream', {

                type: 'stderr',
                data: data.toString()

            })

        });

        session.currentProcess = childProcess;

        session.currentProcess = childProcess;
        session.isPtyMode = false;

        // Set timeout to detect if command needs PTY
        const needsPtyTimeout = setTimeout(() => {

            if (session.currentProcess && !session.currentProcess.killed && stdout === '' && stderr === '') {
                
                
                console.log('[DEBUG] Command might need PTY, retrying...');
                
                //setIsPtyActive(true);

                // Kill spawn process without sending completion
                session.currentProcess.kill('SIGKILL');
                session.currentProcess = null;
                
                // Remove all listeners to prevent duplicate events
                clearTimeout(needsPtyTimeout);
                
                // PTY takes over completely - no resolve() here
                executePtyCommand(command, session, socket);
                return; // Exit without resolving
            }
        }, 3000);

        childProcess.on('close', (code) => {
            clearTimeout(needsPtyTimeout);
            
            // Don't send completion if we already switched to PTY
            if (session.currentProcess === childProcess) {
                session.currentProcess = null;
                
                socket.emit('command_complete', { 
                    success: code === 0,
                    exitCode: code 
                });
                
                resolve({
                    success: true,
                    output: ''
                });
            }
            // If currentProcess is different, PTY has taken over - do nothing
        });

        
        childProcess.on('error', (error) => {

            clearTimeout(needsPtyTimeout);
            clearTimeout(killTimeout);
            
            if (session.currentProcess === childProcess) {
                
                session.currentProcess = null;

                // Si es ENOENT (comando no encontrado) o otros errores, intentar con PTY
                if (error.code === 'ENOENT' || error.message.includes('spawn')) {
                    
                    console.log(`[DEBUG] Spawn failed for "${command}", falling back to PTY:`, error.message);
                    
                    executePtyCommand(command, session, socket);
                    return; // No resolver aquí, PTY se encarga
                }



                resolve({
                    success: false,
                    error: `SHELL ERROR while cmd -> ${error.message}`
                });
            }
        });


        // Timeout kill
        const killTimeout = setTimeout(() => {

            if (!childProcess.killed) {

                childProcess.kill('SIGKILL');

                resolve({

                    success: false,

                    error: 'SHELL SIGKILL due to timeout (30s)'

                });

            }

        }, 30000);
    });
}




// ============================================
// SOCKET.IO HANDLERS  (Middle SocketBLOCK + IP )
// ============================================

io.on('connection', (socket) => {

    const clientIP = IPLockoutManager.getClientIP(socket);
    console.log(`[DEBUG SOCKET] New Conn.-> ${socket.id} - IP: ${clientIP}`);


    // MIDDLEWARE SOCKET EVENTOS PERMITIDOS, o no
    const allowedEvents = [
        'authenticate',
        'execute_command',
        'command_input',
        'disconnect'
    ]
    // Interceptar TODOS los eventos
    const originalEmit = socket.emit;

    socket.onAny((eventName, ...args) => {
        
        if (!allowedEvents.includes(eventName)) {
        
            console.log(`[SECURITY] Blocked unauthorized event: ${eventName} from ${clientIP}`);
            socket.disconnect(true);
            return;
        }
    });

    // CREATE OWN SESSION
    const session = new ShellSession(socket.id, clientIP);

    socket.on('authenticate', async (data) => {


        // Validar estructura
        if (!data || typeof data !== 'object' || typeof data.password !== 'string') {
            
            console.log(`[DEBUB SECURITY SOCKET] Invalid authenticate data from ${clientIP}`);
            socket.disconnect(true);
            return;
        }
        
        const { password } = data;

        
        // 1. CHECK IP LOCKOUT FIRST
        if (IPLockoutManager.isIPLocked(clientIP)) {
        
            const lockoutInfo = IPLockoutManager.getLockoutInfo(clientIP);
        
        
            socket.emit('auth_failed', {
        
                error: `IP LOCKDOWN. Bye!`,
                lockout: true,
                remainingTime: lockoutInfo.remainingTime
        
            });
        
            console.log(`[DEBUG SOCKET] -> Lockdown IP attempt to login: ${clientIP}`);
            return;
        }

        
        // 2. CHECK PASSWORD ... usinh hashes
        const isValidPassword = ( await validatePassHash(password) )
        


        if (isValidPassword) {
        
            // LOGIN OK?

            const token = generateJWT(socket.id, clientIP)

            session.authenticated = true
            session.jwtToken = token;
            authenticatedSessions.set(socket.id, session);
        
            // Clear IP record on success
            IPLockoutManager.clearIPRecord(clientIP);
        
            socket.emit('auth_success', {
        
                message: 'Authorised access OK',
                user: 'webshell-user',
                server: `Render WebShell v0.1 (IP: ${clientIP})`,
                timestamp: new Date().toISOString(),
                token: token
        
            });

            console.log(`[SOCKET LOGIN] OK -> ${socket.id} (IP: ${clientIP})`);
    
        } else {
        
            // LOGIN FAIL?
        
            const record = IPLockoutManager.recordFailedAttempt(clientIP);
        
            const remainingAttempts = IPLockoutManager.getRemainingAttempts(clientIP);
            
            // loop attempts until zero
            if (remainingAttempts <= 0) {
        
                const lockoutInfo = IPLockoutManager.getLockoutInfo(clientIP);            

                socket.emit('auth_failed', {
        
                    error: `IP lockdown for ${lockoutInfo.remainingMinutes} minutes. Bye!`,
                    lockout: true,
                    attempts: record.attempts,
                    remainingTime: lockoutInfo.remainingTime
                });
        
            } else {
        
                socket.emit('auth_failed', {
        
                    error: `WRONG AUTH! - Remaining Attempts: ${remainingAttempts}`,
                    lockout: false,
                    attempts: record.attempts,
                    remainingAttempts: remainingAttempts
        
                });
        
            }
            console.log(`[SOCKET LOGIN] FAILED -> ${socket.id} (IP: ${clientIP} )`);
        
        }
    });

// 2 - Command execution logic

    socket.on('execute_command', async (data) => {

        // VALIDA -> 1
        if (!data || typeof data !== 'object' || typeof data.command !== 'string') {
            
            console.log(`[DEBUG SECURITY SOCKET] Invalid execute_command data from ${clientIP}`);
            socket.disconnect(true);
            
            return;
        }
        
        const { command } = data;

        // VALIDA -> 2 - Redundante para comandos
        if (!command || typeof command !== 'string' || command.length > 500) {

            console.log(`[DEBUG SECURITY REDUNDANT] Command validation failed from ${clientIP}: length=${command?.length}`);
            socket.emit('command_error', { error: 'Invalid command format' });
            
            return;
        }

        // VALIDA -> 3 - Redundante para cadenas inseguras
        if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(command)) {
            
            console.log(`[DEBUG SECURITY REDUNDANT] Dangerous control characters detected from ${clientIP}`);
            socket.emit('command_error', { error: 'Invalid characters in command' });
            
            return;
        }

        // VALIDA 4 -> Redundante, verifica limites por IP / Socket rate limiting
        const hasAuthSession = authenticatedSessions.has(socket.id);
        const rateLimitCheck = checkSocketRateLimit(clientIP, hasAuthSession);

        if (!rateLimitCheck.allowed) {
            
            if (rateLimitCheck.shouldDisconnect) {
            
                console.log(`[SECURITY] Disconnecting ${socket.id} from ${clientIP} due to rate limit violation`);
                socket.disconnect(true);
            
                return;
            }
            
            socket.emit('command_error', { 
            
                error: `Rate limit exceeded. Try again in ${rateLimitCheck.remaining} seconds.` 
            
            });
            
            return;
        }

        // VALIDA 5-> sessionValid
        let session;
    
        if (!authenticatedSessions.has(socket.id)) {
            
            // Usuario no autenticado (guest mode) - crear sesión temporal
            session = new ShellSession(socket.id, clientIP);
            
            if (!isCommandSafe(command, false)) {
                
                console.log(`[SECURITY] Unauthorized command attempt from ${clientIP}: ${command.substring(0, 50)}`);
                socket.emit('command_error', { error: 'Authentication required for this command' });
                //socket.disconnect(true);
                
                return;
            }
        } else {
           
            // Usuario autenticado - usar sesión existente
            session = authenticatedSessions.get(socket.id);

            // Token validation
            
            if ( session.jwtToken ) {

                const tokenPayload = verifyJWT(session.jwtToken);

                if( !tokenPayload ) {

                    console.log(`[JWT SECURITY] Invalid/expired JWT token from ${clientIP}`);

                    authenticatedSessions.delete(socket.id);
                    socket.emit('auth_failed', { error: 'Session expired or invalid' })
                    socket.disconnect(true)
                
                    return

                }

                // Verifica Token corresponde IP
                if ( tokenPayload.socketId !== socket.id || tokenPayload.ip !== clientIP ) {

                    console.log(`[JWT SECURITY] JWT token mismatch from ${clientIP}`);
                    
                    authenticatedSessions.delete(socket.id);
                    socket.disconnect(true);
                    
                    return;
                }



            }
        }

 
/*
        // VALIDA 5 -> Redundante para comandos SOLO auth
        if (!session.authenticated && !isCommandSafe(command, false)) {
            
            console.log(`[DEBUG SECURITY REDUNDNAT] Unauthorized command attempt from ${clientIP}: ${command.substring(0, 50)}`);
            socket.emit('command_error', { error: 'Authentication required for this command' });
            
            return;
        }
*/

        console.log(`[DEBUG SHELL USAGE]: "${command}" from ${socket.id} (IP: ${clientIP}) - Auth: ${session.authenticated}`);

        
        // Check if session expired (only for authenticated users)
        if (session.authenticated && session.isExpired()) {
        
            session.authenticated = false;
            authenticatedSessions.delete(socket.id);
        
            socket.emit('command_error', {
        
                error: 'Expired session!!!'
        
            });
            return;
        
        }

        
        // Special server commands
        if (command.toLowerCase() === 'help') {
        
            const authStatus = session.authenticated ? 'AUTHENTICATED - All commands available' : 'GUEST - Limited commands only';
            const availableCommands = session.authenticated ? 
                'All system commands (except forbidden for security)' : 
                CONFIG.shell.guestCommands.join(', ');
        
            socket.emit('command_output', {
        
                output: `WebShell Commands v1.0:
=========================
Status: ${authStatus}

Available Commands:
${availableCommands}

Special Commands:
  clear    - Clear screen
  exit     - Log out session  
  help     - This help message
  session  - Socket session info

${session.authenticated ? '' : 'To access all commands, please authenticate first.'}

[SECURITY] Dangerous commands blocked
[IP INFO] Your IP: ${clientIP}`
            });
            return;
        }

        if (command.toLowerCase() === 'session') {
        
            socket.emit('command_output', {
        
                output: `Session Information:
========================
Socket ID: ${session.socketId}
IP: ${session.ip}
Auth: ${session.authenticated}
Start Time: ${new Date(session.startTime).toLocaleString()}
Last Time Activity: ${new Date(session.lastActivity).toLocaleString()}
Commands Sent: ${session.commandCount}
PWD: ${session.currentDirectory}

IP/AUTH Statistics:
Failed Attempts: ${ipAttempts.get(clientIP)?.attempts || 0}
IP Lockdown: ${IPLockoutManager.isIPLocked(clientIP) ? 'YES' : 'NO'}`
            });
            return;
        }

        // Execute system command
        try {
            const result = await executeCommand(command, session, socket);
            
            if (result.success) {
                socket.emit('command_output', {
                    output: result.output,
                    timestamp: new Date().toISOString()
                });
            } else {
                socket.emit('command_error', {
                    error: result.error,
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


    // 3. Handle input for interactive input commands
    socket.on('command_input', (data) => {

        // Validar estructura
        if (!data || typeof data !== 'object' || typeof data.input !== 'string') {
            
            console.log(`[DEBUG SECURITY SOCKET] Invalid command_input data from ${clientIP}`);
            socket.disconnect(true);
            
            return;
        }

        const { input } = data;
        const session = authenticatedSessions.get(socket.id);
        
        if (session && session.currentProcess) {
        
            if (session.isPtyMode && session.currentProcess.write) {
        
        
                // PTY mode
                session.currentProcess.write(input + '\n');
                console.log(`[DEBUG PTY INPUT] -> "${input}" sent to PTY`);
        
            } else if (session.currentProcess.stdin) {
        
                // Spawn mode
                session.currentProcess.stdin.write(input + '\n');
                console.log(`[DEBUG INPUT] -> "${input}" sent to process`);
            }
        
        
        } else {
        
            socket.emit('command_error', {
        
                error: 'No active process to receive input'
        
            });
        }
    });



    socket.on('disconnect', () => {

        console.log(`Disconnection: ${socket.id} (IP: ${clientIP})`);

        authenticatedSessions.delete(socket.id);

    });
});




// ============================================
// EXPRESS ROUTES
// ============================================

// PRIMERO, ACEPTAR STATIC
app.use(express.static('dist'));

app.get('/', (req, res) => {

    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    
    res.json({

        status: 'WebShell Server Running',
        version: '0.0.1',
        timestamp: new Date().toISOString(),
        activeSessions: authenticatedSessions.size,
        blockedIPs: Array.from(ipAttempts.keys()).filter(ip => IPLockoutManager.isIPLocked(ip)).length,
        yourIP: clientIP
    });
});


app.get('/status', jwtMiddleware, (req, res) => {
    
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    
    const ipInfo = ipAttempts.get(clientIP) || { attempts: 0 };
    
    res.json({
            server: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            activeSessions: authenticatedSessions.size,
            environment: process.env.NODE_ENV || 'development',
            ipLockout: {
            yourIP: clientIP,
            attempts: ipInfo.attempts,
            isLocked: IPLockoutManager.isIPLocked(clientIP),
            remainingAttempts: IPLockoutManager.getRemainingAttempts(clientIP)
        }
    });
});


// Rate limit for auth endpoint HTTP
app.use('/auth', authLimiter);


app.post('/auth/validate', async (req, res) => {
 
    const { password } = req.body;

    const clientIP = req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    
    if (IPLockoutManager.isIPLocked(clientIP)) {
 
        return res.status(429).json({ 
 
            valid: false, 
 
            message: 'IP Lockdown enabled',
 
            lockout: true
        });
    }
    
    const isValidPassword = ( await validatePassHash(password) )

    if (isValidPassword) {
        
        IPLockoutManager.clearIPRecord(clientIP);
        
        res.json({ valid: true, message: 'AUTH OK' });
    
    } else {
    
        IPLockoutManager.recordFailedAttempt(clientIP);
        res.status(401).json({ 
        
            valid: false, 
        
            message: 'WRONG PASSWORD',
        
            remainingAttempts: IPLockoutManager.getRemainingAttempts(clientIP)
        });
    }


});

// Catchall para SPA routing
// Solo para rutas que no sean API
app.get(/^(?!\/(auth|status)).*/, (_req, res) => {
    res.sendFile(path.join(process.cwd(), 'dist', 'index.html'));
});


// ============================================
// SERVER START
// ============================================

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {

    console.log(`
 WebShell Server Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Port: ${PORT}
Host: ${HOST}
Setup: ${process.env.NODE_ENV || 'development'}

LOGIN CONFIG:
• Max attempts: ${CONFIG.ipLockout.maxAttempts}
• Locktime: ${CONFIG.ipLockout.lockoutTime / 60000}min
• Cleaning every: ${CONFIG.ipLockout.cleanupInterval / 60000}min

GUEST COMMANDS: ${CONFIG.shell.guestCommands.join(', ')}

CORS enabled
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
});

// Error handling
process.on('uncaughtException', (error) => {
  
    console.error('[DEBUG SERVER ERROR] -> Non-defined error:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  
    console.error('[DEBUG SERVER ERROR] Socket-Route-Promise error->:', reason, ' : ', promise);

});



// Graceful shutdown
process.on('SIGTERM', () => {
    
    console.log('[INFO] Shutting down ...');
    
    server.close(() => {
        
        console.log('[DEBUG SERVER] -> Server finished!');
        process.exit(0);
    
    });

});

export { app, server, io}