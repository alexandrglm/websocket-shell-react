// ============================================
// WEBSHELL -> MAIN, PAGE
// ============================================
import React from 'react';
import { motion } from 'framer-motion';
import Terminal from '../webshell/Webshell';

const WebShellPage = () => {

  return (
    
    <motion.div
      className="page webshell-page"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      
      <div className="container">
        
        <div className="page-header">
        
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            WebShell Terminal
          </motion.h1>
        
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Secure WebShell Access for limited free-tiers servers like Render
          </motion.p>
        </div>

        <motion.div
          className="terminal-wrapper"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <Terminal theme="default" />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default WebShellPage;