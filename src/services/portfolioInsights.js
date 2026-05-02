const currencyFormatter = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const safeNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const formatCurrency = (value) =>
  `₹${currencyFormatter.format(safeNumber(value))}`;

export const formatDecimal = (value) => decimalFormatter.format(safeNumber(value));

const getHoldings = (portfolioData = {}) => portfolioData.holdings || [];

const getHoldingValue = (holding) =>
  safeNumber(
    holding.current_value ||
      safeNumber(holding.quantity) * safeNumber(holding.current_price)
  );

const getInvestedValue = (holding) =>
  safeNumber(
    holding.invested_value ||
      safeNumber(holding.quantity) * safeNumber(holding.buy_price)
  );

const getHoldingPnl = (holding) =>
  safeNumber(
    holding.pnl_amount || getHoldingValue(holding) - getInvestedValue(holding)
  );

const groupByKey = (holdings, key) => {
  return holdings.reduce((acc, holding) => {
    const groupKey = holding[key] || 'Unknown';
    if (!acc[groupKey]) {
      acc[groupKey] = 0;
    }
    acc[groupKey] += getHoldingValue(holding);
    return acc;
  }, {});
};

const toAllocation = (groups, totalValue) => {
  return Object.entries(groups)
    .map(([name, value]) => ({
      name,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((left, right) => right.value - left.value);
};

export const analyzePortfolio = (portfolioData = {}) => {
  const holdings = getHoldings(portfolioData);

  const totalValue = safeNumber(
    portfolioData.total_portfolio_value,
    holdings.reduce((sum, holding) => sum + getHoldingValue(holding), 0)
  );
  const investedValue = safeNumber(
    portfolioData.total_invested_value,
    holdings.reduce((sum, holding) => sum + getInvestedValue(holding), 0)
  );
  const pnl = safeNumber(portfolioData.total_pnl, totalValue - investedValue);
  const pnlPercentage = safeNumber(
    portfolioData.total_pnl_percentage,
    investedValue > 0 ? (pnl / investedValue) * 100 : 0
  );

  const sortedByValue = [...holdings].sort(
    (left, right) => getHoldingValue(right) - getHoldingValue(left)
  );
  const sortedByPnl = [...holdings].sort(
    (left, right) => getHoldingPnl(right) - getHoldingPnl(left)
  );
  const gainers = holdings.filter((holding) => getHoldingPnl(holding) >= 0).length;
  const losers = holdings.filter((holding) => getHoldingPnl(holding) < 0).length;

  const topHoldingShare =
    sortedByValue[0] && totalValue > 0
      ? (getHoldingValue(sortedByValue[0]) / totalValue) * 100
      : 0;
  const topThreeShare = sortedByValue
    .slice(0, 3)
    .reduce((sum, holding) => sum + getHoldingValue(holding), 0);
  const topThreePercentage = totalValue > 0 ? (topThreeShare / totalValue) * 100 : 0;
  const averageHoldingReturn = holdings.length
    ? holdings.reduce((sum, holding) => {
        const invested = getInvestedValue(holding);
        const holdingPnl = getHoldingPnl(holding);
        return sum + (invested > 0 ? (holdingPnl / invested) * 100 : 0);
      }, 0) / holdings.length
    : 0;

  const sectorAllocation = toAllocation(groupByKey(holdings, 'sector'), totalValue);
  const marketCapAllocation = toAllocation(
    groupByKey(holdings, 'market_cap_category'),
    totalValue
  );

  const concentrationScore = Math.min(
    100,
    topHoldingShare * 1.35 + topThreePercentage * 0.55
  );
  const diversificationScore = Math.max(0, Math.round(100 - concentrationScore));
  const concentrationLevel =
    concentrationScore > 50
      ? 'High'
      : concentrationScore > 30
        ? 'Moderate'
        : 'Balanced';

  return {
    holdings,
    totalValue,
    investedValue,
    pnl,
    pnlPercentage,
    gainers,
    losers,
    topHoldingShare,
    topThreePercentage,
    averageHoldingReturn,
    sectorAllocation,
    marketCapAllocation,
    concentrationLevel,
    concentrationScore,
    diversificationScore,
    bestHolding: sortedByPnl[0] || null,
    worstHolding: sortedByPnl[sortedByPnl.length - 1] || null,
    sortedHoldings: sortedByValue,
  };
};

const WATCHLIST_KEY = 'portfolio_watchlist';

export const getWatchlist = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(WATCHLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveWatchlist = (watchlist) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
};

export const isWatched = (symbol) =>
  getWatchlist().some((item) => item.symbol === symbol);

export const toggleWatchlist = (holding) => {
  if (!holding?.symbol) return getWatchlist();

  const watchlist = getWatchlist();
  const exists = watchlist.some((item) => item.symbol === holding.symbol);
  const nextWatchlist = exists
    ? watchlist.filter((item) => item.symbol !== holding.symbol)
    : [
        ...watchlist,
        {
          symbol: holding.symbol,
          company_name: holding.company_name || holding.symbol,
          sector: holding.sector || '',
          market_cap_category: holding.market_cap_category || '',
        },
      ];

  saveWatchlist(nextWatchlist);
  return nextWatchlist;
};

export const removeFromWatchlist = (symbol) => {
  const nextWatchlist = getWatchlist().filter((item) => item.symbol !== symbol);
  saveWatchlist(nextWatchlist);
  return nextWatchlist;
};

export const formatWatchlistItem = (item) => ({
  ...item,
  label: item.company_name || item.symbol,
});
