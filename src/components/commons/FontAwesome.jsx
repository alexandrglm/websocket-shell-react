import React, { Component } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";


import { 
    faUser,
    faUserSlash,
    faLock,
    faSun,
    faMoon,
    faPlugCircleXmark,
    faHeartCrack

} from '@fortawesome/free-solid-svg-icons'

import { 
    faGithub 
} from '@fortawesome/free-brands-svg-icons'

// puedo usar tamaño y colorinline, pero irá siempre a scss
export const Icons = ( { icon, size, color } ) => {

    return <FontAwesomeIcon icon={icon} size={size} color={color} />

}


export { faUser, faUserSlash, faLock, faSun, faMoon, faPlugCircleXmark, faHeartCrack, faGithub }