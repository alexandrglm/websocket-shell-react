import React from 'react'
import { useSelector, useDispatch } from 'react-redux'

import { Icons, faSun, faMoon } from '../commons/FontAwesome';

import { setTheme } from '../../store/slices/appSlice'

const Navbar = () => {

    const { theme } = useSelector(state => state.app)
    const dispatch = useDispatch()

    const toggleTheme = () => {
        dispatch(setTheme(theme === 'dark' ? 'light' : 'dark'))
    }

    const logoSrc = theme === 'light'
        ? `${window.location.origin}/logo-light.png`
        : `${window.location.origin}/logo-dark.png`

    return (

        <nav className="navbar">
            
            <div className="navbar-brand">
                <img src={logoSrc} className="navbar-logo" alt="Logo web" />
            </div>
            
            <div className="navbar-status">
                <span>!Server Under Development</span>
            </div>
            
            <div className="navbar-actions">
                
                <button onClick={toggleTheme} className="theme-toggle">
                    <Icons icon={theme === 'dark' ? faSun : faMoon} />
                </button>
            
            </div>
        
        </nav>
    )
}

export default Navbar
