// ============================================
// slice APP
// ============================================
import { createSlice } from '@reduxjs/toolkit'

/*
 * Maintenance -> Maintenance mode via simple key:value
 * Theme -> By default, dark mode, but a newer implementation that captures system default will be used
 * Terminal Themes -> Easy switches for terminal themes
 * FullScreen Mode -> A shared status to get fullscreen apps, with no other web components
 */

const initialState = {
    maintenance: false,
    theme: 'dark',
    terminalTheme: 'default',
    isWebshellFullscreen: false
}

export const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {
        setMaintenance: (state, action) => {
            state.maintenance = action.payload
        },
        setTheme: (state, action) => {
            state.theme = action.payload
        },
        setTerminalTheme: (state, action) => {
            state.terminalTheme = action.payload
        },
        setIsWebshellFullscreen: (state, action) => {
            state.isWebshellFullscreen = action.payload
        }
    }
})

export const { setMaintenance, setTheme, setTerminalTheme, setIsWebshellFullscreen } = appSlice.actions
export default appSlice.reducer