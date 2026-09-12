import { useState, useEffect } from 'react'
import Hero from './components/Hero'
import Architecture from './components/Architecture'
import Installation from './components/Installation'
import Configuration from './components/Configuration'
import Docker from './components/Docker'
import Features from './components/Features'
import FAQ from './components/FAQ'
import Footer from './components/Footer'
import Navbar from './components/Navbar'

function App() {
  const [darkMode, setDarkMode] = useState(true)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-gray-100' : 'bg-white text-gray-900'} transition-colors duration-300`}>
      <Navbar darkMode={darkMode} setDarkMode={setDarkMode} />
      <Hero />
      <Features />
      <Architecture />
      <Installation />
      <Configuration />
      <Docker />
      <FAQ />
      <Footer />
    </div>
  )
}

export default App
