import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { 
  TrendingUp, 
  Briefcase, 
  Building2, 
  IndianRupee,
  PieChart as PieChartIcon,
  UploadCloud
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

const Dashboard = ({ portfolioData }) => {
  const navigate = useNavigate()

  if (!portfolioData) {
    return (
      <div className="text-center py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <UploadCloud className="w-24 h-24 mx-auto mb-6 text-gray-600" />
          <h2 className="text-2xl font-semibold mb-2">No Portfolio Data</h2>
          <p className="text-gray-400 mb-6">Upload your portfolio to get started</p>
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

  const {
    total_portfolio_value,
    total_invested_value,
    total_pnl,
    total_pnl_percentage,
    total_holdings,
    number_of_companies,
    holdings
  } = portfolioData

  const effectiveInvestedValue = total_invested_value ?? holdings.reduce((sum, h) => sum + (Number(h.invested_value) || 0), 0)
  const effectivePnl = total_pnl ?? (total_portfolio_value - effectiveInvestedValue)
  const effectivePnlPct = total_pnl_percentage ?? (effectiveInvestedValue > 0 ? (effectivePnl / effectiveInvestedValue) * 100 : 0)

  // Prepare data for charts
  const sectorData = holdings.reduce((acc, holding) => {
    const sector = holding.sector || 'Unknown'
    if (!acc[sector]) {
      acc[sector] = { name: sector, value: 0, percentage: 0 }
    }
    acc[sector].value += holding.current_value
    return acc
  }, {})

  const sectorChartData = Object.values(sectorData).map(item => ({
    ...item,
    percentage: (item.value / total_portfolio_value) * 100
  })).sort((a, b) => b.value - a.value)

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
        className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8"
      >
        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-indigo to-accent-purple rounded-lg flex items-center justify-center">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Total Value</h3>
          <p className="text-3xl font-bold text-white">
            ₹{Number(total_portfolio_value).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Invested: ₹{Number(effectiveInvestedValue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </p>
          <p className={`text-sm font-semibold mt-1 ${effectivePnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            P/L: {effectivePnl >= 0 ? '+' : ''}₹{Number(effectivePnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({effectivePnl >= 0 ? '+' : ''}{Number(effectivePnlPct).toFixed(2)}%)
          </p>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-purple to-accent-pink rounded-lg flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Total Holdings</h3>
          <p className="text-3xl font-bold text-white">{total_holdings}</p>
        </motion.div>

        <motion.div variants={itemVariants} className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-accent-pink to-accent-indigo rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-400 text-sm mb-1">Companies</h3>
          <p className="text-3xl font-bold text-white">{number_of_companies}</p>
        </motion.div>
      </motion.div>

      {/* Charts */}
      <div className="mb-8">
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
