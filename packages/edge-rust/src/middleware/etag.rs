// Gatrix Edge Rust - ETag Middleware
// SHA-256 based ETag generation with If-None-Match support for 304 responses

use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::HttpResponse;
use actix_web::body::{BoxBody, MessageBody, EitherBody};
use futures_util::future::{ok, Either, Ready};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

/// ETag middleware factory
#[derive(Clone)]
pub struct ETag;

impl<S, B> Transform<S, ServiceRequest> for ETag
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
  B: MessageBody + 'static,
{
  type Response = ServiceResponse<EitherBody<B, BoxBody>>;
  type Error = actix_web::Error;
  type Transform = ETagMiddleware<S>;
  type InitError = ();
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ok(ETagMiddleware { service })
  }
}

pub struct ETagMiddleware<S> {
  service: S,
}

impl<S, B> Service<ServiceRequest> for ETagMiddleware<S>
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
  B: MessageBody + 'static,
{
  type Response = ServiceResponse<EitherBody<B, BoxBody>>;
  type Error = actix_web::Error;
  type Future = Either<
    Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>>>>,
    Ready<Result<Self::Response, Self::Error>>,
  >;

  fn poll_ready(&self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
    self.service.poll_ready(cx)
  }

  fn call(&self, req: ServiceRequest) -> Self::Future {
    let path = req.path().to_string();
    let method = req.method().clone();

    // Skip ETag for non-GET methods and health endpoints
    if method != actix_web::http::Method::GET
      || path.starts_with("/health")
      || path.starts_with("/internal/health")
    {
      let fut = self.service.call(req);
      return Either::Left(Box::pin(async move {
        let res = fut.await?;
        Ok(res.map_into_left_body())
      }));
    }

    let if_none_match = req
      .headers()
      .get("if-none-match")
      .and_then(|v| v.to_str().ok())
      .map(|s| s.to_string());

    let fut = self.service.call(req);

    Either::Left(Box::pin(async move {
      let res = fut.await?;

      // Only process successful responses
      if !res.status().is_success() {
        return Ok(res.map_into_left_body());
      }

      let (req, response) = res.into_parts();
      let (head, body) = response.into_parts();

      // Collect response body bytes
      let body_bytes = match actix_web::body::to_bytes(body).await {
        Ok(bytes) => bytes,
        Err(_) => {
          let error_response = HttpResponse::InternalServerError().finish();
          return Ok(ServiceResponse::new(req, error_response).map_into_right_body());
        }
      };

      if body_bytes.is_empty() {
        let response = head.set_body(BoxBody::new(body_bytes));
        return Ok(ServiceResponse::new(req, response).map_into_right_body());
      }

      // Generate ETag from body hash
      let hash = simple_hash(&body_bytes);
      let etag = format!("\"{}\"", hash);

      // Check If-None-Match
      if let Some(ref client_etag) = if_none_match {
        if client_etag.trim() == etag || client_etag.trim().trim_matches('"') == hash {
          let mut not_modified = HttpResponse::NotModified().finish();
          not_modified.headers_mut().insert(
            actix_web::http::header::ETAG,
            actix_web::http::header::HeaderValue::from_str(&etag).unwrap(),
          );
          return Ok(ServiceResponse::new(req, not_modified).map_into_right_body());
        }
      }

      // Return response with ETag header
      let mut response = head.set_body(BoxBody::new(body_bytes));
      response.headers_mut().insert(
        actix_web::http::header::ETAG,
        actix_web::http::header::HeaderValue::from_str(&etag).unwrap(),
      );

      Ok(ServiceResponse::new(req, response).map_into_right_body())
    }))
  }
}

/// Simple FNV-1a hash for fast ETag generation
/// Sufficient for ETag purposes (collision detection, not cryptographic)
fn simple_hash(data: &[u8]) -> String {
  let mut hash: u64 = 0xcbf29ce484222325; // FNV offset basis
  for byte in data {
    hash ^= *byte as u64;
    hash = hash.wrapping_mul(0x100000001b3); // FNV prime
  }
  format!("{:016x}", hash)
}
