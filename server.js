// ============================================
//  MINIMAL SERVER
// ============================================
import express from "express";
import http from "http";
import dotenv from "dotenv";

import { setupWebshell } from './server/server-webshell.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// ============================================
// BASIC MIDDLEWARES
// ============================================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static('dist'));


// ============================================
// SETUP MODULES
// ============================================
setupWebshell(app, server, { shouldStart: true });



// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date(),
        modules: ['webshell', 'pages', 'portfolio'],
        uptime: process.uptime()
    });
});
