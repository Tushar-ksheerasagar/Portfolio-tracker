import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart,
  Bar,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

// Debounce utility
const debounce = (func, wait) => {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

// Memoize timeframes array outside component
const TIMEFRAMES = [
  { label: '1D', value: '1d' },
  { label: '5D', value: '5d' },
  { label: '1M', value: '1mo' },
  { label: '6M', value: '6mo' },
  { label: 'YTD', value: 'ytd' },
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: 'All', value: 'max' },
]

// Helper function outside component to avoid recreation
const formatTime = (dateStr, period) => {
  const date = new Date(dateStr)
  if (period === '1d') {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  } else if (period === '5d') {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }
}

// Check if the market is currently open (Indian market hours: 9:15 AM - 3:30 PM IST, Mon-Fri)
const isMarketOpen = () => {
  const now = new Date()
  
  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000)
  const istTime = new Date(utcTime + istOffset)
  
  const day = istTime.getDay() // 0 = Sunday, 6 = Saturday
  const hours = istTime.getHours()
  const minutes = istTime.getMinutes()
  
  // Check if it's a weekday (Monday-Friday)
  if (day === 0 || day === 6) {
    return false
  }
  
  // Check if time is between 9:15 AM and 3:30 PM IST
  const currentMinutes = hours * 60 + minutes
  const marketOpenMinutes = 9 * 60 + 15 // 9:15 AM
  const marketCloseMinutes = 15 * 60 + 30 // 3:30 PM
  
  return currentMinutes >= marketOpenMinutes && currentMinutes <= marketCloseMinutes
}

const StockChart = ({ symbol }) => {
  const [chartData, setChartData] = useState([])
  const [liveQuote, setLiveQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState('1d')
  const [error, setError] = useState(null)
  const [hoveredData, setHoveredData] = useState(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [marketOpen, setMarketOpen] = useState(isMarketOpen())
  const fetchAbortController = useRef(null)

  const fetchLiveQuote = useCallback(async () => {
    try {
      const response = await fetch(`http://localhost:5000/live-quote/${symbol}`)
      if (response.ok) {
        const data = await response.json()
        setLiveQuote(data)
        setError(null)
      }
    } catch (err) {
      console.error('Error fetching live quote:', err)
    }
  }, [symbol])

  const fetchChartData = useCallback(async () => {
    // Abort previous request if still pending
    if (fetchAbortController.current) {
      fetchAbortController.current.abort()
    }

    fetchAbortController.current = new AbortController()
    setLoading(true)

    try {
      const response = await fetch(
        `http://localhost:5000/stock-chart/${symbol}?period=${timeframe}`,
        { signal: fetchAbortController.current.signal }
      )
      
      if (response.ok) {
        const result = await response.json()
        if (result.success && result.data.length > 0) {
          // Format data for recharts
          const formattedData = result.data.map(item => ({
            ...item,
            time: formatTime(item.date, timeframe),
            fullDate: item.date,
          }))
          setChartData(formattedData)
          setIsInitialLoad(false)
          setError(null)
        } else {
          setError('No chart data available')
          setChartData([])
        }
      } else {
        setError('Failed to fetch chart data')
        setChartData([])
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching chart data:', err)
        setError('Unable to load chart data')
        setChartData([])
      }
    } finally {
      setLoading(false)
    }
  }, [symbol, timeframe])

  // Check market status every minute
  useEffect(() => {
    const checkMarket = () => {
      setMarketOpen(isMarketOpen())
    }
    
    checkMarket()
    const marketCheckInterval = setInterval(checkMarket, 60000) // Check every minute
    
    return () => clearInterval(marketCheckInterval)
  }, [])

  // Initial data fetch (always runs)
  useEffect(() => {
    fetchLiveQuote()
    fetchChartData()
  }, [fetchLiveQuote, fetchChartData])

  // Auto-refresh only when market is open
  useEffect(() => {
    if (marketOpen) {
      const interval = setInterval(() => {
        fetchLiveQuote()
        fetchChartData()
      }, 60000) // Refresh every 60 seconds
      return () => clearInterval(interval)
    }
  }, [marketOpen, fetchLiveQuote, fetchChartData])

  // Memoize price calculations
  const priceMetrics = useMemo(() => {
    const currentPrice = liveQuote?.ltp || 0
    const previousClose = liveQuote?.previousClose || liveQuote?.close || currentPrice
    const changeAmount = currentPrice - previousClose
    const changePercent = previousClose ? ((changeAmount / previousClose) * 100).toFixed(2) : 0
    const isPositive = changeAmount >= 0

    return { currentPrice, previousClose, changeAmount, changePercent, isPositive }
  }, [liveQuote])

  // Calculate metrics for hovered data point
  const hoveredMetrics = useMemo(() => {
    if (!hoveredData) return null
    
    const hoveredPrice = hoveredData.close
    const previousClose = priceMetrics.previousClose
    const changeAmount = hoveredPrice - previousClose
    const changePercent = previousClose ? ((changeAmount / previousClose) * 100).toFixed(2) : 0
    const isPositive = changeAmount >= 0

    return { hoveredPrice, changeAmount, changePercent, isPositive }
  }, [hoveredData, priceMetrics.previousClose])

  // Memoize price range calculations
  const priceRange = useMemo(() => {
    if (chartData.length === 0) {
      return { minPrice: 0, maxPrice: 0, priceBuffer: 0 }
    }
    const minPrice = Math.min(...chartData.map(d => d.low))
    const maxPrice = Math.max(...chartData.map(d => d.high))
    const priceBuffer = (maxPrice - minPrice) * 0.1
    return { minPrice, maxPrice, priceBuffer }
  }, [chartData])

  // Memoized Custom tooltip - no longer sets state
  const CustomTooltip = useMemo(() => {
    return ({ active, payload }) => {
      if (active && payload && payload.length > 0) {
        const data = payload[0].payload
        
        return (
          <div className="bg-dark-card/95 backdrop-blur-sm border border-dark-border rounded-lg p-3 shadow-xl">
            <p className="text-xs text-gray-400 mb-1">{data.fullDate}</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-500">Open: </span>
                <span className="text-white font-medium">₹{data.open?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">High: </span>
                <span className="text-green-400 font-medium">₹{data.high?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Low: </span>
                <span className="text-red-400 font-medium">₹{data.low?.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Close: </span>
                <span className="text-white font-medium">₹{data.close?.toFixed(2)}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-dark-border">
              <span className="text-gray-500 text-xs">Volume: </span>
              <span className="text-accent-indigo font-medium text-xs">
                {(data.volume / 1000000).toFixed(2)}M
              </span>
            </div>
          </div>
        )
      }
      return null
    }
  }, [])

  // Debounced mouse handlers for better performance
  const handleMouseMove = useMemo(
    () =>
      debounce((e) => {
        if (e && e.activePayload && e.activePayload[0]) {
          setHoveredData(e.activePayload[0].payload)
        }
      }, 16), // ~60fps
    []
  )

  const handleMouseLeave = useCallback(() => {
    setHoveredData(null)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="bg-gradient-to-br from-dark-card/50 to-dark-bg/50 backdrop-blur-xl border border-dark-border rounded-2xl p-6 space-y-6"
      style={{ willChange: 'opacity, transform' }}
    >
      {/* Header with Live Price */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h3 className="text-gray-400 text-sm">{hoveredData ? 'Hovered Price' : 'Current Price'}</h3>
            {!marketOpen && (
              <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-medium rounded-md border border-orange-500/30">
                Market Closed - Data not updating
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-white">
              ₹{(hoveredData?.close || priceMetrics.currentPrice).toFixed(2)}
            </span>
            <span className={`text-lg font-semibold flex items-center gap-1 ${
              hoveredMetrics 
                ? (hoveredMetrics.isPositive ? 'text-green-400' : 'text-red-400')
                : (priceMetrics.isPositive ? 'text-green-400' : 'text-red-400')
            }`}>
              {(hoveredMetrics ? hoveredMetrics.isPositive : priceMetrics.isPositive) ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
              {(hoveredMetrics ? hoveredMetrics.isPositive : priceMetrics.isPositive) ? '+' : ''}
              {(hoveredMetrics ? hoveredMetrics.changeAmount : priceMetrics.changeAmount).toFixed(2)} 
              ({(hoveredMetrics ? hoveredMetrics.changePercent : priceMetrics.changePercent)}%)
            </span>
          </div>
          {liveQuote && (
            <div className="flex gap-6 mt-4 text-sm">
              <div>
                <span className="text-gray-500">Open: </span>
                <span className="text-white font-medium">₹{liveQuote.open?.toFixed(2) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">High: </span>
                <span className="text-green-400 font-medium">₹{liveQuote.high?.toFixed(2) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Low: </span>
                <span className="text-red-400 font-medium">₹{liveQuote.low?.toFixed(2) || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-500">Prev Close: </span>
                <span className="text-white font-medium">₹{priceMetrics.previousClose?.toFixed(2) || 'N/A'}</span>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={marketOpen ? { scale: 1.05 } : {}}
            onClick={marketOpen ? fetchLiveQuote : undefined}
            disabled={!marketOpen}
            className={`p-2 rounded-lg transition-colors ${
              marketOpen
                ? 'bg-accent-indigo/20 text-accent-indigo hover:bg-accent-indigo/30 cursor-pointer'
                : 'bg-gray-700/20 text-gray-600 cursor-not-allowed'
            }`}
            title={marketOpen ? "Refresh" : "Market is closed"}
          >
            <RefreshCw className="w-5 h-5" />
          </motion.button>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        {/* Time Frame Selector */}
        <div className="flex gap-2 flex-wrap">
          {TIMEFRAMES.map((tf) => (
            <motion.button
              key={tf.value}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              onClick={() => setTimeframe(tf.value)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                timeframe === tf.value
                  ? 'bg-accent-indigo text-white shadow-lg shadow-accent-indigo/30'
                  : 'bg-dark-border text-gray-400 hover:bg-dark-hover hover:text-white'
              }`}
              style={{ willChange: 'transform' }}
            >
              {tf.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[500px] flex items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-10 h-10 border-3 border-accent-indigo border-t-transparent rounded-full"
          />
        </div>
      ) : error ? (
        <div className="h-[500px] flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-4">{error}</p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              onClick={fetchChartData}
              className="px-4 py-2 bg-accent-indigo/20 text-accent-indigo rounded-lg hover:bg-accent-indigo/30"
            >
              Retry
            </motion.button>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={timeframe}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {/* Main Price Chart */}
            <ResponsiveContainer width="100%" height={400}>
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={priceMetrics.isPositive ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={priceMetrics.isPositive ? "#10b981" : "#ef4444"} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis
                  dataKey="time"
                  stroke="#64748b"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  interval={Math.floor(chartData.length / 8)}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickLine={false}
                  domain={[priceRange.minPrice - priceRange.priceBuffer, priceRange.maxPrice + priceRange.priceBuffer]}
                  tickFormatter={(value) => `₹${value.toFixed(0)}`}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#7c3aed', strokeWidth: 1, strokeDasharray: '3 3' }} />
                
                {/* Area chart for price trend */}
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={priceMetrics.isPositive ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  fill="url(#colorPrice)"
                  dot={false}
                  isAnimationActive={!isInitialLoad}
                  animationDuration={400}
                  animationEasing="ease-out"
                />
              
              {/* Previous close reference line */}
              {priceMetrics.previousClose && (
                <ReferenceLine
                  y={priceMetrics.previousClose}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  label={{ value: 'Prev Close', fill: '#94a3b8', fontSize: 10, position: 'insideTopRight' }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Volume Chart */}
          <ResponsiveContainer width="100%" height={100}>
            <ComposedChart
              data={chartData}
              margin={{ top: 0, right: 10, left: 10, bottom: 10 }}
            >
              <defs>
                <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={false}
                tickLine={false}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickLine={false}
                tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #7c3aed',
                  borderRadius: '8px',
                }}
                formatter={(value) => [`${(value / 1000000).toFixed(2)}M`, 'Volume']}
                labelFormatter={(label) => `Time: ${label}`}
              />
              <Bar
                dataKey="volume"
                fill="url(#colorVolume)"
                radius={[4, 4, 0, 0]}
                isAnimationActive={!isInitialLoad}
                animationDuration={400}
                animationEasing="ease-out"
              />
            </ComposedChart>
          </ResponsiveContainer>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Data Source */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>
          {marketOpen 
            ? (liveQuote?.source === 'yahoo-finance' ? '📊 Live data from Yahoo Finance' : '📦 Data from Database')
            : '⏸️ Market Closed - Showing last available data'
          }
        </span>
        {liveQuote?.timestamp && (
          <span>Last updated: {new Date(liveQuote.timestamp).toLocaleTimeString()}</span>
        )}
      </div>
    </motion.div>
  )
}

// Memoize component to prevent unnecessary re-renders
export default memo(StockChart)
