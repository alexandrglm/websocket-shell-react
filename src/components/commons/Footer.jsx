import React from 'react'
import { Icons, faGithub } from './FontAwesome'

const Footer = () => {
  return (
    
    <footer className="footer">
        <div className="footer-content">
            <a
                href="https://github.com/alexandrglm"
                target="_blank"
                rel="noopener noreferrer"
                className="footer-github"
            >
                Built by <Icons icon={faGithub} /> @alexandrglm
            </a>
        </div>
    </footer>
  )
}

export default Footer