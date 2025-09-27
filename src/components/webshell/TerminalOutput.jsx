// ============================================
// WEBSHELL -> Terminal Receivers, body
// ============================================

import React from 'react';

const TerminalOutput = ({ output, isExecuting, isWaitingForInput,  isStuck, outputRef }) => {
  
  return (
  
    <div className="terminal-output" ref={outputRef}>
    
      {output.map((item, index) => (
    
        <div key={index} className={`output-line ${item.type}`}>
        

          {/* Atento al ternario */}        
          {Array.isArray(item.content) ? (
        
            item.content.map((line, lineIndex) => (
        
              <div key={lineIndex} className="line">{line}</div>
            
            ))
          
          ) : (
          
            <div className="line">{item.content}</div>
          
          )}
        
        </div>
      
      ))}

      
      {isExecuting && !isWaitingForInput && (
        <div className="output-line typing">
          <div className="line">
            <span className="typing-indicator">●●●</span>
          </div>
        </div>
      )}
    
    </div>
  
  );
};

export default TerminalOutput;