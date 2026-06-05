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

    first_close = float(df["Close"].iloc[0])
    shares = initial / first_close
    start_shares = shares

    dividends_collected = 0.0
    points = []
    splits = []
    div_history = []      # (timestamp, dividend_per_share) for trailing yield
    closes = []           # raw closes (for split-adjusted valuation)
    split_factors = []    # split factor per row

    for ts, row in df.iterrows():
        close = float(row["Close"])
        split = float(row.get("Stock Splits", 0) or 0)
        div = float(row.get("Dividends", 0) or 0)

        if split and split > 0:
            shares *= split
            splits.append({"t": ts.strftime("%Y-%m-%d"), "ratio": _split_ratio(split)})

        if div and div > 0:
            cash = shares * div
            dividends_collected += cash
            if reinvest and close > 0:
                shares += cash / close
            div_history.append((ts, div))

        # trailing-12-month dividend per share -> dividend yield %
        cutoff = ts - pd.Timedelta(days=365)
        ttm_dps = sum(d for (t, d) in div_history if t > cutoff)
        div_yield = (ttm_dps / close * 100.0) if close > 0 else 0.0

        points.append({
            "t": ts.strftime("%Y-%m-%d"),
            "v": round(shares * close, 2),               # portfolio value (top stats)
            "price": round(close, 2),                     # share price (chart + live bar)
            "shares": round(shares, 4),                   # live share count
            "div_cum": round(dividends_collected, 2),     # total dividends paid to date
            "yield": round(div_yield, 2),                 # trailing dividend yield %
        })
        closes.append(close)
        split_factors.append(split)

    # ----- Company valuation (market cap) per point -----
    # Split-adjust every close to today's share basis, then scale from the
    # current market cap. This tracks the company's value over time (it assumes
    # a roughly constant real share count, i.e. ignores buybacks / new issuance).
    n = len(points)
    if market_cap_now and n:
        fut = 1.0
        adj = [0.0] * n
        for i in range(n - 1, -1, -1):
            adj[i] = (closes[i] / fut) if fut else closes[i]
            if split_factors[i] and split_factors[i] > 0:
                fut *= split_factors[i]
        adj_last = adj[-1] or closes[-1]
        if adj_last:
            for i in range(n):
                points[i]["mktcap"] = round(market_cap_now * adj[i] / adj_last, 2)

    last_close = float(df["Close"].iloc[-1])
    final_value = shares * last_close

    first_date = df.index[0]
    last_date = df.index[-1]
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
        "start_date": first_date.strftime("%Y-%m-%d"),
        "end_date": last_date.strftime("%Y-%m-%d"),
        "first_close": round(first_close, 2),
        "last_close": round(last_close, 2),
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
