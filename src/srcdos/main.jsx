// ============================================
// srcdos/main.jsx - ServerDos Entry Point
// ============================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from '../store/store.js'

import AppServerDos from './App-ServerDos.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
    <Provider store={store}>
        <AppServerDos />
    </Provider>
)
