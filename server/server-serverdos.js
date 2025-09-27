// ============================================
// server-serverdos.js - ServerDos Module
// ============================================
import path from 'path';

export function setupServerDos(app) {
    
    console.log('[SERVERDOS] Initializing ServerDos module...');

    // Handle serverdos routing - only respond if targetModule is 'serverdos'
    app.get('*', (req, res, next) => {
        
        if (req.targetModule !== 'serverdos') {
            return next(); // Not for us, pass to next handler
        }
        
        // Serve the serverdos app with specific HTML
        res.sendFile(path.join(process.cwd(), 'dist', 'index-serverdos.html'));
    });

    console.log('[SERVERDOS] ServerDos module initialized successfully');
}