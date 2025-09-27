// ============================================
//  CLEAN MAIN SERVER - Modular Architecture
// ============================================
import express from "express";
import http from "http";
import dotenv from "dotenv";

import { setupDomainRouting } from './server/server-routing.js';

// Devel.run server
import { setupWebshell } from './server/server-webshell.js';

// JustLearn.ing Server
import { setupServerDos } from "./server/server-serverdos.js";

// import  { setupPages } from "./server/server-pages.js"


dotenv.config();

const app = express();
const server = http.createServer(app);

// ============================================
// BASIC MIDDLEWARES
// ============================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('dist'));

// ============================================
// DOMAIN ROUTING CONFIGURATION
// ============================================
const domainConfig = {
    // WebShell domains
    [process.env.DEV_DOMAIN || 'localhost']: 'webshell',
    [process.env.DEVELRUN_1 || 'devel.run']: 'webshell',
    [process.env.DEVELRUN_2 || 'websocket-shell-react.onrender.com']: 'webshell',
    [process.env.JUSTLEARNING_1 || 'justlearn.ing']: 'serverdos',
    [process.env.JUSTLEARNING_2 || 'testing-render-zgdg.onrender.com']: 'serverdos',
    

    // Default fallback
    'default': 'webshell'
};

setupDomainRouting(app, domainConfig);

// ============================================
// MODULE SETUP
// ============================================

// DEVEL.RUN -> websshell setup
const webshell = setupWebshell(app, server, { 
    shouldStart: true 
});

// JUST LEARNING
setupServerDos(app);



// setupPages(app);


// ============================================
// HEALTH CHECK ENDPOINT
// ============================================
app.get('/api/health', (req, res) => {
    const stats = webshell ? webshell.getStats() : {};
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        module: req.targetModule,
        domain: req.routingInfo?.domain,
        webshell: stats,
        modules: ['webshell'], // Add modules as they're created
        environment: process.env.NODE_ENV || 'development'
    });
});

// ============================================
// SERVER START
// ============================================
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

server.listen(PORT, HOST, () => {
    console.log(`[SERVER] Multi-Module Server started on ${HOST}:${PORT}`);
    console.log(`[SERVER] Environment: ${process.env.NODE_ENV || 'development'}`);
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