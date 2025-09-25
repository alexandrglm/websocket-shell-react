// ============================================
// Store SLice REdux - Importado del esqueleto js
// ============================================
import { configureStore } from '@reduxjs/toolkit'

import appSlice from './slices/appSlice'
// import userSlice from './slices/userSlice'

export const store = configureStore({

    reducer: {
        app: appSlice,
        // user: userSlice,
    },
    middleware: 
    (getDefaultMiddleware) =>
    
    getDefaultMiddleware({

        serializableCheck: {

            ignoredActions: ['persist/PERSIST'],

        },

    }),

})


