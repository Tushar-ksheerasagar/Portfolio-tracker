import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Upload from './pages/Upload'
import Holdings from './pages/Holdings'
import CompanyDetails from './pages/CompanyDetails'
import Login from './pages/Login'
import logo from './logoPesu.png'
import { refreshPortfolio, getStoredToken, getStoredUser, getUserPortfolio, clearAuthData } from './services/api'

function App() {
  const [portfolioData, setPortfolioData] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [user, setUser] = useState(getStoredUser())
  const token = getStoredToken()

  useEffect(() => {
    const loadSavedPortfolio = async () => {
      if (!token) {
        setPortfolioData(null)
        return
      }

      try {
        const data = await getUserPortfolio()
        setPortfolioData(data)
      } catch (error) {
        console.error('Error loading saved portfolio:', error)
      }
    }

    loadSavedPortfolio()
  }, [token])

  // Auto-refresh portfolio values every 1 minute
  useEffect(() => {
    if (!token || !portfolioData || !portfolioData.holdings || portfolioData.holdings.length === 0) {
      return
    }

    const refreshData = async () => {
      try {
        const updatedData = await refreshPortfolio(portfolioData.holdings)
        setPortfolioData(updatedData)
      } catch (error) {
        console.error('Error refreshing portfolio:', error)
      }
    }

    // Set up interval to refresh every 60 seconds
    const intervalId = setInterval(refreshData, 60000)

    // Cleanup interval on component unmount or when portfolioData changes
    return () => clearInterval(intervalId)
  }, [portfolioData?.holdings?.length, token]) // Re-run only when number of holdings changes

  const handleLogout = () => {
    clearAuthData()
    setUser(null)
    setPortfolioData(null)
  }

  const ProtectedLayout = () => {
    if (!token) {
      return <Navigate to="/login" replace />
    }

    return (
      <div className="gradient-bg min-h-screen">
        <Sidebar
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          user={user}
          onLogout={handleLogout}
        />
        <main
          className={`transition-all duration-[400ms] ease-[cubic-bezier(0.4,0,0.2,1)] ${sidebarOpen ? 'lg:ml-72' : 'ml-0'} p-6 min-h-screen bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg`}
          style={{ willChange: 'margin' }}
        >
          <div className="flex items-center justify-end mb-6">
            <img
              src={logo}
              alt="Logo"
              className="h-10 w-auto"
            />
          </div>
          <Outlet />
        </main>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <Login onAuthSuccess={setUser} setPortfolioData={setPortfolioData} />}
        />

        <Route element={<ProtectedLayout />}>
          <Route index element={<Upload setPortfolioData={setPortfolioData} />} />
          <Route path="dashboard" element={<Dashboard portfolioData={portfolioData} />} />
          <Route path="holdings" element={<Holdings portfolioData={portfolioData} />} />
          <Route path="company/:symbol" element={<CompanyDetails />} />
        </Route>

        <Route path="*" element={<Navigate to={token ? '/' : '/login'} replace />} />
      </Routes>
    </Router>
  )
}

export default App
