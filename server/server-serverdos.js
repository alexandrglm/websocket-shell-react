// ============================================
// server-serverdos.js - ServerDos Module
// ============================================
import path from 'path';

export function setupServerDos(app) {
    
    console.log('[SERVERDOS] Initializing ServerDos module...');

    // Handle serverdos routing - only respond if targetModule is 'serverdos'
    app.use((req, res, next) => {  // Sin route pattern específico
        if (req.targetModule !== 'serverdos') {
            return next();
        }
        res.sendFile(path.join(process.cwd(), 'dist', 'public', 'index-serverdos.html'));
    });

    console.log('[SERVERDOS] ServerDos module initialized successfully');
}
