// ============================================
// Maintenance.jsx - Maintenance Page from DEOTROPROYECTO
// ============================================
import React, { useState } from 'react';
import { useSelector } from 'react-redux';

import ShaderBackground from '../components/ShaderBg';




const Maintenance = () => {
    
    const { status } = useSelector(state => state.app);



    return (
        <div className='maintenance-navbar'>
           {/*<Navbar /> */}

            <div className="maintenance-page">
                <ShaderBackground />

                <div className="maintenance-content">
                    <div className="maintenance-header">
                        
                        <h1>!Server Under Maintenance</h1>
                        <p style={{ WebkitTextStroke: "1px black" }}>Manteinance P</p> 
                        

                        <div className="status-info">
                            {/* <ShellFake /> */}

                            {/* 
                            <button 
                                onClick={openModal} 
                                className="btn-modal"
                            >
                                PALABRA MAGICA
                            </button>

                            <ModalPalabra 
                                isOpen={modalAbierto} 
                                onClose={closeModal}
                            />

                            <button 
                                onClick={openOnegaiModal} 
                                className="btn-modal"
                            >
                                ONEGAI
                            </button>

                            <ModalOnegai
                                isOpen={modalOnegaiAbierto} 
                                onClose={closeOnegaiModal}
                            />
                            */}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Maintenance;