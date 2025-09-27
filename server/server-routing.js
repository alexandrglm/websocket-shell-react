// ============================================
// server/server-routing.js - Domain-based Routing
// ============================================

import path from 'path'

export function setupDomainRouting(app, domainMap) {
    
    console.log('[ROUTING] Setting up domain-based routing...');
    console.log('[ROUTING] Domain mappings:', domainMap);
    
    app.use((req, res, next) => {
        
        // Get domain without port
        const fullHost = req.get('host') || req.headers.host || 'localhost';
        const domain = fullHost.split(':')[0];
        
        // Set target module based on domain mapping
        req.targetModule = domainMap[domain] || domainMap['default'] || 'webshell';
        
        // Add debug info to request
        req.routingInfo = {
            fullHost,
            domain,
            targetModule: req.targetModule,
            availableDomains: Object.keys(domainMap)
        };
        
        console.log(`[ROUTING] ${fullHost} (${domain}) → ${req.targetModule}`);
        
        next();
    });



    // ============================================
    // SPA ROUTING CATCHALL VERDADERO
    // ============================================
    app.get('*', (req, res, next) => {
        // Skip assets y API routes
        if (req.url.startsWith('/assets/') || req.url.startsWith('/api/')) {
            return next();
        }

        const htmlFile = req.targetModule === 'serverdos'
        ? 'index-serverdos.html'
        : 'index-webshell.html';

        res.sendFile(path.join(process.cwd(), 'dist', 'public', htmlFile));
    });
    
    console.log('[ROUTING] Domain routing middleware installed');
}
