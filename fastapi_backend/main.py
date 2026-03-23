from fastapi import FastAPI, File, UploadFile, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import csv
import io
import os
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import yfinance as yf
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from jose import jwt, JWTError
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

load_dotenv()

app = FastAPI(
    title="Portfolio Analytics API",
    description="Stock portfolio tracking with real-time data",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache Configuration
cache_store = {}
CHART_CACHE_DURATION = 3600  # 1 hour for chart data
DETAILS_CACHE_DURATION = 1800  # 30 minutes for company details
RECOMMENDATION_CACHE_DURATION = 3600  # 1 hour for recommendations
SENTIMENT_CACHE_DURATION = 300  # 5 minutes for sentiment

sentiment_analyzer = SentimentIntensityAnalyzer()
sentiment_analyzer.lexicon.update({
    'beat': 2.0,
    'miss': -2.0,
    'upgrade': 2.2,
    'downgrade': -2.2,
    'outperform': 1.8,
    'underperform': -1.8,
    'guidance raise': 2.1,
    'guidance cut': -2.1,
    'bullish': 2.0,
    'bearish': -2.0,
})

def get_cached_data(cache_key: str, duration: int):
    """Check if cached data exists and is still valid"""
    if cache_key in cache_store:
        cached_data, timestamp = cache_store[cache_key]
        if (datetime.now() - timestamp).total_seconds() < duration:
            return cached_data
    return None

def set_cached_data(cache_key: str, data):
    """Store data in cache with timestamp"""
    cache_store[cache_key] = (data, datetime.now())


def sentiment_label(score: float) -> str:
    """Map numeric sentiment score to readable label."""
    if score >= 0.15:
        return 'Bullish'
    if score <= -0.15:
        return 'Bearish'
    return 'Neutral'


def sentiment_signal(score: float, confidence: float) -> str:
    """Map sentiment score+confidence to a simple trading signal."""
    if score >= 0.2 and confidence >= 0.3:
        return 'BUY'
    if score <= -0.2 and confidence >= 0.3:
        return 'SELL'
    return 'HOLD'


def parse_published_unix(published_ts) -> float | None:
    """Parse different publish date formats into a unix timestamp."""
    if published_ts in (None, ''):
        return None

    if isinstance(published_ts, (int, float)):
        value = float(published_ts)
        # Some feeds return milliseconds.
        return value / 1000.0 if value > 1e12 else value

    if isinstance(published_ts, str):
        raw = published_ts.strip()
        if not raw:
            return None

        try:
            return datetime.fromisoformat(raw.replace('Z', '+00:00')).timestamp()
        except ValueError:
            pass

        for fmt in ('%Y-%m-%d %H:%M:%S', '%a, %d %b %Y %H:%M:%S %z'):
            try:
                return datetime.strptime(raw, fmt).timestamp()
            except ValueError:
                continue

    return None


def extract_news_published_at(item: dict, content: dict) -> str | int | float | None:
    """Get publish timestamp from different Yahoo news payload shapes."""
    return (
        item.get('providerPublishTime')
        or item.get('pubDate')
        or content.get('pubDate')
        or content.get('displayTime')
    )


def sentiment_weight(published_ts) -> float:
    """Give recent news slightly higher influence."""
    published_unix = parse_published_unix(published_ts)

    if not published_unix:
        return 1.0

    age_hours = max((datetime.utcnow().timestamp() - published_unix) / 3600.0, 0.0)
    return max(0.25, 1.0 / (1.0 + age_hours / 6.0))

# Database Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'database': os.getenv('DB_NAME', 'capstone_db'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', '1234'),
    'port': os.getenv('DB_PORT', 5432),
}

JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'change-this-in-production')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRE_MINUTES = int(os.getenv('JWT_EXPIRE_MINUTES', '1440'))
pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
bearer_scheme = HTTPBearer(auto_error=False)


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str

def get_db_connection():
    """Get database connection"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise


def init_user_tables():
    """Create auth and user portfolio tables if they do not exist."""
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS user_holdings (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                company_name VARCHAR(255) NOT NULL,
                symbol VARCHAR(50) NOT NULL,
                quantity INTEGER NOT NULL,
                buy_price DOUBLE PRECISION NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                UNIQUE(user_id, symbol)
            )
            """
        )
        cur.execute(
            """
            ALTER TABLE user_holdings
            ADD COLUMN IF NOT EXISTS buy_price DOUBLE PRECISION
            """
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()


@app.on_event("startup")
def startup_event():
    init_user_tables()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        if not user_id or not email:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"id": int(user_id), "email": email}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# Helper Functions
def get_symbol_from_company_name(company_name: str) -> str | None:
    """Get stock symbol from company name"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT symbol FROM stock_info WHERE LOWER(company_name) LIKE LOWER(%s) LIMIT 1",
            (f"%{company_name}%",)
        )
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result['symbol'] if result else None
    except Exception as e:
        print(f"Error fetching symbol: {e}")
        return None

def get_sector_from_symbol(symbol: str) -> str | None:
    """Get sector from stock symbol"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT sector FROM stock_info WHERE symbol = %s LIMIT 1",
            (symbol,)
        )
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result['sector'] if result else None
    except Exception as e:
        print(f"Error fetching sector: {e}")
        return None

def get_market_cap_from_symbol(symbol: str) -> float | None:
    """Get market cap from stock symbol"""
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT market_cap FROM stock_info WHERE symbol = %s LIMIT 1",
            (symbol,)
        )
        result = cur.fetchone()
        cur.close()
        conn.close()
        return result['market_cap'] if result else None
    except Exception as e:
        print(f"Error fetching market cap: {e}")
        return None

def categorize_market_cap(market_cap: float) -> str:
    """Categorize market cap"""
    if not market_cap:
        return "Unknown"
    market_cap_crores = market_cap / 10000000
    if market_cap_crores >= 20000:
        return "Large Cap"
    elif market_cap_crores >= 5000:
        return "Mid Cap"
    return "Small Cap"

def fetch_stock_data_for_upload(company_key: str, symbol: str, quantity: int, buy_price: float | None = None) -> dict:
    """Fetch all required data for a single stock during upload"""
    current_price = get_current_price(symbol)
    if not current_price:
        return None
    
    sector = get_sector_from_symbol(symbol)
    market_cap = get_market_cap_from_symbol(symbol)
    market_cap_category = categorize_market_cap(market_cap)
    
    effective_buy_price = float(buy_price) if buy_price and buy_price > 0 else current_price
    current_value = quantity * current_price
    invested_value = quantity * effective_buy_price
    pnl_amount = current_value - invested_value
    pnl_percentage = (pnl_amount / invested_value * 100) if invested_value > 0 else 0
    
    return {
        'company_name': company_key,
        'symbol': symbol,
        'quantity': quantity,
        'buy_price': effective_buy_price,
        'current_price': current_price,
        'current_value': current_value,
        'invested_value': invested_value,
        'pnl_amount': pnl_amount,
        'pnl_percentage': pnl_percentage,
        'sector': sector or 'N/A',
        'market_cap': market_cap,
        'market_cap_category': market_cap_category,
    }

def get_current_price(symbol: str) -> float | None:
    """Get real-time price from Yahoo Finance"""
    try:
        # Try to get real-time price from Yahoo Finance with .NS suffix
        ticker = yf.Ticker(f"{symbol}.NS")
        data = ticker.history(period="1d")
        
        if not data.empty and 'Close' in data.columns:
            price = float(data['Close'].iloc[-1])
            if price > 0:
                print(f"Real-time price for {symbol}: ₹{price}")
                return price
    except Exception as e:
        print(f"Yahoo Finance error for {symbol}, using database price: {e}")
    
    # Fallback to database price
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute(
            "SELECT current_price FROM stock_info WHERE symbol = %s LIMIT 1",
            (symbol,)
        )
        result = cur.fetchone()
        cur.close()
        conn.close()
        return float(result['current_price']) if result else None
    except Exception as e:
        print(f"Error fetching price from database: {e}")
        return None

def get_yahoo_finance_data(symbol: str) -> dict:
    """Fetch detailed financial data from Yahoo Finance"""
    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        info = ticker.info
        
        return {
            'currentPrice': info.get('currentPrice'),
            'marketCap': info.get('marketCap'),
            'peRatio': info.get('trailingPE'),
            'pbRatio': info.get('priceToBook'),
            'dividendYield': info.get('dividendYield'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh'),
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow'),
            'beta': info.get('beta'),
            'sector': info.get('sector'),
            'industry': info.get('industry'),
            'trailingEps': info.get('trailingEps'),
            'forwardEps': info.get('forwardEps'),
            'profitMargins': info.get('profitMargins'),
            'revenueGrowth': info.get('revenueGrowth'),
            'earningsGrowth': info.get('earningsGrowth'),
            'returnOnEquity': info.get('returnOnEquity'),
            'returnOnAssets': info.get('returnOnAssets'),
            'debtToEquity': info.get('debtToEquity'),
            'currentRatio': info.get('currentRatio'),
            'quickRatio': info.get('quickRatio'),
            'grossMargins': info.get('grossMargins'),
            'operatingMargins': info.get('operatingMargins'),
            'ebitdaMargins': info.get('ebitdaMargins'),
        }
    except Exception as e:
        print(f"Yahoo Finance detailed data error for {symbol}: {e}")
        return {}

# Routes

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "Portfolio Tracker API is running"}


@app.post("/auth/register")
async def register_user(payload: RegisterRequest):
    """Register a new user and return a JWT token."""
    email = payload.email.strip().lower()
    password = payload.password

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Email already registered")

        password_hash = hash_password(password)
        cur.execute(
            "INSERT INTO users (email, password_hash) VALUES (%s, %s) RETURNING id, email",
            (email, password_hash),
        )
        user = cur.fetchone()
        conn.commit()

        token = create_access_token(user["id"], user["email"])
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user["id"], "email": user["email"]},
        }
    finally:
        cur.close()
        conn.close()


@app.post("/auth/login")
async def login_user(payload: LoginRequest):
    """Authenticate user and return a JWT token."""
    email = payload.email.strip().lower()

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, email, password_hash FROM users WHERE email = %s", (email,))
        user = cur.fetchone()

        if not user or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token(user["id"], user["email"])
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {"id": user["id"], "email": user["email"]},
        }
    finally:
        cur.close()
        conn.close()

@app.post("/upload")
async def upload_portfolio(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    """Upload and process portfolio CSV"""
    try:
        if not file.filename.endswith('.csv'):
            raise HTTPException(status_code=400, detail="Only CSV files are allowed")
        
        # Read CSV file
        contents = await file.read()
        csv_reader = csv.DictReader(io.StringIO(contents.decode('utf-8')))
        
        # Parse CSV rows first
        rows_to_process = []
        for row in csv_reader:
            company_key = row.get('company_name') or row.get('symbol')
            try:
                quantity = int(row.get('quantity', 0))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Quantity must be a valid integer")

            try:
                buy_price = float(row.get('buy_price', 0))
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Buy price must be a valid number")
            
            if not company_key or quantity <= 0 or buy_price <= 0:
                raise HTTPException(
                    status_code=400,
                    detail="CSV must have company_name (or symbol), quantity, and buy_price columns with positive values"
                )
            
            # Get symbol
            symbol = row.get('symbol')
            if row.get('company_name'):
                symbol = get_symbol_from_company_name(row['company_name'])
                if not symbol:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Company '{row['company_name']}' not found in database"
                    )
            
            rows_to_process.append((company_key, symbol, quantity, buy_price))
        
        # Process all stocks in parallel using ThreadPoolExecutor
        portfolio_data = []
        total_value = 0
        total_invested = 0
        
        with ThreadPoolExecutor(max_workers=8) as executor:
            # Submit all fetch jobs
            futures = {
                executor.submit(fetch_stock_data_for_upload, company_key, symbol, quantity, buy_price): idx
                for idx, (company_key, symbol, quantity, buy_price) in enumerate(rows_to_process)
            }
            
            # Collect results as they complete
            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result is None:
                        raise HTTPException(
                            status_code=400,
                            detail=f"No price data available for {rows_to_process[futures[future]][1]}"
                        )
                    portfolio_data.append(result)
                    total_value += result['current_value']
                    total_invested += result['invested_value']
                except Exception as e:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Error processing stock: {str(e)}"
                    )
        
        # Calculate percentages
        for item in portfolio_data:
            item['percentage_of_portfolio'] = (item['current_value'] / total_value * 100) if total_value > 0 else 0
        
        conn = get_db_connection()
        cur = conn.cursor()
        try:
            cur.execute("DELETE FROM user_holdings WHERE user_id = %s", (current_user['id'],))
            for holding in portfolio_data:
                cur.execute(
                    """
                    INSERT INTO user_holdings (user_id, company_name, symbol, quantity, buy_price)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (user_id, symbol)
                    DO UPDATE SET
                        company_name = EXCLUDED.company_name,
                        quantity = EXCLUDED.quantity,
                        buy_price = EXCLUDED.buy_price,
                        updated_at = NOW()
                    """,
                    (
                        current_user['id'],
                        holding['company_name'],
                        holding['symbol'],
                        holding['quantity'],
                        holding['buy_price'],
                    ),
                )
            conn.commit()
        finally:
            cur.close()
            conn.close()

        total_pnl = total_value - total_invested

        return {
            'total_portfolio_value': total_value,
            'total_invested_value': total_invested,
            'total_pnl': total_pnl,
            'total_pnl_percentage': (total_pnl / total_invested * 100) if total_invested > 0 else 0,
            'total_holdings': len(portfolio_data),
            'number_of_companies': len(portfolio_data),
            'holdings': portfolio_data,
            'last_updated': datetime.now().isoformat(),
            'user_id': current_user['id'],
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")

@app.get("/company-details/{symbol}")
async def get_company_details(symbol: str):
    """Get detailed company information with caching"""
    cache_key = f"company_details_{symbol}"
    
    # Check cache first
    cached_result = get_cached_data(cache_key, DETAILS_CACHE_DURATION)
    if cached_result:
        return cached_result
    
    try:
        print(f"Fetching company details for {symbol}...")
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get stock info from database
        cur.execute(
            """SELECT symbol, company_name, sector, industry, market_cap, current_price 
               FROM stock_info WHERE symbol = %s LIMIT 1""",
            (symbol,)
        )
        stock_result = cur.fetchone()
        
        if not stock_result:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found in database")
        
        stock_info = dict(stock_result)
        
        # Fetch real-time data from Yahoo Finance
        yahoo_data = get_yahoo_finance_data(symbol)
        
        # Merge real-time data with database data
        if yahoo_data:
            stock_info['current_price'] = yahoo_data.get('currentPrice') or stock_info.get('current_price')
            stock_info['market_cap'] = yahoo_data.get('marketCap') or stock_info.get('market_cap')
            stock_info['sector'] = yahoo_data.get('sector') or stock_info.get('sector')
            stock_info['industry'] = yahoo_data.get('industry') or stock_info.get('industry')
            stock_info['fifty_two_week_high'] = yahoo_data.get('fiftyTwoWeekHigh')
            stock_info['fifty_two_week_low'] = yahoo_data.get('fiftyTwoWeekLow')
            stock_info['beta'] = yahoo_data.get('beta')
        
        # Get income statement
        cur.execute(
            """SELECT date, total_revenue, cost_of_revenue, gross_profit, operating_income, 
                      net_income, ebitda, basic_eps, diluted_eps
               FROM income_statement WHERE symbol = %s ORDER BY date DESC LIMIT 1""",
            (symbol,)
        )
        income_statement = cur.fetchall()
        
        # Get cash flow
        cur.execute(
            """SELECT date, operating_cash_flow, investing_cash_flow, financing_cash_flow,
                      free_cash_flow, capital_expenditure, dividends_paid
               FROM cash_flow WHERE symbol = %s ORDER BY date DESC LIMIT 1""",
            (symbol,)
        )
        cash_flow = cur.fetchall()
        
        # Get financial ratios
        cur.execute(
            """SELECT date, roe, roa, gross_profit_margin, operating_profit_margin, net_profit_margin,
                      current_ratio, quick_ratio, cash_ratio, debt_to_equity, debt_to_assets,
                      interest_coverage, pe_ratio, pb_ratio, ps_ratio, ev_to_ebitda,
                      free_cash_flow_yield, dividend_yield, payout_ratio,
                      vqm_score, quality_score, momentum_score, value_score
               FROM financial_ratios WHERE symbol = %s ORDER BY date DESC LIMIT 1""",
            (symbol,)
        )
        ratios_result = cur.fetchall()
        
        cur.close()
        conn.close()
        
        # Merge real-time ratios with database ratios
        financial_ratios = []
        if ratios_result:
            ratios = dict(ratios_result[0])
            
            # Update with real-time data from Yahoo Finance
            if yahoo_data:
                ratios['pe_ratio'] = yahoo_data.get('peRatio') or ratios.get('pe_ratio')
                ratios['pb_ratio'] = yahoo_data.get('pbRatio') or ratios.get('pb_ratio')
                if yahoo_data.get('returnOnEquity'):
                    ratios['roe'] = yahoo_data['returnOnEquity'] * 100
                if yahoo_data.get('returnOnAssets'):
                    ratios['roa'] = yahoo_data['returnOnAssets'] * 100
                ratios['debt_to_equity'] = yahoo_data.get('debtToEquity') or ratios.get('debt_to_equity')
                ratios['current_ratio'] = yahoo_data.get('currentRatio') or ratios.get('current_ratio')
                ratios['quick_ratio'] = yahoo_data.get('quickRatio') or ratios.get('quick_ratio')
                if yahoo_data.get('grossMargins'):
                    ratios['gross_profit_margin'] = yahoo_data['grossMargins'] * 100
                if yahoo_data.get('operatingMargins'):
                    ratios['operating_profit_margin'] = yahoo_data['operatingMargins'] * 100
                if yahoo_data.get('profitMargins'):
                    ratios['net_profit_margin'] = yahoo_data['profitMargins'] * 100
                if yahoo_data.get('dividendYield'):
                    ratios['dividend_yield'] = yahoo_data['dividendYield'] * 100
            
            financial_ratios = [ratios]
        elif yahoo_data:
            # Fallback: If no database ratios exist, create them from Yahoo Finance data
            ratios = {
                'date': datetime.now().date(),
                'pe_ratio': yahoo_data.get('peRatio'),
                'pb_ratio': yahoo_data.get('pbRatio'),
                'roe': yahoo_data['returnOnEquity'] * 100 if yahoo_data.get('returnOnEquity') else None,
                'roa': yahoo_data['returnOnAssets'] * 100 if yahoo_data.get('returnOnAssets') else None,
                'debt_to_equity': yahoo_data.get('debtToEquity'),
                'current_ratio': yahoo_data.get('currentRatio'),
                'quick_ratio': yahoo_data.get('quickRatio'),
                'gross_profit_margin': yahoo_data['grossMargins'] * 100 if yahoo_data.get('grossMargins') else None,
                'operating_profit_margin': yahoo_data['operatingMargins'] * 100 if yahoo_data.get('operatingMargins') else None,
                'net_profit_margin': yahoo_data['profitMargins'] * 100 if yahoo_data.get('profitMargins') else None,
                'dividend_yield': yahoo_data['dividendYield'] * 100 if yahoo_data.get('dividendYield') else None,
            }
            # Remove None values
            ratios = {k: v for k, v in ratios.items() if v is not None}
            if ratios:  # Only add if we have at least some data
                financial_ratios = [ratios]
        
        result = {
            'stock_info': stock_info,
            'income_statement': [dict(row) for row in income_statement],
            'cash_flow': [dict(row) for row in cash_flow],
            'financial_ratios': financial_ratios,
        }
        
        # Cache the result
        set_cached_data(cache_key, result)
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching company details: {e}")
        raise HTTPException(status_code=500, detail=f"Error fetching company details: {str(e)}")

@app.get("/recommendation/{symbol}")
async def get_stock_recommendation(symbol: str):
    """Get stock recommendation based on Yahoo Finance data with caching"""
    cache_key = f"recommendation_{symbol}"
    
    # Check cache first
    cached_result = get_cached_data(cache_key, RECOMMENDATION_CACHE_DURATION)
    if cached_result:
        return cached_result
    
    try:
        print(f"Fetching recommendation for {symbol}...")
        ticker = yf.Ticker(f"{symbol}.NS")
        info = ticker.info
        
        target_price = info.get('targetMeanPrice')
        current_price = info.get('currentPrice') or info.get('regularMarketPrice')
        recommendation_key = info.get('recommendationKey')
        
        recommendation = "Hold"
        upside_potential = None
        
        # Use Yahoo's recommendation if available
        if recommendation_key:
            key = recommendation_key.upper()
            if 'BUY' in key:
                recommendation = 'Buy'
            elif 'SELL' in key:
                recommendation = 'Sell'
            else:
                recommendation = 'Hold'
        
        if target_price and current_price and current_price > 0:
            upside = ((target_price - current_price) / current_price) * 100
            upside_potential = round(upside, 1)
            
            # Override if no Yahoo recommendation
            if not recommendation_key:
                if upside > 15:
                    recommendation = "Buy"
                elif upside < -10:
                    recommendation = "Sell"
        
        result = {
            'symbol': symbol,
            'recommendation': recommendation,
            'upside_potential': f"{upside_potential}%" if upside_potential else None,
            'target_price': target_price,
            'current_price': current_price,
        }
        
        # Cache the result
        set_cached_data(cache_key, result)
        
        return result
    
    except Exception as e:
        print(f"Error fetching recommendation: {e}")
        return {
            'symbol': symbol,
            'recommendation': 'Hold',
            'error': str(e),
        }


@app.get("/sentiment/{symbol}")
async def get_stock_sentiment(symbol: str):
    """Get real-time stock sentiment from Yahoo news using VADER model."""
    cache_key = f"sentiment_v2_{symbol}"

    cached_result = get_cached_data(cache_key, SENTIMENT_CACHE_DURATION)
    if cached_result:
        return cached_result

    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        raw_news = ticker.news or []

        if not raw_news:
            result = {
                'symbol': symbol,
                'model': 'VADER',
                'label': 'Neutral',
                'signal': 'HOLD',
                'score': 0.0,
                'confidence': 0.0,
                'articles_count': 0,
                'articles': [],
                'updated_at': datetime.utcnow().isoformat(),
            }
            set_cached_data(cache_key, result)
            return result

        weighted_sum = 0.0
        total_weight = 0.0
        articles = []

        sorted_news = sorted(
            raw_news,
            key=lambda item: (
                parse_published_unix(
                    extract_news_published_at(item, item.get('content') or {})
                )
                or 0.0
            ),
            reverse=True,
        )

        for item in sorted_news[:12]:
            content = item.get('content') or {}

            title = (item.get('title') or content.get('title') or '').strip()
            summary = (
                item.get('summary')
                or item.get('description')
                or content.get('summary')
                or content.get('description')
                or ''
            ).strip()
            text = f"{title}. {summary}".strip()

            if not text:
                continue

            score = sentiment_analyzer.polarity_scores(text)['compound']
            published_at = extract_news_published_at(item, content)
            weight = sentiment_weight(published_at)
            weighted_sum += score * weight
            total_weight += weight

            articles.append({
                'title': title,
                'publisher': item.get('publisher') or (content.get('provider') or {}).get('displayName'),
                'link': (
                    item.get('link')
                    or ((item.get('canonicalUrl') or {}).get('url'))
                    or ((content.get('canonicalUrl') or {}).get('url'))
                    or ((content.get('clickThroughUrl') or {}).get('url'))
                ),
                'published_at': published_at,
                'score': round(score, 4),
                'label': sentiment_label(score),
            })

        articles.sort(
            key=lambda article: parse_published_unix(article.get('published_at')) or 0.0,
            reverse=True,
        )

        final_score = (weighted_sum / total_weight) if total_weight > 0 else 0.0
        confidence = min(1.0, abs(final_score) * 1.6)
        signal = sentiment_signal(final_score, confidence)

        result = {
            'symbol': symbol,
            'model': 'VADER',
            'label': sentiment_label(final_score),
            'signal': signal,
            'score': round(final_score, 4),
            'confidence': round(confidence, 4),
            'articles_count': len(articles),
            'articles': articles,
            'updated_at': datetime.utcnow().isoformat(),
        }

        set_cached_data(cache_key, result)
        return result

    except Exception as e:
        print(f"Sentiment fetch error for {symbol}: {e}")
        return {
            'symbol': symbol,
            'model': 'VADER',
            'label': 'Neutral',
            'signal': 'HOLD',
            'score': 0.0,
            'confidence': 0.0,
            'articles_count': 0,
            'articles': [],
            'error': str(e),
            'updated_at': datetime.utcnow().isoformat(),
        }

@app.get("/stock-chart/{symbol}")
async def get_stock_chart(symbol: str, period: str = "1mo", interval: str = None):
    """
    Get historical stock data for charting with caching
    period: 1d, 5d, 1mo, 6mo, ytd, 1y, 5y, max
    interval: auto-selected based on period if not specified
    """
    cache_key = f"chart_{symbol}_{period}_{interval}"
    
    # Check cache first
    cached_result = get_cached_data(cache_key, CHART_CACHE_DURATION)
    if cached_result:
        return cached_result
    
    try:
        print(f"Fetching chart for {symbol} ({period})...")
        ticker = yf.Ticker(f"{symbol}.NS")
        
        # Auto-select interval based on period if not specified
        if not interval:
            if period == "1d":
                interval = "5m"
            elif period in ["5d", "1mo"]:
                interval = "1h"
            elif period in ["6mo", "ytd"]:
                interval = "1d"
            else:  # 1y, 5y, max
                interval = "1d"
        
        # Fetch OHLCV data
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"No data found for {symbol}")
        
        chart_data = []
        for index, row in hist.iterrows():
            chart_data.append({
                "date": index.strftime("%Y-%m-%d %H:%M:%S") if interval in ["1m", "5m", "15m", "30m", "1h"] else index.strftime("%Y-%m-%d"),
                "timestamp": int(index.timestamp() * 1000),  # Unix timestamp in milliseconds
                "open": round(float(row['Open']), 2),
                "high": round(float(row['High']), 2),
                "low": round(float(row['Low']), 2),
                "close": round(float(row['Close']), 2),
                "volume": int(row['Volume'])
            })
        
        result = {
            "success": True,
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "data": chart_data
        }
        
        # Cache the result
        set_cached_data(cache_key, result)
        
        return result
    
    except Exception as e:
        print(f"Error fetching stock chart: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch chart data: {str(e)}")

@app.get("/live-quote/{symbol}")
async def get_live_quote(symbol: str):
    """Get live quote from Yahoo Finance with intraday high/low"""
    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        data = ticker.history(period="1d")
        info = ticker.info
        
        if data.empty:
            raise HTTPException(status_code=404, detail="Quote data not found")
        
        latest = data.iloc[-1]
        
        return {
            'symbol': symbol,
            'ltp': float(latest['Close']) if 'Close' in latest else None,
            'open': float(latest['Open']) if 'Open' in latest else None,
            'high': float(latest['High']) if 'High' in latest else None,  # Day high
            'low': float(latest['Low']) if 'Low' in latest else None,  # Day low
            'close': float(latest['Close']) if 'Close' in latest else None,
            'previousClose': float(info.get('previousClose')) if info.get('previousClose') else None,
            'volume': int(latest['Volume']) if 'Volume' in latest else None,
            'fiftyTwoWeekHigh': float(info.get('fiftyTwoWeekHigh')) if info.get('fiftyTwoWeekHigh') else None,
            'fiftyTwoWeekLow': float(info.get('fiftyTwoWeekLow')) if info.get('fiftyTwoWeekLow') else None,
            'marketCap': info.get('marketCap'),
            'timestamp': datetime.now().isoformat(),
            'source': 'yahoo-finance',
        }
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error fetching live quote: {e}")
        
        # Fallback to database
        try:
            conn = get_db_connection()
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                "SELECT current_price FROM stock_info WHERE symbol = %s LIMIT 1",
                (symbol,)
            )
            result = cur.fetchone()
            cur.close()
            conn.close()
            
            if result:
                return {
                    'symbol': symbol,
                    'ltp': float(result['current_price']),
                    'source': 'database',
                    'timestamp': datetime.now().isoformat(),
                }
        except Exception as db_error:
            print(f"Database error: {db_error}")
        
        raise HTTPException(status_code=500, detail="Unable to fetch quote data")

@app.post("/refresh-portfolio")
async def refresh_portfolio(holdings: list):
    """Refresh portfolio values with current stock prices"""
    try:
        updated_holdings = []
        total_value = 0
        total_invested = 0
        
        with ThreadPoolExecutor(max_workers=8) as executor:
            # Submit all fetch jobs
            futures = {
                executor.submit(
                    fetch_stock_data_for_upload,
                    holding['company_name'],
                    holding['symbol'],
                    holding['quantity'],
                    float(holding.get('buy_price', 0) or 0),
                ): idx
                for idx, holding in enumerate(holdings)
            }
            
            # Collect results as they complete
            for future in as_completed(futures):
                try:
                    result = future.result()
                    if result:
                        updated_holdings.append(result)
                        total_value += result['current_value']
                        total_invested += result['invested_value']
                except Exception as e:
                    print(f"Error refreshing stock: {str(e)}")
        
        # Calculate percentages
        for item in updated_holdings:
            item['percentage_of_portfolio'] = (item['current_value'] / total_value * 100) if total_value > 0 else 0
        
        total_pnl = total_value - total_invested

        return {
            'total_portfolio_value': total_value,
            'total_invested_value': total_invested,
            'total_pnl': total_pnl,
            'total_pnl_percentage': (total_pnl / total_invested * 100) if total_invested > 0 else 0,
            'total_holdings': len(updated_holdings),
            'number_of_companies': len(updated_holdings),
            'holdings': updated_holdings,
            'last_updated': datetime.now().isoformat(),
        }
    
    except Exception as e:
        print(f"Refresh error: {e}")
        raise HTTPException(status_code=500, detail=f"Error refreshing portfolio: {str(e)}")


@app.get("/portfolio")
async def get_user_portfolio(current_user: dict = Depends(get_current_user)):
    """Return saved portfolio for the logged-in user from PostgreSQL."""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT company_name, symbol, quantity, buy_price
            FROM user_holdings
            WHERE user_id = %s
            ORDER BY symbol
            """,
            (current_user['id'],),
        )
        raw_holdings = cur.fetchall()
    finally:
        cur.close()
        conn.close()

    if not raw_holdings:
        return {
            'total_portfolio_value': 0,
            'total_invested_value': 0,
            'total_pnl': 0,
            'total_pnl_percentage': 0,
            'total_holdings': 0,
            'number_of_companies': 0,
            'holdings': [],
            'last_updated': datetime.now().isoformat(),
            'user_id': current_user['id'],
        }

    rows_to_process = [
        (
            item['company_name'],
            item['symbol'],
            int(item['quantity']),
            float(item['buy_price']) if item.get('buy_price') else 0,
        )
        for item in raw_holdings
    ]

    portfolio_data = []
    total_value = 0
    total_invested = 0

    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(fetch_stock_data_for_upload, company_name, symbol, quantity, buy_price): idx
            for idx, (company_name, symbol, quantity, buy_price) in enumerate(rows_to_process)
        }

        for future in as_completed(futures):
            result = future.result()
            if result:
                portfolio_data.append(result)
                total_value += result['current_value']
                total_invested += result['invested_value']

    for item in portfolio_data:
        item['percentage_of_portfolio'] = (item['current_value'] / total_value * 100) if total_value > 0 else 0

    total_pnl = total_value - total_invested

    return {
        'total_portfolio_value': total_value,
        'total_invested_value': total_invested,
        'total_pnl': total_pnl,
        'total_pnl_percentage': (total_pnl / total_invested * 100) if total_invested > 0 else 0,
        'total_holdings': len(portfolio_data),
        'number_of_companies': len(portfolio_data),
        'holdings': portfolio_data,
        'last_updated': datetime.now().isoformat(),
        'user_id': current_user['id'],
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
