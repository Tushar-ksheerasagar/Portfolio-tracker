import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Info,
  Newspaper,
} from 'lucide-react'
import { getCompanyDetails, getStockSentiment } from '../services/api'
import StockChart from '../components/StockChart'

// Tooltip definitions for financial metrics
const METRIC_EXPLANATIONS = {
  pe_ratio: "Price-to-Earnings Ratio: Measures stock price relative to earnings. Lower values may indicate undervaluation.",
  pb_ratio: "Price-to-Book Ratio: Compares market value to book value. Values below 1 may suggest undervaluation.",
  roe: "Return on Equity: Shows how efficiently a company uses shareholder equity to generate profit. Higher is better.",
  debt_to_equity: "Debt-to-Equity Ratio: Measures financial leverage. Lower values indicate less debt relative to equity.",
  gross_profit_margin: "Gross Profit Margin: Percentage of revenue remaining after cost of goods sold. Higher indicates better efficiency.",
  net_profit_margin: "Net Profit Margin: Percentage of revenue that becomes profit. Higher is better.",
  current_ratio: "Current Ratio: Ability to pay short-term obligations. Values above 1 indicate good liquidity.",
  vqm_score: "VQM Score: Combined Value, Quality, and Momentum score for overall stock assessment.",
  quality_score: "Quality Score: Measures company's financial health and operational efficiency.",
  value_score: "Value Score: Indicates if the stock is undervalued based on fundamental metrics.",
  momentum_score: "Momentum Score: Measures price trends and trading momentum.",
  market_cap: "Market Capitalization: Total value of all outstanding shares. Indicates company size.",
  total_revenue: "Total Revenue: Total income from all business operations before expenses.",
  gross_profit: "Gross Profit: Revenue minus cost of goods sold. Shows core profitability.",
  operating_income: "Operating Income: Profit from business operations before interest and taxes (EBIT).",
  net_income: "Net Income: Final profit after all expenses, taxes, and costs.",
  operating_cash_flow: "Operating Cash Flow: Cash generated from normal business operations.",
  investing_cash_flow: "Investing Cash Flow: Cash used for investments in assets, equipment, or acquisitions.",
  financing_cash_flow: "Financing Cash Flow: Cash from debt, equity, and dividend activities.",
  free_cash_flow: "Free Cash Flow: Cash available after operating expenses and capital expenditures.",
}

// Reusable Metric Display Component with Tooltip
const MetricWithTooltip = ({ label, value, explanation, className = "" }) => {
  const [showTooltip, setShowTooltip] = useState(false)
  
  return (
    <div className="relative">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-gray-400 text-sm">{label}</p>
        <div 
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50"
            >
              <p className="text-xs text-gray-300 leading-relaxed">{explanation}</p>
              <div className="absolute left-4 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-accent-indigo/30"></div>
            </motion.div>
          )}
        </div>
      </div>
      <p className={className}>{value}</p>
    </div>
  )
}

const CompanyDetails = () => {
  const { symbol } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [liveQuote, setLiveQuote] = useState(null)
  const [sentiment, setSentiment] = useState(null)
  const [activeSection, setActiveSection] = useState('chart')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const companyData = await getCompanyDetails(symbol)
        setData(companyData)
      } catch (error) {
        console.error('Error fetching company details:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    // Refresh company details every 30 seconds for real-time updates
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [symbol])

  // Fetch and refresh sentiment periodically
  useEffect(() => {
    const fetchSentiment = async () => {
      try {
        const sentimentData = await getStockSentiment(symbol)
        setSentiment(sentimentData)
      } catch (err) {
        console.error('Error fetching sentiment:', err)
      }
    }

    fetchSentiment()
    const interval = setInterval(fetchSentiment, 30000)
    return () => clearInterval(interval)
  }, [symbol])

  // Fetch live quote for real-time price updates
  useEffect(() => {
    const fetchLiveQuote = async () => {
      try {
        const response = await fetch(`http://localhost:5000/live-quote/${symbol}`)
        if (response.ok) {
          const data = await response.json()
          setLiveQuote(data)
        }
      } catch (err) {
        console.error('Error fetching live quote:', err)
      }
    }

    fetchLiveQuote()
    // Refresh live quote every 5 seconds
    const interval = setInterval(fetchLiveQuote, 5000)
    return () => clearInterval(interval)
  }, [symbol])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <h2 className="text-2xl font-semibold mb-2">Company not found</h2>
        <button onClick={() => navigate(-1)} className="btn-primary mt-4">
          Go Back
        </button>
      </div>
    )
  }

  const { stock_info, financial_ratios, income_statement, cash_flow } = data

  const ratios = financial_ratios?.[0] || {}
  const income = income_statement?.[0] || {}
  const cashFlow = cash_flow?.[0] || {}
  const hasRatios = financial_ratios?.length > 0
  const hasIncome = income_statement?.length > 0
  const hasCashFlow = cash_flow?.length > 0
  const hasSentiment = Boolean(sentiment)

  const sections = [
    { key: 'chart', label: 'Chart', enabled: true },
    { key: 'ratios', label: 'Ratios', enabled: hasRatios },
    { key: 'income', label: 'Income Statement', enabled: hasIncome },
    { key: 'cashflow', label: 'Cash Flow', enabled: hasCashFlow },
    { key: 'sentiment', label: 'Sentiment', enabled: hasSentiment },
  ]

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2">{stock_info.company_name}</h1>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-accent-indigo/20 text-accent-indigo rounded-lg text-sm font-medium">
                {stock_info.symbol}
              </span>
              {stock_info.sector && (
                <span className="text-gray-400">{stock_info.sector}</span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Price Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="card mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 mb-2">Current Price</p>
            <p className="text-4xl font-bold">
              ₹{liveQuote?.ltp ? Number(liveQuote.ltp).toFixed(2) : (stock_info.current_price ? Number(stock_info.current_price).toFixed(2) : 'N/A')}
            </p>
            {liveQuote?.ltp && liveQuote?.previousClose && (
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-sm font-medium flex items-center gap-1 ${
                  liveQuote.ltp >= liveQuote.previousClose ? 'text-green-400' : 'text-red-400'
                }`}>
                  {liveQuote.ltp >= liveQuote.previousClose ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  {liveQuote.ltp >= liveQuote.previousClose ? '+' : ''}
                  {(liveQuote.ltp - liveQuote.previousClose).toFixed(2)} 
                  ({((liveQuote.ltp - liveQuote.previousClose) / liveQuote.previousClose * 100).toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
          <div className="text-right">
            {(liveQuote?.marketCap || stock_info.market_cap) && (
              <MetricWithTooltip
                label="Market Cap"
                value={`₹${(Number(liveQuote?.marketCap || stock_info.market_cap) / 10000000).toFixed(2)} Cr`}
                explanation={METRIC_EXPLANATIONS.market_cap}
                className="text-2xl font-semibold"
              />
            )}
          </div>
        </div>
      </motion.div>

      {/* Single switchable insights window */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="card mb-8"
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-semibold">Company Insights</h2>
          <div className="overflow-x-auto">
            <div className="inline-flex items-center gap-2 bg-dark-bg border border-dark-border rounded-xl p-1">
              {sections.map((section) => (
                <button
                  key={section.key}
                  onClick={() => section.enabled && setActiveSection(section.key)}
                  disabled={!section.enabled}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    activeSection === section.key
                      ? 'bg-accent-indigo text-white'
                      : section.enabled
                      ? 'text-gray-300 hover:bg-dark-card'
                      : 'text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {section.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeSection === 'chart' && (
          <div className="min-h-[320px]">
            <StockChart symbol={symbol} />
          </div>
        )}

        {activeSection === 'ratios' && (
          hasRatios ? (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <BarChart3 className="w-5 h-5 text-accent-indigo" />
                <h3 className="text-xl font-semibold">Key Ratios</h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                {ratios.pe_ratio != null && (
                  <MetricWithTooltip
                    label="P/E Ratio"
                    value={Number(ratios.pe_ratio).toFixed(2)}
                    explanation={METRIC_EXPLANATIONS.pe_ratio}
                    className="text-2xl font-bold"
                  />
                )}
                {ratios.pb_ratio != null && (
                  <MetricWithTooltip
                    label="P/B Ratio"
                    value={Number(ratios.pb_ratio).toFixed(2)}
                    explanation={METRIC_EXPLANATIONS.pb_ratio}
                    className="text-2xl font-bold"
                  />
                )}
                {ratios.roe != null && (
                  <MetricWithTooltip
                    label="ROE"
                    value={`${Number(ratios.roe).toFixed(2)}%`}
                    explanation={METRIC_EXPLANATIONS.roe}
                    className="text-2xl font-bold text-green-400"
                  />
                )}
                {ratios.debt_to_equity != null && (
                  <MetricWithTooltip
                    label="Debt/Equity"
                    value={Number(ratios.debt_to_equity).toFixed(2)}
                    explanation={METRIC_EXPLANATIONS.debt_to_equity}
                    className="text-2xl font-bold"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mt-6">
                {ratios.gross_profit_margin != null && (
                  <MetricWithTooltip
                    label="Gross Margin"
                    value={`${Number(ratios.gross_profit_margin).toFixed(2)}%`}
                    explanation={METRIC_EXPLANATIONS.gross_profit_margin}
                    className="text-xl font-semibold"
                  />
                )}
                {ratios.net_profit_margin != null && (
                  <MetricWithTooltip
                    label="Net Margin"
                    value={`${Number(ratios.net_profit_margin).toFixed(2)}%`}
                    explanation={METRIC_EXPLANATIONS.net_profit_margin}
                    className="text-xl font-semibold"
                  />
                )}
                {ratios.current_ratio != null && (
                  <MetricWithTooltip
                    label="Current Ratio"
                    value={Number(ratios.current_ratio).toFixed(2)}
                    explanation={METRIC_EXPLANATIONS.current_ratio}
                    className="text-xl font-semibold"
                  />
                )}
              </div>

              {(ratios.vqm_score || ratios.quality_score || ratios.value_score) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-dark-border">
                  {ratios.vqm_score != null && (
                    <MetricWithTooltip
                      label="VQM Score"
                      value={Number(ratios.vqm_score).toFixed(2)}
                      explanation={METRIC_EXPLANATIONS.vqm_score}
                      className="text-2xl font-bold text-accent-purple"
                    />
                  )}
                  {ratios.quality_score != null && (
                    <MetricWithTooltip
                      label="Quality Score"
                      value={Number(ratios.quality_score).toFixed(2)}
                      explanation={METRIC_EXPLANATIONS.quality_score}
                      className="text-2xl font-bold text-accent-indigo"
                    />
                  )}
                  {ratios.value_score != null && (
                    <MetricWithTooltip
                      label="Value Score"
                      value={Number(ratios.value_score).toFixed(2)}
                      explanation={METRIC_EXPLANATIONS.value_score}
                      className="text-2xl font-bold text-green-400"
                    />
                  )}
                  {ratios.momentum_score != null && (
                    <MetricWithTooltip
                      label="Momentum Score"
                      value={Number(ratios.momentum_score).toFixed(2)}
                      explanation={METRIC_EXPLANATIONS.momentum_score}
                      className="text-2xl font-bold text-yellow-400"
                    />
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400">No ratios data available.</p>
          )
        )}

        {activeSection === 'income' && (
          hasIncome ? (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-accent-purple" />
                <h3 className="text-xl font-semibold">Income Statement</h3>
              </div>

              <div className="space-y-4">
                {income.total_revenue != null && (
                  <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Total Revenue</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.total_revenue}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold">
                      ₹{(Number(income.total_revenue) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
                {income.gross_profit != null && (
                  <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Gross Profit</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.gross_profit}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold">
                      ₹{(Number(income.gross_profit) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
                {income.operating_income != null && (
                  <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Operating Income</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.operating_income}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold">
                      ₹{(Number(income.operating_income) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
                {income.net_income != null && (
                  <div className="flex justify-between items-center py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Net Income</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.net_income}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-green-400">
                      ₹{(Number(income.net_income) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No income statement data available.</p>
          )
        )}

        {activeSection === 'cashflow' && (
          hasCashFlow ? (
            <div>
              <div className="flex items-center gap-2 mb-6">
                <DollarSign className="w-5 h-5 text-accent-pink" />
                <h3 className="text-xl font-semibold">Cash Flow</h3>
              </div>

              <div className="space-y-4">
                {cashFlow.operating_cash_flow != null && (
                  <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Operating Cash Flow</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.operating_cash_flow}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold">
                      ₹{(Number(cashFlow.operating_cash_flow) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
                {cashFlow.investing_cash_flow != null && (
                  <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Investing Cash Flow</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.investing_cash_flow}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold">
                      ₹{(Number(cashFlow.investing_cash_flow) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
                {cashFlow.financing_cash_flow != null && (
                  <div className="flex justify-between items-center py-2 border-b border-dark-border/50">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Financing Cash Flow</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.financing_cash_flow}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold">
                      ₹{(Number(cashFlow.financing_cash_flow) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
                {cashFlow.free_cash_flow != null && (
                  <div className="flex justify-between items-center py-2">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-400">Free Cash Flow</span>
                      <div className="relative group">
                        <Info className="w-3.5 h-3.5 text-gray-500 hover:text-accent-indigo cursor-help transition-colors" />
                        <div className="absolute left-0 bottom-full mb-2 w-64 bg-dark-card border border-accent-indigo/30 rounded-lg p-3 shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <p className="text-xs text-gray-300 leading-relaxed">{METRIC_EXPLANATIONS.free_cash_flow}</p>
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-green-400">
                      ₹{(Number(cashFlow.free_cash_flow) / 10000000).toFixed(2)} Cr
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-gray-400">No cash flow data available.</p>
          )
        )}

        {activeSection === 'sentiment' && (
          hasSentiment ? (
            <div>
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <Newspaper className="w-5 h-5 text-accent-pink" />
                  <h3 className="text-xl font-semibold">Market Sentiment</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                    sentiment.label === 'Bullish'
                      ? 'bg-green-500/20 text-green-400'
                      : sentiment.label === 'Bearish'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {sentiment.label}
                  </span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                    sentiment.signal === 'BUY'
                      ? 'bg-green-500/20 text-green-400'
                      : sentiment.signal === 'SELL'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {sentiment.signal || 'HOLD'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                  <p className="text-gray-400 text-sm mb-1">Sentiment Score</p>
                  <p className="text-2xl font-bold">{Number(sentiment.score || 0).toFixed(3)}</p>
                </div>
                <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                  <p className="text-gray-400 text-sm mb-1">Confidence</p>
                  <p className="text-2xl font-bold">{(Number(sentiment.confidence || 0) * 100).toFixed(1)}%</p>
                </div>
                <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                  <p className="text-gray-400 text-sm mb-1">Signal</p>
                  <p className={`text-2xl font-bold ${
                    sentiment.signal === 'BUY'
                      ? 'text-green-400'
                      : sentiment.signal === 'SELL'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }`}>
                    {sentiment.signal || 'HOLD'}
                  </p>
                </div>
                <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                  <p className="text-gray-400 text-sm mb-1">News Articles</p>
                  <p className="text-2xl font-bold">{sentiment.articles_count || 0}</p>
                </div>
              </div>

              {sentiment.articles?.length > 0 && (
                <div className="space-y-3">
                  {sentiment.articles.map((article, idx) => (
                    <div
                      key={`${article.title}-${idx}`}
                      className="bg-dark-bg border border-dark-border rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        {article.link ? (
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-gray-200 text-sm font-medium line-clamp-2 hover:text-accent-indigo transition-colors"
                          >
                            {article.title}
                          </a>
                        ) : (
                          <p className="text-gray-200 text-sm font-medium line-clamp-2">{article.title}</p>
                        )}
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${
                          article.label === 'Bullish'
                            ? 'bg-green-500/20 text-green-400'
                            : article.label === 'Bearish'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {article.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">
                        {article.publisher || 'Unknown source'} | score: {Number(article.score || 0).toFixed(3)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400">Sentiment data is loading...</p>
          )
        )}
      </motion.div>
    </div>
  )
}

export default CompanyDetails
