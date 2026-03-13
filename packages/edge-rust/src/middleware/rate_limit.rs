// Gatrix Edge Rust - Rate Limiting Middleware
// IP-based sliding window rate limiter using actix-web middleware

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;
use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::HttpResponse;
use futures_util::future::{ok, Either, Ready};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

/// Rate limiter configuration
#[derive(Clone)]
pub struct RateLimiter {
  max_rps: u32,
}

impl RateLimiter {
  pub fn new(max_rps: u32) -> Self {
    Self { max_rps }
  }
}

/// Per-IP sliding window entry
struct WindowEntry {
  timestamps: Vec<Instant>,
}

impl WindowEntry {
  fn new() -> Self {
    Self { timestamps: Vec::new() }
  }

  fn count_recent(&mut self, window: std::time::Duration) -> usize {
    let cutoff = Instant::now() - window;
    self.timestamps.retain(|t| *t > cutoff);
    self.timestamps.len()
  }

  fn record(&mut self) {
    self.timestamps.push(Instant::now());
  }
}

/// Shared rate limiter state
struct RateLimiterState {
  entries: Mutex<HashMap<String, WindowEntry>>,
  max_rps: u32,
}

impl<S, B> Transform<S, ServiceRequest> for RateLimiter
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
  B: 'static,
{
  type Response = ServiceResponse<actix_web::body::EitherBody<B>>;
  type Error = actix_web::Error;
  type Transform = RateLimiterMiddleware<S>;
  type InitError = ();
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ok(RateLimiterMiddleware {
      service,
      state: std::sync::Arc::new(RateLimiterState {
        entries: Mutex::new(HashMap::new()),
        max_rps: self.max_rps,
      }),
    })
  }
}

pub struct RateLimiterMiddleware<S> {
  service: S,
  state: std::sync::Arc<RateLimiterState>,
}

impl<S, B> Service<ServiceRequest> for RateLimiterMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
  B: 'static,
{
  type Response = ServiceResponse<actix_web::body::EitherBody<B>>;
  type Error = actix_web::Error;
  type Future = Either<
    Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>,
    Ready<Result<Self::Response, Self::Error>>,
  >;

  fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
    self.service.poll_ready(cx)
  }

  fn call(&self, req: ServiceRequest) -> Self::Future {
    // Pass through when rate limiting is disabled
    if self.state.max_rps == 0 {
      let fut = self.service.call(req);
      return Either::Left(Box::pin(async move {
        let res = fut.await?;
        Ok(res.map_into_left_body())
      }));
    }

    let client_ip = req
      .connection_info()
      .realip_remote_addr()
      .unwrap_or("unknown")
      .to_string();

    let window = std::time::Duration::from_secs(1);
    let mut entries = self.state.entries.lock().unwrap();
    let entry = entries.entry(client_ip).or_insert_with(WindowEntry::new);
    let count = entry.count_recent(window);

    if count >= self.state.max_rps as usize {
      drop(entries);
      let response = HttpResponse::TooManyRequests()
        .insert_header(("Retry-After", "1"))
        .json(serde_json::json!({
          "success": false,
          "error": {
            "code": "RATE_LIMITED",
            "message": "Too many requests. Please try again later."
          }
        }));
      return Either::Right(ok(req.into_response(response).map_into_right_body()));
    }

    entry.record();
    drop(entries);

    let fut = self.service.call(req);
    Either::Left(Box::pin(async move {
      let res = fut.await?;
      Ok(res.map_into_left_body())
    }))
  }
}
