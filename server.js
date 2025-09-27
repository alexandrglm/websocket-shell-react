// ============================================
// Server.js -> MAIN
// ============================================
import express from "express";
import http from "http";
import dotenv from "dotenv";

import { setupWebshell } from './server/server-webshell.js';

dotenv.config();

const app = express();
const server = http.createServer(app);



// BASIC MIDDLEWARES
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('dist'));

// ============================================
// MODULES-PROJECTS
// ============================================
setupWebshell(app, server, { shouldStart: true });

