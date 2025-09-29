// ============================================
// server.js for WebShell standalone mode
// ============================================
import express from "express";
import http from "http";
import dotenv from "dotenv";

import { WebShellServer } from "./server/server-webshell.js";

// Load environment variables
dotenv.config();

/**
 * Main server application setup and initialisation
 * 
 * Creates Express app, HTTP server, and WebShell server instance,
 * then starts the complete WebShell service.
 */
async function startServer() {

    try {
    
        console.log('[SERVER] Starting WebShell application...');
        
        // Create Express application and HTTP server
        const app = express();
        const server = http.createServer(app);

        // Configure basic Express middlewares
        setupBasicMiddlewares(app);

        // Create and initialise WebShell server
        const webshell = new WebShellServer(app, server, { 
    
            shouldStart: true 
    
        });
        
        await webshell.initialise();
        await webshell.start();
    
        

        console.log('[SERVER] WebShell application started successfully');
        
    } catch (error) {
        
        console.error('[SERVER] Failed to start WebShell application:', error.message);
        process.exit(1);
    }
}


/**
 * Configures basic Express middlewares for JSON parsing and static files
 * 
 * @param {Object} app - Express application instance
 */
function setupBasicMiddlewares(app) {
    
    console.log('[SERVER] Configuring basic middlewares...');
    
    
    // JSON parsing with size limits
    app.use(express.json({ limit: '50mb' }));
    app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // Serve static files from dist directory
    app.use(express.static('dist'));
    
    console.log('[SERVER] Basic middlewares configured');

}

// Start the server
startServer();