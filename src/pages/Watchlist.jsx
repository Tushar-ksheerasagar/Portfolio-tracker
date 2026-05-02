import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Star, Search, UploadCloud, TrendingUp, Trash2, Brain } from 'lucide-react'
import { analyzePortfolio, formatCurrency, formatDecimal, getWatchlist, removeFromWatchlist } from '../services/portfolioInsights'
import { getPortfolioInsights } from '../services/api'

const Watchlist = ({ portfolioData }) => {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [version, setVersion] = useState(0)
  const [portfolioInsights, setPortfolioInsights] = useState(null)
  const watchlist = useMemo(() => getWatchlist(), [version])
  const analysis = useMemo(() => analyzePortfolio(portfolioData || {}), [portfolioData])

  useEffect(() => {
    let active = true

    const fetchInsights = async () => {
      if (!portfolioData) {
        setPortfolioInsights(null)
        return
      }

      try {
        const result = await getPortfolioInsights()
        if (active) {
          setPortfolioInsights(result)
        }
      } catch (error) {
        console.error('Error fetching portfolio insights:', error)
        if (active) {
          setPortfolioInsights(null)
        }
      }
    }

    fetchInsights()

    return () => {
      active = false
    }
  }, [portfolioData?.last_updated])

  const summary = portfolioInsights?.summary || 'Loading backend watchlist insights...'
  const action = portfolioInsights?.action || 'Watchlist recommendations will appear once insight data is available.'
  const insights = portfolioInsights?.insights || []

  const visibleItems = watchlist.filter((item) => {
    const search = query.toLowerCase()
    return (
      item.symbol.toLowerCase().includes(search) ||
      (item.company_name || '').toLowerCase().includes(search) ||
      (item.sector || '').toLowerCase().includes(search)
    )
  })

  const handleRemove = (symbol) => {
    removeFromWatchlist(symbol)
    setVersion((value) => value + 1)
  }

  if (watchlist.length === 0) {
    return (
      <div className="text-center py-20">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Star className="w-24 h-24 mx-auto mb-6 text-gray-600" />
          <h2 className="text-2xl font-semibold mb-2">Your watchlist is empty</h2>
          <p className="text-gray-400 mb-6">Add companies from Holdings or Company Details to track them here.</p>
          <button onClick={() => navigate('/holdings')} className="btn-primary">
            Explore Holdings
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">
          Watchlist
        </h1>
        <p className="text-gray-400 mb-8">Track important names, ideas, and potential entries in one place.</p>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-indigo/20 rounded-lg flex items-center justify-center">
              <Star className="w-5 h-5 text-accent-indigo" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Saved Names</p>
              <p className="text-2xl font-bold">{watchlist.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Portfolio Signal</p>
              <p className="text-2xl font-bold">{summary.tone === 'positive' ? 'Bullish' : 'Caution'}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-pink/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-pink" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Diversification</p>
              <p className="text-2xl font-bold">{analysis.diversificationScore}/100</p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="card mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-5 h-5 text-accent-indigo" />
          <h2 className="text-xl font-semibold">Watchlist Insight</h2>
        </div>
        <p className="text-lg text-white leading-relaxed mb-2">{summary}</p>
        <p className="text-gray-400">{action}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
          {insights.length > 0 ? insights.slice(0, 3).map((insight) => (
            <div key={insight.title} className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
              <p className="font-medium text-white mb-1">{insight.title}</p>
              <p className="text-sm text-gray-400 leading-relaxed">{insight.text}</p>
            </div>
          )) : (
            <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-4 text-sm text-gray-400 md:col-span-3">
              Loading insight cards from the backend...
            </div>
          )}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="input-field pl-12"
            placeholder="Search watchlist by company, symbol, or sector..."
          />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-bg/50">
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Company</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Symbol</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Sector</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Bucket</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item, index) => (
                <motion.tr
                  key={item.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors cursor-pointer"
                  onClick={() => navigate(`/company/${item.symbol}`)}
                >
                  <td className="py-4 px-4 font-medium text-white">{item.company_name || item.symbol}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 bg-accent-indigo/20 text-accent-indigo rounded text-sm font-medium">{item.symbol}</span>
                  </td>
                  <td className="py-4 px-4 text-gray-400">{item.sector || 'N/A'}</td>
                  <td className="py-4 px-4 text-gray-400">{item.market_cap_category || 'N/A'}</td>
                  <td className="py-4 px-4 text-right">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        handleRemove(item.symbol)
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 text-red-300 hover:bg-red-500/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Remove
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {visibleItems.length === 0 && (
          <div className="text-center py-16">
            <UploadCloud className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-xl font-semibold text-gray-400 mb-2">No matches found</p>
            <p className="text-gray-500">Try a different search term or clear the filter.</p>
          </div>
        )}
      </motion.div>

      <div className="mt-6 text-sm text-gray-500">
        <p>Portfolio value reference: {formatCurrency(analysis.totalValue)} | P/L: {analysis.pnl >= 0 ? '+' : ''}{formatCurrency(analysis.pnl)} ({analysis.pnl >= 0 ? '+' : ''}{formatDecimal(analysis.pnlPercentage)}%)</p>
      </div>
    </div>
  )
}

export default Watchlist
