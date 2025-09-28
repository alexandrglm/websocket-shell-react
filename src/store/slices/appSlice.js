// ============================================
// slice APP
// ============================================
import { createSlice } from '@reduxjs/toolkit'

/*
 * Terminal Themes -> Easy switches for terminal themes
 * FullScreen Mode -> A shared status to get fullscreen apps, with no other web components
 */

const initialState = {

    terminalTheme: 'default',
    isWebshellFullscreen: false
}

export const appSlice = createSlice({
    name: 'app',
    initialState,
    reducers: {

        setTerminalTheme: (state, action) => {
            state.terminalTheme = action.payload
        },
        setIsWebshellFullscreen: (state, action) => {
            state.isWebshellFullscreen = action.payload
        }
    }
})

export const { setTerminalTheme, setIsWebshellFullscreen } = appSlice.actions
export default appSlice.reducer