import { NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { UploadCloud, LayoutDashboard, Briefcase, TrendingUp, X, Menu, LogOut, Star } from 'lucide-react'

const Sidebar = ({ isOpen, onToggle, user, onLogout }) => {
  const navItems = [
    { path: '/', icon: UploadCloud, label: 'Upload' },
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/holdings', icon: Briefcase, label: 'Holdings' },
    { path: '/watchlist', icon: Star, label: 'Watchlist' },
  ]

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            onClick={onToggle}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={{ x: 0 }}
        transition={{ 
          duration: 0.4, 
          ease: [0.4, 0, 0.2, 1],
          type: "tween"
        }}
        style={{ willChange: 'transform' }}
        className={`fixed left-0 top-0 h-screen glass border-r border-dark-border flex flex-col z-50 overflow-hidden transition-all duration-300 ${isOpen ? 'w-72 p-6' : 'w-20 p-4'}`}
      >
        {/* Toggle button - shows X when open, Menu when closed */}
        <button
          onClick={onToggle}
          className={`absolute top-4 right-4 p-2 hover:bg-dark-hover rounded-lg transition-colors ${!isOpen ? 'right-1/2 translate-x-1/2' : ''}`}
          title={isOpen ? "Close Sidebar" : "Open Sidebar"}
        >
          {isOpen ? (
            <X className="w-5 h-5 text-gray-400" />
          ) : (
            <Menu className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {/* Logo */}
        <div className={`mb-10 ${!isOpen ? 'flex justify-center mt-12' : 'mt-2'}`}>
          <AnimatePresence mode="wait">
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1], delay: 0.1 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-gradient-to-br from-accent-indigo to-accent-purple rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">
                    Portfolio
                  </h2>
                  <p className="text-xs text-gray-400">Analytics Dashboard</p>
                </div>
              </motion.div>
            )}
            {!isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                className="w-10 h-10 bg-gradient-to-br from-accent-indigo to-accent-purple rounded-lg flex items-center justify-center"
                title="Portfolio Analytics Dashboard"
              >
                <TrendingUp className="w-6 h-6 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <nav className="flex-1">
          <ul className="space-y-2">
            {navItems.map((item, index) => (
              <motion.li
                key={item.path}
                initial={{ opacity: 0, x: -20 }}
                animate={{ 
                  opacity: 1,
                  x: 0
                }}
                transition={{ 
                  duration: 0.3, 
                  ease: [0.4, 0, 0.2, 1],
                  delay: isOpen ? 0.05 * index + 0.15 : 0
                }}
              >
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center rounded-lg transition-all duration-300 ${isOpen ? 'gap-3 px-4 py-3' : 'justify-center px-3 py-3'} ${
                      isActive
                        ? 'bg-gradient-to-r from-accent-indigo to-accent-purple text-white shadow-glow'
                        : 'text-gray-400 hover:bg-dark-hover hover:text-white'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {isOpen && <span className="font-medium">{item.label}</span>}
                </NavLink>
              </motion.li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isOpen ? 1 : 0 }}
          transition={{ 
            duration: 0.3, 
            ease: [0.4, 0, 0.2, 1],
            delay: isOpen ? 0.3 : 0
          }}
          className="mt-auto pt-6 border-t border-dark-border"
        >
          {user?.email && (
            isOpen && (
              <div className="mb-4 text-xs text-gray-500">
                <p>Signed in as</p>
                <p className="text-gray-300 font-medium mt-1 break-all">{user.email}</p>
              </div>
            )
          )}

          <button
            onClick={onLogout}
            className={`mb-4 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-dark-hover text-gray-200 hover:text-white transition ${isOpen ? 'w-full' : 'w-12 mx-auto'}`}
          >
            <LogOut className="w-4 h-4" />
            {isOpen && <span className="text-sm">Logout</span>}
          </button>

          {isOpen && (
            <div className="text-xs text-gray-500">
              <p>Last Updated</p>
              <p className="text-gray-400 font-medium mt-1">
                {new Date().toLocaleDateString()}
              </p>
            </div>
          )}
        </motion.div>
      </motion.aside>
    </>
  )
}

export default Sidebar
