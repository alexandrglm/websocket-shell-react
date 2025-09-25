// ============================================
// slice APP
// ============================================
import { createSlice } from '@reduxjs/toolkit'

const initialState = {
    maintenance: false,
    theme: 'dark'
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
        }
    }
})

export const { setMaintenance, setTheme } = appSlice.actions
export default appSlice.reducer