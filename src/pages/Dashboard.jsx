import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, 
  Briefcase, 
  Building2, 
  IndianRupee,
  PieChart as PieChartIcon,
  Sparkles,
  ShieldAlert,
  Target,
  Layers3,
  Brain,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useEffect, useMemo, useState } from 'react'
import { analyzePortfolio, formatCurrency, formatDecimal } from '../services/portfolioInsights'
import { getPortfolioInsights } from '../services/api'

const Dashboard = ({ portfolioData }) => {
  const navigate = useNavigate()
  const [portfolioInsights, setPortfolioInsights] = useState(null)
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

  const insights = portfolioInsights?.insights || []
  const summary = portfolioInsights?.summary || 'Portfolio insight service is loading.'
  const action = portfolioInsights?.action || 'Detailed portfolio recommendations will appear once insights are available.'
  const signal = portfolioInsights?.signal || (analysis.pnl >= 0 ? 'positive' : 'warning')

  if (!portfolioData) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="card relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-accent-indigo/10 via-transparent to-accent-pink/10 pointer-events-none" />
          <div className="relative grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-8 items-center">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-accent-indigo mb-3">Portfolio Overview</p>
              <h2 className="text-3xl font-bold text-white mb-3">No portfolio is loaded yet</h2>
              <p className="text-gray-400 leading-relaxed mb-6">
                The dashboard is ready once you import holdings. Use the Upload page from the sidebar to bring in your CSV, then this view will fill with analytics, insights, and allocation data.
              </p>
              <div className="flex flex-wrap gap-3">
                <button onClick={() => navigate('/holdings')} className="btn-secondary">
                  View Holdings
                </button>
                <button onClick={() => navigate('/watchlist')} className="btn-secondary">
                  Open Watchlist
                </button>
              </div>
            </div>
            <div className="rounded-2xl border border-dark-border bg-dark-bg/60 p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-dark-border bg-dark-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Status</p>
                  <p className="text-lg font-semibold text-white">Waiting for data</p>
                </div>
                <div className="rounded-xl border border-dark-border bg-dark-card p-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">Next step</p>
                  <p className="text-lg font-semibold text-white">Upload CSV</p>
                </div>
                <div className="rounded-xl border border-dark-border bg-dark-card p-4 col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-2">What appears here</p>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    Performance cards, allocation charts, concentration checks, and backend-generated recommendations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    )
  }

  const {
    total_portfolio_value,
    total_invested_value,
    total_pnl,
    total_pnl_percentage,
    total_holdings,
    number_of_companies,
    holdings
  } = portfolioData

  const effectiveInvestedValue = analysis.investedValue ?? total_invested_value ?? holdings.reduce((sum, h) => sum + (Number(h.invested_value) || 0), 0)
  const effectivePnl = analysis.pnl ?? total_pnl ?? (total_portfolio_value - effectiveInvestedValue)
  const effectivePnlPct = analysis.pnlPercentage ?? total_pnl_percentage ?? (effectiveInvestedValue > 0 ? (effectivePnl / effectiveInvestedValue) * 100 : 0)

  // Prepare data for charts
  const sectorChartData = analysis.sectorAllocation
  const marketCapChartData = analysis.marketCapAllocation

  const topHoldings = [...holdings]
    .sort((a, b) => b.current_value - a.current_value)
    .slice(0, 5)

  const COLORS = [
    '#6366F1', // Indigo
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#14B8A6', // Teal
    '#F97316', // Orange
    '#A855F7', // Violet
  ]

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-dark-card border border-dark-border rounded-lg p-3 shadow-xl">
          <p className="text-white font-semibold mb-1">{data.name}</p>
          <p className="text-accent-indigo text-sm">
            ₹{Number(data.value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-gray-400 text-xs">
            {data.percentage.toFixed(2)}% of portfolio
          </p>
        </div>
      )
    }
    return null
  }

  const statCards = [
    {
      title: 'Total Value',
      value: formatCurrency(total_portfolio_value),
      detail: `Invested: ${formatCurrency(effectiveInvestedValue)}`,
      tone: effectivePnl >= 0 ? 'text-green-400' : 'text-red-400',
      icon: IndianRupee,
      footer: `P/L: ${effectivePnl >= 0 ? '+' : ''}${formatCurrency(effectivePnl)} (${effectivePnl >= 0 ? '+' : ''}${formatDecimal(effectivePnlPct)}%)`,
    },
    {
      title: 'Total Holdings',
      value: `${total_holdings}`,
      detail: 'Positions in your portfolio',
      tone: 'text-white',
      icon: Briefcase,
      footer: `${holdings.length || 0} rows analyzed`,
    },
    {
      title: 'Companies',
      value: `${number_of_companies}`,
      detail: 'Unique companies tracked',
      tone: 'text-white',
      icon: Building2,
      footer: 'Diversity of names matters',
    },
    {
      title: 'Diversification',
      value: `${analysis.diversificationScore}/100`,
      detail: `${analysis.concentrationLevel} concentration`,
      tone: analysis.diversificationScore >= 70 ? 'text-green-400' : analysis.diversificationScore >= 45 ? 'text-yellow-400' : 'text-red-400',
      icon: Layers3,
      footer: `Top holding: ${formatDecimal(analysis.topHoldingShare)}%`,
    },
    {
      title: 'Winning positions',
      value: `${analysis.gainers}/${holdings.length || 0}`,
      detail: 'Profitable holdings',
      tone: 'text-white',
      icon: Target,
      footer: `Average return: ${formatDecimal(analysis.averageHoldingReturn)}%`,
    },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <div className="max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-accent-indigo to-accent-purple bg-clip-text text-transparent">
          Portfolio Dashboard
        </h1>
        <p className="text-gray-400 mb-8">Your investment overview at a glance</p>
      </motion.div>

      {/* Stats Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8"
      >
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <motion.div key={card.title} variants={itemVariants} className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-accent-indigo to-accent-purple rounded-lg flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className={`text-xs uppercase tracking-[0.18em] ${card.tone}`}>{card.title}</span>
              </div>
              <p className="text-3xl font-bold text-white">{card.value}</p>
              <p className="text-sm text-gray-400 mt-1">{card.detail}</p>
              <p className={`text-sm font-semibold mt-1 ${card.tone}`}>{card.footer}</p>
            </motion.div>
          )
        })}
      </motion.div>

      {/* AI Coach and quick analytics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
      >
        <div className="card lg:col-span-2 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-indigo/10 via-transparent to-accent-pink/10 pointer-events-none" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-accent-indigo" />
              <h2 className="text-xl font-semibold">AI Portfolio Coach</h2>
            </div>
            <p className="text-lg text-gray-100 leading-relaxed mb-4">{summary}</p>
            <p className="text-gray-400 mb-5">{action}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Signal</p>
                <p className="text-lg font-semibold text-white">{signal === 'positive' ? 'Bullish' : signal === 'negative' ? 'Bearish' : 'Caution'}</p>
              </div>
              <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Diversification</p>
                <p className="text-lg font-semibold text-white">{analysis.diversificationScore}/100</p>
              </div>
              <div className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-1">Concentration</p>
                <p className="text-lg font-semibold text-white">{formatDecimal(analysis.topHoldingShare)}%</p>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-accent-pink" />
            <h2 className="text-xl font-semibold">Quick Signals</h2>
          </div>
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight) => (
                <div key={insight.title} className="rounded-xl border border-dark-border bg-dark-bg/60 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${insight.tone === 'positive' ? 'bg-green-400' : insight.tone === 'warning' ? 'bg-yellow-400' : insight.tone === 'negative' ? 'bg-red-400' : 'bg-accent-indigo'}`} />
                    <p className="text-sm font-semibold text-white">{insight.title}</p>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">{insight.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Loading insight summaries from the backend...</p>
          )}
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Sector Allocation */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-accent-indigo" />
            <h2 className="text-xl font-semibold">Sector Allocation</h2>
          </div>
          <div className="flex flex-col lg:flex-row items-center gap-6">
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={sectorChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    paddingAngle={2}
                  >
                    {sectorChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-shrink-0 w-full lg:w-auto">
              <div className="space-y-2">
                {sectorChartData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div 
                      className="w-3 h-3 rounded-full flex-shrink-0" 
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="text-gray-300 truncate">{entry.name}</span>
                    <span className="text-gray-400 ml-auto font-medium whitespace-nowrap">
                      {entry.percentage.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.45 }}
          className="card"
        >
          <div className="flex items-center gap-2 mb-6">
            <ShieldAlert className="w-5 h-5 text-accent-pink" />
            <h2 className="text-xl font-semibold">Market Cap Mix</h2>
          </div>
          <div className="space-y-4">
            {marketCapChartData.length > 0 ? marketCapChartData.map((entry, index) => (
              <div key={entry.name}>
                <div className="flex items-center justify-between mb-2 text-sm">
                  <span className="text-gray-300">{entry.name}</span>
                  <span className="text-gray-400">{entry.percentage.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-dark-bg overflow-hidden border border-dark-border">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent-indigo via-accent-purple to-accent-pink"
                    style={{ width: `${Math.max(4, entry.percentage)}%` }}
                  />
                </div>
              </div>
            )) : (
              <p className="text-gray-400">No market cap information available.</p>
            )}
          </div>
        </motion.div>
      </div>

      {/* Top Holdings */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="card"
      >
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-5 h-5 text-accent-pink" />
          <h2 className="text-xl font-semibold">Top 5 Holdings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-dark-border">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Company</th>
                <th className="text-left py-3 px-4 text-gray-400 font-medium">Symbol</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Quantity</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Buy Price</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Price</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">Value</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">P/L</th>
                <th className="text-right py-3 px-4 text-gray-400 font-medium">% Portfolio</th>
              </tr>
            </thead>
            <tbody>
              {topHoldings.map((holding, index) => (
                <motion.tr
                  key={holding.symbol}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 * index }}
                  className="border-b border-dark-border/50 hover:bg-dark-hover transition-colors cursor-pointer"
                  onClick={() => navigate(`/company/${holding.symbol}`)}
                >
                  <td className="py-3 px-4">{holding.company_name}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-1 bg-accent-indigo/20 text-accent-indigo rounded text-sm font-medium">
                      {holding.symbol}
                    </span>
                  </td>
                  <td className="text-right py-3 px-4">{holding.quantity}</td>
                  <td className="text-right py-3 px-4">₹{Number(holding.buy_price || 0).toFixed(2)}</td>
                  <td className="text-right py-3 px-4">₹{Number(holding.current_price).toFixed(2)}</td>
                  <td className="text-right py-3 px-4 font-semibold">
                    ₹{Number(holding.current_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className={`text-right py-3 px-4 font-medium ${Number(holding.pnl_amount || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Number(holding.pnl_amount || 0) >= 0 ? '+' : ''}
                    ₹{Number(holding.pnl_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="text-right py-3 px-4">
                    <span className="text-green-400">
                      {Number(holding.percentage_of_portfolio).toFixed(2)}%
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

export default Dashboard
