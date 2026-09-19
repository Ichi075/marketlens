use futures::{stream, StreamExt};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Bar {
    timestamp: i64,
    close: f64,
    volume: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MarketData {
    symbol: String,
    price: Option<f64>,
    previous_close: Option<f64>,
    currency: Option<String>,
    bars: Vec<Bar>,
    error: Option<String>,
}

fn number(value: &Value) -> Option<f64> {
    value.as_f64().filter(|n| n.is_finite() && *n > 0.0)
}

async fn fetch_symbol(client: reqwest::Client, symbol: String) -> MarketData {
    let mut data = MarketData {
        symbol: symbol.clone(),
        price: None,
        previous_close: None,
        currency: None,
        bars: Vec::new(),
        error: None,
    };

    if symbol.is_empty()
        || symbol.len() > 15
        || !symbol.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-')
    {
        data.error = Some("Invalid ticker".into());
        return data;
    }

    let url = format!(
        "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1m&range=1d&includePrePost=true"
    );
    let response = match client.get(url).send().await {
        Ok(response) => response,
        Err(_) => {
            data.error = Some("Quote service unavailable".into());
            return data;
        }
    };
    if !response.status().is_success() {
        data.error = Some(format!("Quote service returned {}", response.status()));
        return data;
    }
    let payload: Value = match response.json().await {
        Ok(payload) => payload,
        Err(_) => {
            data.error = Some("Invalid quote response".into());
            return data;
        }
    };
    let Some(result) = payload["chart"]["result"].get(0) else {
        data.error = Some("Ticker data unavailable".into());
        return data;
    };
    let meta = &result["meta"];
    data.previous_close = number(&meta["chartPreviousClose"])
        .or_else(|| number(&meta["previousClose"]));
    data.currency = meta["currency"].as_str().map(str::to_owned);

    let times = result["timestamp"].as_array();
    let closes = result["indicators"]["quote"][0]["close"].as_array();
    let volumes = result["indicators"]["quote"][0]["volume"].as_array();
    if let (Some(times), Some(closes)) = (times, closes) {
        for (i, time) in times.iter().enumerate() {
            if let (Some(timestamp), Some(close)) = (
                time.as_i64(),
                closes.get(i).and_then(number),
            ) {
                let volume = volumes
                    .and_then(|v| v.get(i))
                    .and_then(Value::as_f64)
                    .unwrap_or(0.0)
                    .max(0.0);
                data.bars.push(Bar { timestamp, close, volume });
            }
        }
    }
    data.price = data.bars.last().map(|bar| bar.close)
        .or_else(|| number(&meta["regularMarketPrice"]));
    if data.price.is_none() || data.previous_close.is_none() {
        data.error = Some("Incomplete quote data".into());
    }
    data
}

#[tauri::command]
async fn get_market_data(symbols: Vec<String>) -> Result<Vec<MarketData>, String> {
    if symbols.len() > 30 {
        return Err("Too many tickers".into());
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent("Mozilla/5.0 MarketLens/0.1")
        .build()
        .map_err(|_| "Could not initialize quote client".to_string())?;
    let results = stream::iter(symbols.into_iter().map(|symbol| {
        let client = client.clone();
        async move { fetch_symbol(client, symbol).await }
    }))
    .buffered(5)
    .collect::<Vec<_>>()
    .await;
    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_market_data])
        .run(tauri::generate_context!())
        .expect("error while running MarketLens");
}
