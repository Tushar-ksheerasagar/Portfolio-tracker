import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { loginUser, registerUser, setAuthData, getUserPortfolio } from '../services/api'

const Login = ({ onAuthSuccess, setPortfolioData }) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const payload = isRegisterMode
        ? await registerUser(email, password)
        : await loginUser(email, password)

      setAuthData(payload.access_token, payload.user)
      onAuthSuccess(payload.user)

      try {
        const savedPortfolio = await getUserPortfolio()
        setPortfolioData(savedPortfolio)

        if (savedPortfolio?.holdings?.length > 0) {
          navigate('/dashboard')
        } else {
          navigate('/')
        }
      } catch {
        navigate('/')
      }
    } catch (err) {
      const message = err.response?.data?.detail || 'Authentication failed. Please try again.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md card"
      >
        <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">
          {isRegisterMode ? 'Create Account' : 'Login'}
        </h1>
        <p className="text-gray-400 mb-8">
          {isRegisterMode
            ? 'Register to save your portfolio securely in PostgreSQL'
            : 'Sign in to access your saved portfolio'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg bg-dark-bg border border-dark-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-indigo"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-lg bg-dark-bg border border-dark-border px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-accent-indigo"
              placeholder="Minimum 6 characters"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-semibold bg-gradient-to-r from-accent-indigo to-accent-purple text-white hover:opacity-90 disabled:opacity-50 transition"
          >
            {loading ? 'Please wait...' : isRegisterMode ? 'Create Account' : 'Login'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsRegisterMode((prev) => !prev)}
          className="mt-6 text-sm text-accent-indigo hover:text-accent-purple transition"
        >
          {isRegisterMode
            ? 'Already have an account? Login'
            : "Don't have an account? Register"}
        </button>
      </motion.div>
    </div>
  )
}

export default Login
