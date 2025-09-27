// ============================================
// App-Moduler.jsx - Frontend Module Loader & Router
// ============================================
import React, { useState, useEffect, Suspense } from 'react';
// ============================================
// MODULE REGISTRY
// ============================================
const moduleRegistry = {
    'webshell': React.lazy(() => import('./components/webshell/App-Webshell')),
    'serverdos': React.lazy(() => import('./srcdos/App-ServerDos')),
    // Future modules:
    // 'portfolio': React.lazy(() => import('./components/portfolio/App-Portfolio')),
    // 'blog': React.lazy(() => import('./components/blog/App-Blog')),
};

// ============================================
// MODULE DETECTION
// ============================================
const detectTargetModule = () => {
    const hostname = window.location.hostname;
    
    // Development override with URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const moduleOverride = urlParams.get('module');
    
    if (moduleOverride && moduleRegistry[moduleOverride]) {
        console.log('[APP-MODULER] Override detected:', moduleOverride);
        return moduleOverride;
    }
    
    // Domain-based detection (matches server-routing.js logic)
    const domainMapping = {
        'localhost': 'webshell',
        'devel.run': 'webshell',
        'www.devel.run': 'webshell',
        'justlearn.ing': 'webshell',
        'www.justlearn.ing': 'webshell',

        // ServerDos domains:
        'maintenance.localhost': 'serverdos',
        'test.localhost': 'serverdos',
        
        // Future domains:
        // 'portfolio.localhost': 'portfolio',
        // 'blog.localhost': 'blog',
    };
    
    const targetModule = domainMapping[hostname] || 'webshell'; // Default fallback
    
    console.log('[APP-MODULER] Domain detection:', {
        hostname,
        targetModule,
        available: Object.keys(domainMapping)
    });
    
    return targetModule;
};

// ============================================
// LOADING COMPONENT
// ============================================
const ModuleLoader = ({ moduleName }) => {
    return (
        <div className="module-loader">
            <div className="loader-content">
                <div className="loading-spinner"></div>
                <h2>Loading {moduleName}...</h2>
                <p>Initializing module components</p>
            </div>
        </div>
    );
};

// ============================================
// ERROR COMPONENT
// ============================================
const ModuleError = ({ moduleName, error }) => {
    const handleReload = () => {
        window.location.reload();
    };
    
    const handleRetry = () => {
        window.location.href = window.location.pathname;
    };
    
    return (
        <div className="module-error">
            <div className="error-content">
                <div className="error-icon">⚠️</div>
                <h2>Module Error</h2>
                <p className="error-module">Failed to load module: <strong>{moduleName}</strong></p>
                {error && (
                    <p className="error-details">{error}</p>
                )}
                
                <div className="error-actions">
                    <button onClick={handleRetry} className="retry-btn">
                        🔄 Retry
                    </button>
                    <button onClick={handleReload} className="reload-btn">
                        ↻ Reload Page
                    </button>
                </div>
                
                <div className="error-info">
                    <h3>Debug Info:</h3>
                    <ul>
                        <li>Hostname: {window.location.hostname}</li>
                        <li>Available modules: {Object.keys(moduleRegistry).join(', ')}</li>
                        <li>Timestamp: {new Date().toLocaleString()}</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN APP-MODULER COMPONENT
// ============================================
const AppModuler = () => {
    const [targetModule, setTargetModule] = useState(null);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const initializeModule = async () => {
            try {
                console.log('[APP-MODULER] Initializing...');
                
                const module = detectTargetModule();
                
                console.log('[APP-MODULER] Target module:', module);
                
                if (!moduleRegistry[module]) {
                    throw new Error(`Module "${module}" not found in registry`);
                }
                
                setTargetModule(module);
                setError(null);
                
            } catch (err) {
                console.error('[APP-MODULER] Initialization error:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        initializeModule();
    }, []);

    // Show loading state
    if (isLoading) {
        return <ModuleLoader moduleName="..." />;
    }

    // Show error state
    if (error || !targetModule) {
        return <ModuleError moduleName={targetModule || 'unknown'} error={error} />;
    }

    // Load and render the target module
    const ModuleComponent = moduleRegistry[targetModule];

    return (
        <Suspense fallback={<ModuleLoader moduleName={targetModule} />}>
            <ModuleComponent />
        </Suspense>
    );
};

export default AppModuler;