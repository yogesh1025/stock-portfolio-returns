# Portfolio Compounding in Action

An animated web app that shows how a one-time investment in a stock would have grown from its IPO to today. Enter a ticker and a starting amount, hit play, and watch the share price, portfolio value, dividends, and company valuation grow on a timeline — complete with a 3‑2‑1 countdown, adjustable playback speed, and stock-split markers.

---

## Features

- **IPO-to-today simulation** — invests a chosen amount at the earliest available price and tracks it forward.
- **Animated playback** — a timeline that plays through the full history with Play/Pause, Restart, and a 1×–5× speed slider, kicked off by a 3‑2‑1 countdown.
- **Live stats that grow with the timeline:**
  - Portfolio Growth, Return to date, CAGR, and Years Held
  - Shares Held, Dividends Paid, Dividend Yield, and Company Valuation (market cap)
- **Dividend reinvestment (DRIP)** toggle.
- **Stock-split markers** drawn on the chart at the dates they occurred.
- **Stepped dividend yield** — the displayed yield only changes when a dividend is actually paid and holds flat in between, rather than drifting with the share price.
- **Selectable currency symbol** — Dollar, Euro, INR, Pound, or Yen (display symbol only; see note below).
- **Custom company name** — shown in the headline and the chart label, with the ticker as a fallback.
- **Auto-fitting headline** that shrinks to stay on a single line, and a fixed 16:9 hero layout suited for screen recording.

---

## How it works

The front-end (a single `index.html` template) collects the inputs and `POST`s them to a backend endpoint, `/api/simulate`. The backend fetches the stock's price history (and dividends, splits, and market-cap data), runs the investment simulation, and returns a JSON payload. The front-end then renders the chart with [Chart.js](https://www.chartjs.org/) and animates through the returned data points.

### Tech stack

- **Backend:** Python / Flask (serves the template and the `/api/simulate` API)
- **Frontend:** Vanilla HTML/CSS/JS, [Chart.js 4](https://www.chartjs.org/) (via CDN)
- **Fonts:** Fraunces, IBM Plex Sans, IBM Plex Mono (via Google Fonts)
- **Data source:** historical price / dividend / split data *(confirm and fill in your provider, e.g. yfinance / Alpha Vantage)*

---

## Project structure

```
portfolio-app/
├── templates/
│   └── index.html        # the entire front-end (UI, chart, animation)
├── app.py                # Flask app + /api/simulate endpoint   (adjust to your filename)
├── requirements.txt
└── README.md
```

---

## Getting started

### Prerequisites

- Python 3.9+
- A data source for stock history *(see note in Tech stack)*

### Installation

```bash
# clone
git clone https://github.com/<your-username>/portfolio-app.git
cd portfolio-app

# (recommended) virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# install dependencies
pip install -r requirements.txt
```

### Run

```bash
flask run
# or, if you run the file directly:
python app.py
```

Then open the URL Flask prints (typically `http://127.0.0.1:5000`).

---

## Usage

1. Open the menu (☰ top-left).
2. Enter a **stock ticker** (e.g. `AAPL`).
3. Optionally set a **company name** (shown in the headline and chart label).
4. Set the **initial investment** and choose whether to **reinvest dividends**.
5. Pick a **currency symbol**.
6. Click **Run simulation**, then use the **Playback** controls to play, pause, restart, and change speed.

---

## Configuration

- **Animation duration:** controlled by `SEC_PER_YEAR` in `index.html` (default `15`) — the number of seconds each simulated year takes at 1× speed.
- **Theme colors:** CSS variables in the `:root` block (`--accent`, `--gold`, `--bg`, etc.).

---

## Notes & limitations

- **Currency symbol is cosmetic.** Selecting a currency only changes the displayed symbol; it does **not** convert the underlying values, which are returned by the backend in its source currency.
- **Stepped dividend yield** is computed on the front-end from the per-point `yield` and `div_cum` values. It holds the last paid yield between payments, so its accuracy depends on the backend providing those fields correctly.
- This app is for **educational/illustrative purposes only** and is **not financial advice**. Past performance does not indicate future results.

---

## License

Add your license here (e.g. MIT). Create a `LICENSE` file to match.
