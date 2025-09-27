// ============================================
// server/server-routing.js - Domain-based Routing
// ============================================

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
    
    console.log('[ROUTING] Domain routing middleware installed');
}