import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Search, UploadCloud, Pencil, Save, X, TrendingUp, DollarSign, Star, Filter, Brain, Flame } from 'lucide-react'
import { useEffect, useState, useMemo } from 'react'
import { analyzePortfolio, formatCurrency, formatDecimal, getWatchlist, toggleWatchlist, isWatched } from '../services/portfolioInsights'
import { getPortfolioInsights } from '../services/api'

const Holdings = ({ portfolioData }) => {
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState('')
  const [editingSymbol, setEditingSymbol] = useState(null)
  const [editQuantities, setEditQuantities] = useState({})
  const [watchlistVersion, setWatchlistVersion] = useState(0)
  const [portfolioInsights, setPortfolioInsights] = useState(null)

  if (!portfolioData) {
    return (
      <div className="text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <UploadCloud className="w-24 h-24 mx-auto mb-6 text-gray-600" />
          <h2 className="text-2xl font-semibold mb-2">No Portfolio Data</h2>
          <p className="text-gray-400 mb-6">Upload your portfolio to view holdings</p>
          <button
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            Upload Portfolio
          </button>
        </motion.div>
      </div>
    )
  }

  const { holdings } = portfolioData
  const analysis = useMemo(() => analyzePortfolio(portfolioData), [portfolioData])
  const watchlist = useMemo(() => getWatchlist(), [watchlistVersion])

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

  const insights = portfolioInsights?.insights || []
  const summary = portfolioInsights?.summary || 'Loading portfolio insights from the backend...'
  const action = portfolioInsights?.action || 'Backend recommendations will appear once insight data is available.'

  // Calculate updated portfolio values when quantities change
  const updatedHoldings = useMemo(() => {
    return holdings.map(holding => {
      const buyPrice = Number(holding.buy_price || 0)
      if (editQuantities[holding.symbol] !== undefined) {
        const newQuantity = Math.max(0, editQuantities[holding.symbol])
        const newValue = newQuantity * Number(holding.current_price)
        const investedValue = newQuantity * buyPrice
        const pnlAmount = newValue - investedValue
        return {
          ...holding,
          quantity: newQuantity,
          current_value: newValue,
          invested_value: investedValue,
          pnl_amount: pnlAmount,
          pnl_percentage: investedValue > 0 ? (pnlAmount / investedValue) * 100 : 0,
        }
      }
      return holding
    })
  }, [holdings, editQuantities])

  // Recalculate percentages based on updated values
  const totalValue = useMemo(() => {
    return updatedHoldings.reduce((sum, h) => sum + h.current_value, 0)
  }, [updatedHoldings])

  const totalInvested = useMemo(() => {
    return updatedHoldings.reduce((sum, h) => sum + Number(h.invested_value || (h.quantity * (h.buy_price || 0))), 0)
  }, [updatedHoldings])

  const totalPnl = useMemo(() => totalValue - totalInvested, [totalValue, totalInvested])

  const holdingsWithPercentage = useMemo(() => {
    return updatedHoldings.map(holding => ({
      ...holding,
      percentage_of_portfolio: totalValue > 0 ? (holding.current_value / totalValue) * 100 : 0
    }))
  }, [updatedHoldings, totalValue])

  const filteredHoldings = useMemo(() => 
    holdingsWithPercentage.filter(holding =>
      holding.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      holding.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [holdingsWithPercentage, searchTerm]
  )

  const visibleWatchlist = useMemo(() => {
    const symbols = new Set(watchlist.map((item) => item.symbol))
    return holdingsWithPercentage.filter((holding) => symbols.has(holding.symbol))
  }, [holdingsWithPercentage, watchlist])

  const handleEditStart = (symbol, currentQuantity) => {
    setEditingSymbol(symbol)
    setEditQuantities({ ...editQuantities, [symbol]: currentQuantity })
  }

  const handleQuantityChange = (symbol, newQuantity) => {
    const quantity = Math.max(0, parseInt(newQuantity) || 0)
    setEditQuantities({ ...editQuantities, [symbol]: quantity })
  }

  const handleSave = (symbol) => {
    setEditingSymbol(null)
  }

  const handleCancel = (symbol) => {
    setEditingSymbol(null)
    const newQuantities = { ...editQuantities }
    delete newQuantities[symbol]
    setEditQuantities(newQuantities)
  }

  const handleRowClick = (symbol) => {
    if (editingSymbol !== symbol) {
      navigate(`/company/${symbol}`)
    }
  }

  const handleWatchlistToggle = (holding) => {
    toggleWatchlist(holding)
    setWatchlistVersion((value) => value + 1)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">
          Portfolio Holdings
        </h1>
        <p className="text-gray-400 mb-8">Complete list of your investments</p>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
      >
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-indigo/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-accent-indigo" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Holdings</p>
              <p className="text-2xl font-bold">{filteredHoldings.length}</p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-purple/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent-purple" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Total Value</p>
              <p className="text-2xl font-bold">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-gray-400 mt-1">
                Invested: ₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <p className={`text-xs mt-1 font-semibold ${totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                P/L: {totalPnl >= 0 ? '+' : ''}₹{totalPnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent-pink/20 rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-accent-pink" />
            </div>
            <div>
              <p className="text-gray-400 text-sm">Showing Results</p>
              <p className="text-2xl font-bold">{filteredHoldings.length} / {holdings.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Portfolio Coach */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6"
      >
        <div className="card lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-accent-indigo" />
            <h2 className="text-xl font-semibold">AI Portfolio Coach</h2>
          </div>
          <p className="text-lg text-white leading-relaxed mb-3">{summary}</p>
          <p className="text-gray-400">{action}</p>
          <div className="flex flex-wrap gap-3 mt-5">
            <span className="px-3 py-1.5 rounded-full bg-accent-indigo/20 text-accent-indigo text-sm font-medium">Diversification {analysis.diversificationScore}/100</span>
            <span className="px-3 py-1.5 rounded-full bg-accent-purple/20 text-accent-purple text-sm font-medium">Top holding {formatDecimal(analysis.topHoldingShare)}%</span>
            <span className="px-3 py-1.5 rounded-full bg-accent-pink/20 text-accent-pink text-sm font-medium">Watchlist {watchlist.length} names</span>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-5 h-5 text-yellow-400" />
            <h2 className="text-xl font-semibold">Top Signals</h2>
          </div>
            {insights.length > 0 ? (
              <div className="space-y-3">
                {insights.slice(0, 3).map((insight) => (
                  <div key={insight.title} className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                    <p className="font-medium text-white mb-1">{insight.title}</p>
                    <p className="text-sm text-gray-400 leading-relaxed">{insight.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading backend insights...</p>
            )}
        </div>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-6"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company name or symbol..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-12"
              aria-label="Search holdings"
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-dark-border bg-dark-card px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Filter className="w-4 h-4 text-accent-indigo" />
              <span>{filteredHoldings.length} visible / {holdings.length} total</span>
            </div>
            <button
              onClick={() => navigate('/watchlist')}
              className="px-3 py-2 rounded-lg bg-accent-indigo/20 text-accent-indigo text-sm font-medium hover:bg-accent-indigo/30 transition-colors"
            >
              Open Watchlist
            </button>
          </div>
        </div>
      </motion.div>

      {/* Holdings Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="card overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border bg-dark-bg/50">
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Company</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Symbol</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Sector</th>
                <th className="text-left py-4 px-4 text-gray-400 font-medium">Market Cap</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">Quantity</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">Buy Price</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">Price</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">Value</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">P/L</th>
                <th className="text-right py-4 px-4 text-gray-400 font-medium">% Portfolio</th>
                <th className="text-center py-4 px-4 text-gray-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredHoldings.map((holding, index) => (
                <motion.tr
                  key={holding.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                  className={`border-b border-dark-border/50 transition-colors ${
                    editingSymbol !== holding.symbol ? 'hover:bg-dark-hover cursor-pointer' : 'bg-dark-bg/50'
                  }`}
                  onClick={() => handleRowClick(holding.symbol)}
                >
                  <td className="py-4 px-4 font-medium text-white">{holding.company_name}</td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 bg-accent-indigo/20 text-accent-indigo rounded text-sm font-medium">
                      {holding.symbol}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-gray-400">{holding.sector || 'N/A'}</td>
                  <td className="py-4 px-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      holding.market_cap_category === 'Large Cap'
                        ? 'bg-green-500/20 text-green-400'
                        : holding.market_cap_category === 'Mid Cap'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {holding.market_cap_category || 'N/A'}
                    </span>
                  </td>
                  <td className="text-right py-4 px-4">
                    {editingSymbol === holding.symbol ? (
                      <input
                        type="number"
                        value={editQuantities[holding.symbol] || 0}
                        onChange={(e) => handleQuantityChange(holding.symbol, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSave(holding.symbol)
                          if (e.key === 'Escape') handleCancel(holding.symbol)
                        }}
                        className="w-24 px-2 py-1 bg-dark-bg border border-accent-indigo rounded text-white text-right focus:outline-none focus:ring-2 focus:ring-accent-indigo"
                        min="0"
                        autoFocus
                      />
                    ) : (
                      <span className="text-white font-medium">{holding.quantity}</span>
                    )}
                  </td>
                  <td className="text-right py-4 px-4 text-gray-300">₹{Number(holding.buy_price || 0).toFixed(2)}</td>
                  <td className="text-right py-4 px-4 text-gray-300">₹{Number(holding.current_price).toFixed(2)}</td>
                  <td className="text-right py-4 px-4 font-semibold text-white">
                    ₹{Number(holding.current_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`text-right py-4 px-4 font-medium ${Number(holding.pnl_amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Number(holding.pnl_amount || 0) >= 0 ? '+' : ''}
                    ₹{Number(holding.pnl_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-right py-4 px-4">
                    <span className="text-green-400 font-medium">
                      {Number(holding.percentage_of_portfolio).toFixed(2)}%
                    </span>
                  </td>
                  <td className="text-center py-4 px-4">
                    <div className="flex items-center justify-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {editingSymbol === holding.symbol ? (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleSave(holding.symbol)}
                          className="p-2 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                          title="Save (Enter)"
                          aria-label="Save changes"
                        >
                          <Save className="w-4 h-4" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleCancel(holding.symbol)}
                          className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                          title="Cancel (Esc)"
                          aria-label="Cancel editing"
                        >
                          <X className="w-4 h-4" />
                        </motion.button>
                      </>
                    ) : (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleWatchlistToggle(holding)}
                          className={`p-2 rounded transition-colors ${isWatched(holding.symbol) ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-dark-hover text-gray-400 hover:bg-dark-border'}`}
                          title={isWatched(holding.symbol) ? 'Remove from watchlist' : 'Add to watchlist'}
                          aria-label={`${isWatched(holding.symbol) ? 'Remove' : 'Add'} ${holding.company_name} from watchlist`}
                        >
                          <Star className={`w-4 h-4 ${isWatched(holding.symbol) ? 'fill-current' : ''}`} />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditStart(holding.symbol, holding.quantity)
                          }}
                          className="p-2 bg-accent-indigo/20 text-accent-indigo rounded hover:bg-accent-indigo/30 transition-colors"
                          title="Edit quantity"
                          aria-label={`Edit quantity for ${holding.company_name}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </motion.button>
                      </>
                    )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredHoldings.length === 0 && (
          <div className="text-center py-16">
            <Search className="w-16 h-16 mx-auto mb-4 text-gray-600" />
            <p className="text-xl font-semibold text-gray-400 mb-2">No holdings found</p>
            <p className="text-gray-500">
              {searchTerm ? `No results match "${searchTerm}"` : 'Your portfolio is empty'}
            </p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-4 px-4 py-2 bg-accent-indigo/20 text-accent-indigo rounded-lg hover:bg-accent-indigo/30 transition-colors"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </motion.div>

      {visibleWatchlist.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card mt-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-yellow-400 fill-current" />
            <h2 className="text-xl font-semibold">Watchlist Picks</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleWatchlist.map((holding) => (
              <button
                key={holding.symbol}
                onClick={() => navigate(`/company/${holding.symbol}`)}
                className="text-left rounded-xl border border-dark-border bg-dark-bg/60 p-4 hover:border-accent-indigo/40 hover:bg-dark-hover transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-white">{holding.company_name}</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-accent-indigo/20 text-accent-indigo">{holding.symbol}</span>
                </div>
                <p className="text-sm text-gray-400">{holding.sector || 'Sector not available'}</p>
                <p className="text-sm text-gray-500 mt-2">{holding.market_cap_category || 'Market-cap category unavailable'}</p>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}

export default Holdings
