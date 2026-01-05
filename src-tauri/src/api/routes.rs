//! API route definitions

use axum::{
    extract::Request,
    http::{header, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Router,
};
use tower_http::cors::{Any, CorsLayer};

use super::handlers;
use super::ApiState;

/// Create the main router with all routes
pub fn create_router(state: ApiState, token: Option<String>) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let mut router = Router::new()
        .route("/health", get(handlers::health))
        .route("/status", get(handlers::status))
        .route("/status/{account_id}", get(handlers::status_by_account))
        .route("/accounts", get(handlers::accounts))
        .route("/history", get(handlers::history))
        .route("/refresh", post(handlers::refresh))
        .layer(cors)
        .with_state(state);

    // Add auth middleware if token is configured
    if let Some(token) = token {
        router = router.layer(middleware::from_fn(move |req, next| {
            let token = token.clone();
            auth_middleware(req, next, token)
        }));
    }

    router
}

/// Authentication middleware
///
/// Validates the Bearer token in the Authorization header.
/// Skips auth for the /health endpoint.
async fn auth_middleware(req: Request, next: Next, expected_token: String) -> Result<Response, StatusCode> {
    // Skip auth for health endpoint
    if req.uri().path() == "/health" {
        return Ok(next.run(req).await);
    }

    // Check Authorization header
    let auth_header = req
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    match auth_header {
        Some(header) if header.starts_with("Bearer ") => {
            let token = header.trim_start_matches("Bearer ").trim();
            if token == expected_token {
                Ok(next.run(req).await)
            } else {
                Err(StatusCode::UNAUTHORIZED)
            }
        }
        _ => Err(StatusCode::UNAUTHORIZED),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cors_layer_is_permissive() {
        // CORS should allow any origin for localhost API
        let _cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);
    }
}
