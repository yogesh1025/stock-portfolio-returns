import math
from fractions import Fraction

import pandas as pd
import yfinance as yf
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)


def _split_ratio(factor: float) -> str:
    """Turn a yfinance split factor (e.g. 2.0, 7.0, 0.1) into '2:1', '7:1', '1:10'."""
    frac = Fraction(factor).limit_denominator(1000)
    return f"{frac.numerator}:{frac.denominator}"


def simulate(df: pd.DataFrame, initial: float, reinvest: bool, market_cap_now=None):
    df = df[df["Close"].notna() & (df["Close"] > 0)].copy()
    if df.empty:
        raise ValueError("No usable price data for this ticker.")

    timestamps = list(df.index)
    dates = [ts.strftime("%Y-%m-%d") for ts in timestamps]
    # Yahoo's "Close" (even with auto_adjust=False) is SPLIT-ADJUSTED, not raw.
    sclose = [float(c) for c in df["Close"].tolist()]
    split_f = [float(s or 0) for s in df["Stock Splits"].tolist()]
    div_raw = [float(d or 0) for d in df["Dividends"].tolist()]
    n = len(sclose)

    # ----- Reverse Yahoo's split adjustment to recover ORIGINAL nominal prices -----
    # nominal[i] = split_adjusted_close[i] * (product of every split AFTER date i)
    future_prod = [1.0] * n
    fut = 1.0
    for i in range(n - 1, -1, -1):
        future_prod[i] = fut
        if split_f[i] > 0:
            fut *= split_f[i]

    price = [sclose[i] * future_prod[i] for i in range(n)]      # true original share price
    div_nom = [div_raw[i] * future_prod[i] for i in range(n)]   # dividend per share, same basis

    first_price = price[0]
    shares = initial / first_price
    start_shares = shares

    dividends_collected = 0.0
    points = []
    splits = []
    div_history = []  # (timestamp, nominal_dividend_per_share) for trailing yield

    for i in range(n):
        ts = timestamps[i]
        p = price[i]

        if split_f[i] > 0:
            shares *= split_f[i]      # original-price basis: price halves, share count grows
            splits.append({"t": dates[i], "ratio": _split_ratio(split_f[i])})

        if div_nom[i] > 0:
            cash = shares * div_nom[i]
            dividends_collected += cash
            if reinvest and p > 0:
                shares += cash / p
            div_history.append((ts, div_nom[i]))

        # trailing-12-month dividend per share -> dividend yield %
        cutoff = ts - pd.Timedelta(days=365)
        ttm_dps = sum(d for (t, d) in div_history if t > cutoff)
        div_yield = (ttm_dps / p * 100.0) if p > 0 else 0.0

        pt = {
            "t": dates[i],
            "v": round(shares * p, 2),               # portfolio value (top stats)
            "price": round(p, 2),                     # ORIGINAL share price (chart + live bar)
            "shares": round(shares, 4),               # live share count
            "div_cum": round(dividends_collected, 2), # total dividends paid to date
            "yield": round(div_yield, 2),             # trailing dividend yield %
        }
        # Company valuation scales with the split-adjusted (smooth) price, anchored
        # to today's market cap. Market cap is split-invariant, so it stays smooth.
        if market_cap_now and sclose[-1]:
            pt["mktcap"] = round(market_cap_now * sclose[i] / sclose[-1], 2)
        points.append(pt)

    last_price = price[-1]
    final_value = shares * last_price

    first_date = timestamps[0]
    last_date = timestamps[-1]
    years = max((last_date - first_date).days / 365.25, 1e-9)

    total_return_pct = (final_value / initial - 1.0) * 100.0
    cagr_pct = ((final_value / initial) ** (1.0 / years) - 1.0) * 100.0 if initial > 0 else 0.0

    summary = {
        "initial": round(initial, 2),
        "final_value": round(final_value, 2),
        "total_return_pct": round(total_return_pct, 2),
        "cagr_pct": round(cagr_pct, 2),
        "years": round(years, 2),
        "start_shares": round(start_shares, 4),
        "final_shares": round(shares, 4),
        "dividends_collected": round(dividends_collected, 2),
        "start_date": dates[0],
        "end_date": dates[-1],
        "first_close": round(first_price, 2),
        "last_close": round(last_price, 2),
    }
    return points, summary, splits


def downsample(points, max_points=900):
    n = len(points)
    if n <= max_points:
        return points
    step = math.ceil(n / max_points)
    reduced = points[::step]
    if reduced[-1] is not points[-1]:
        reduced.append(points[-1])
    return reduced


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/healthz")
def healthz():
    return jsonify({"ok": True})

@app.route("/api/search")
def search_ticker():
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify([])
    try:
        import requests
        r = requests.get(
            'https://query2.finance.yahoo.com/v1/finance/search',
            params={'q': q, 'quotesCount': 10, 'newsCount': 0, 'enableFuzzyQuery': True},
            headers={'User-Agent': 'Mozilla/5.0'},
            timeout=5
        )
        data = r.json()
        results = []
        for item in data.get('quotes', []):
            sym  = item.get('symbol', '')
            name = item.get('shortname') or item.get('longname', '')
            if sym and name:
                results.append({'symbol': sym, 'name': name})
        return jsonify(results)
    except Exception:
        return jsonify([])


@app.route("/api/simulate", methods=["POST"])
def api_simulate():
    data = request.get_json(force=True, silent=True) or {}
    ticker = str(data.get("ticker", "")).strip().upper()
    reinvest = bool(data.get("reinvest", False))

    try:
        initial = float(data.get("initial", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "Initial investment must be a number."}), 400

    if not ticker:
        return jsonify({"error": "Please enter a stock ticker."}), 400
    if initial <= 0:
        return jsonify({"error": "Initial investment must be greater than 0."}), 400

    try:
        tk = yf.Ticker(ticker)
        # auto_adjust=False keeps dividends out of the price; we reverse Yahoo's
        # split adjustment ourselves in simulate() to get the true original price.
        df = tk.history(period="max", auto_adjust=False)
    except Exception as exc:
        return jsonify({"error": f"Could not fetch data: {exc}"}), 502

    if df is None or df.empty:
        return jsonify({"error": f"No data found for '{ticker}'. Check the ticker symbol."}), 404

    if "Stock Splits" not in df.columns:
        df["Stock Splits"] = 0.0
    if "Dividends" not in df.columns:
        df["Dividends"] = 0.0

    # Company info (name + current market cap) — best effort, used for valuation
    name = ticker
    market_cap_now = None
    try:
        info = tk.info or {}
        info_name = info.get("shortName") or info.get("longName")
        if info_name:
            name = info_name
        market_cap_now = info.get("marketCap")
        if not market_cap_now:
            so = info.get("sharesOutstanding") or info.get("impliedSharesOutstanding")
            if so:
                market_cap_now = float(so) * float(df["Close"].iloc[-1])
    except Exception:
        pass

    try:
        points, summary, splits = simulate(df, initial, reinvest, market_cap_now)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 422

    return jsonify({
        "ticker": ticker,
        "name": name,
        "reinvest": reinvest,
        "summary": summary,
        "points": downsample(points),
        "splits": splits,
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
