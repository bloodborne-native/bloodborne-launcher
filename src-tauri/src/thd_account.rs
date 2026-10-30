//! Sign-in to The Hunter's Dream: the device-code flow of bbhost (src/net/account.cpp). The launcher
//! asks the account service for a code, opens its /link page, the player approves the code there
//! with Discord, and the launcher polls until the service hands over the online ID and a token.
//! The token is a password: it goes to the settings (`thd_token`) like before and nowhere else, and
//! no message, log line or error here ever contains it.
use std::time::Duration;

use reqwest::Url;
use serde::Serialize;
use serde_json::{json, Value};
use tauri_plugin_opener::OpenerExt;

/// A reply larger than this is not from an account service.
const MAX_REPLY: usize = 16 * 1024;

#[derive(Serialize)]
pub struct SignInStart {
    device_code: String,
    user_code: String,
    verification_uri: String,
    /// Seconds between polls.
    interval: u64,
    /// Seconds until the code expires.
    expires_in: u64,
}

#[derive(Serialize)]
pub struct SignInPoll {
    /// "pending", "slow_down" or "approved"; a denied or expired link is an error.
    status: String,
    online_id: Option<String>,
    token: Option<String>,
}

/// The account service's address: https, a host, no credentials in it.
fn server_url(server: &str) -> Result<Url, String> {
    let url = Url::parse(server.trim()).map_err(|_| "The server address is not valid.".to_string())?;
    if url.scheme() != "https" || url.host_str().is_none() || !url.username().is_empty() || url.password().is_some() {
        return Err("The server address must be an https address.".into());
    }
    Ok(url)
}

/// The page the player approves the code on: it has to be on the account service's own host.
fn verification_url(server: &Url, uri: &str) -> Result<Url, String> {
    let url = Url::parse(uri).map_err(|_| "The server sent an invalid link page.".to_string())?;
    if url.scheme() != "https" || url.host_str() != server.host_str() || !url.username().is_empty() {
        return Err("The server sent a link page on another host.".into());
    }
    Ok(url)
}

/// Every account reply carries ResKind (0 = ok); a refusal explains itself in Message.
fn parse_reply(status: u16, raw: &[u8]) -> Result<Value, String> {
    let reply: Value = serde_json::from_slice(raw)
        .map_err(|_| if (200..300).contains(&status) { "The server sent an invalid reply.".to_string() } else { format!("HTTP {status}") })?;
    let Some(kind) = reply.get("ResKind") else {
        return Err(format!("This server has no account service (HTTP {status})."));
    };
    if kind.as_i64() != Some(0) {
        let message: String = reply.get("Message").and_then(Value::as_str).unwrap_or("The server refused.").chars().take(200).collect();
        return Err(message);
    }
    Ok(reply)
}

async fn call(server: &Url, path: &str, body: Value) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .https_only(true)
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(5))
        .timeout(Duration::from_secs(10))
        .user_agent(concat!("bloodborne-launcher/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let url = server.join(path).map_err(|e| e.to_string())?;
    let response = client
        .post(url)
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .body(serde_json::to_vec(&body).map_err(|e| e.to_string())?)
        .send()
        .await
        .map_err(|e| format!("Could not reach the server: {}", e.without_url()))?;
    let status = response.status().as_u16();
    let raw = response.bytes().await.map_err(|_| "The reply was cut off.".to_string())?;
    if raw.len() > MAX_REPLY {
        return Err("The server sent a reply that is too large.".into());
    }
    parse_reply(status, &raw)
}

fn text(reply: &Value, key: &str) -> String {
    reply.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

/// Asks for a code and opens the page to approve it on. The player reads the code on the screen.
#[tauri::command]
pub async fn thd_sign_in_start(app: tauri::AppHandle, server: String) -> Result<SignInStart, String> {
    let server = server_url(&server)?;
    let reply = call(&server, "/auth/device/start", json!({ "DeviceName": format!("bloodborne-launcher on {}", std::env::consts::OS) })).await?;
    let (device_code, user_code) = (text(&reply, "DeviceCode"), text(&reply, "UserCode"));
    if device_code.is_empty() || device_code.len() > 256 || user_code.is_empty() || user_code.len() > 64 {
        return Err("The server sent no code.".into());
    }
    let page = verification_url(&server, &text(&reply, "VerificationUri"))?;
    let interval = reply.get("Interval").and_then(Value::as_u64).filter(|n| (1..=60).contains(n)).unwrap_or(5);
    let expires_in = reply.get("ExpiresIn").and_then(Value::as_u64).filter(|n| (1..=3600).contains(n)).unwrap_or(600);
    // The code is on the screen as well: a browser that does not open is not an error.
    let _ = app.opener().open_url(page.as_str(), None::<&str>);
    Ok(SignInStart { device_code, user_code, verification_uri: page.into(), interval, expires_in })
}

/// One poll. "denied" and "expired" come back as errors.
#[tauri::command]
pub async fn thd_sign_in_poll(server: String, device_code: String) -> Result<SignInPoll, String> {
    if device_code.is_empty() || device_code.len() > 256 {
        return Err("The sign-in code is missing.".into());
    }
    let reply = call(&server_url(&server)?, "/auth/device/poll", json!({ "DeviceCode": device_code })).await?;
    match text(&reply, "Status").as_str() {
        status @ ("pending" | "slow_down") => Ok(SignInPoll { status: status.into(), online_id: None, token: None }),
        "approved" => {
            let (online_id, token) = (text(&reply, "OnlineId"), text(&reply, "Token"));
            if online_id.is_empty() || token.is_empty() {
                return Err("The server sent no token.".into());
            }
            Ok(SignInPoll { status: "approved".into(), online_id: Some(online_id), token: Some(token) })
        }
        "denied" => Err("The sign-in was denied.".into()),
        "expired" => Err("The sign-in code expired.".into()),
        _ => Err("The server sent an unknown sign-in status.".into()),
    }
}

/// Tells the service to forget the token. False when it could not be reached: the player is signed
/// out here either way.
#[tauri::command]
pub async fn thd_sign_out(server: String, token: String) -> Result<bool, String> {
    let server = server_url(&server)?;
    if token.is_empty() {
        return Ok(true);
    }
    Ok(call(&server, "/auth/logout", json!({ "Token": token })).await.is_ok())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_server_must_be_https_without_credentials() {
        assert!(server_url("https://thehuntersdream.com").is_ok());
        assert!(server_url(" https://thehuntersdream.com/ ").is_ok());
        assert!(server_url("http://thehuntersdream.com").is_err());
        assert!(server_url("https://user:pass@thehuntersdream.com").is_err());
        assert!(server_url("file:///etc/passwd").is_err());
        assert!(server_url("not a url").is_err());
    }

    #[test]
    fn the_link_page_stays_on_the_server_host() {
        let server = server_url("https://thehuntersdream.com").unwrap();
        assert!(verification_url(&server, "https://thehuntersdream.com/link").is_ok());
        assert!(verification_url(&server, "https://evil.example/link").is_err());
        assert!(verification_url(&server, "http://thehuntersdream.com/link").is_err());
        assert!(verification_url(&server, "https://thehuntersdream.com.evil.example/link").is_err());
        assert!(verification_url(&server, "javascript:alert(1)").is_err());
        assert!(verification_url(&server, "").is_err());
    }

    #[test]
    fn replies_are_checked_like_the_game_does() {
        assert!(parse_reply(200, br#"{"ResKind":0,"Status":"pending"}"#).is_ok());
        assert_eq!(parse_reply(429, br#"{"ResKind":3,"Message":"Too many tries"}"#).unwrap_err(), "Too many tries");
        assert_eq!(parse_reply(502, b"<html>").unwrap_err(), "HTTP 502");
        assert_eq!(parse_reply(200, b"<html>").unwrap_err(), "The server sent an invalid reply.");
        assert!(parse_reply(200, br#"{"hello":1}"#).unwrap_err().contains("no account service"));
        let long = format!(r#"{{"ResKind":1,"Message":"{}"}}"#, "x".repeat(500));
        assert_eq!(parse_reply(400, long.as_bytes()).unwrap_err().chars().count(), 200);
    }
}
