// Gatrix Edge Rust - IP Filter Middleware
// IP allow/deny list with CIDR support

use std::net::IpAddr;
use actix_web::dev::{Service, ServiceRequest, ServiceResponse, Transform};
use actix_web::HttpResponse;
use futures_util::future::{ok, Either, Ready};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};

/// CIDR network range
#[derive(Clone, Debug)]
pub struct CidrRange {
  addr: IpAddr,
  prefix_len: u8,
}

impl CidrRange {
  /// Parse a CIDR string (e.g., "10.0.0.0/8" or "192.168.1.1")
  pub fn parse(s: &str) -> Option<Self> {
    let s = s.trim();
    if let Some((addr_str, prefix_str)) = s.split_once('/') {
      let addr: IpAddr = addr_str.parse().ok()?;
      let prefix_len: u8 = prefix_str.parse().ok()?;
      Some(Self { addr, prefix_len })
    } else {
      // Single IP, treat as /32 or /128
      let addr: IpAddr = s.parse().ok()?;
      let prefix_len = match addr {
        IpAddr::V4(_) => 32,
        IpAddr::V6(_) => 128,
      };
      Some(Self { addr, prefix_len })
    }
  }

  /// Check if an IP address is within this CIDR range
  pub fn contains(&self, ip: &IpAddr) -> bool {
    match (&self.addr, ip) {
      (IpAddr::V4(net), IpAddr::V4(target)) => {
        let net_bits = u32::from(*net);
        let target_bits = u32::from(*target);
        if self.prefix_len == 0 {
          return true;
        }
        let mask = !0u32 << (32 - self.prefix_len);
        (net_bits & mask) == (target_bits & mask)
      }
      (IpAddr::V6(net), IpAddr::V6(target)) => {
        let net_bits = u128::from(*net);
        let target_bits = u128::from(*target);
        if self.prefix_len == 0 {
          return true;
        }
        let mask = !0u128 << (128 - self.prefix_len);
        (net_bits & mask) == (target_bits & mask)
      }
      _ => false, // Mixed v4/v6, no match
    }
  }
}

/// Parse comma-separated CIDR list
pub fn parse_cidr_list(s: &str) -> Vec<CidrRange> {
  s.split(',')
    .filter_map(|part| CidrRange::parse(part.trim()))
    .collect()
}

/// IP filter middleware
#[derive(Clone)]
pub struct IpFilter {
  allow_list: Vec<CidrRange>,
  deny_list: Vec<CidrRange>,
}

impl IpFilter {
  pub fn new(allow_list: Vec<CidrRange>, deny_list: Vec<CidrRange>) -> Self {
    Self { allow_list, deny_list }
  }
}

impl<S, B> Transform<S, ServiceRequest> for IpFilter
where
  S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = actix_web::Error> + 'static,
  B: 'static,
{
  type Response = ServiceResponse<actix_web::body::EitherBody<B>>;
  type Error = actix_web::Error;
  type Transform = IpFilterMiddleware<S>;
  type InitError = ();
  type Future = Ready<Result<Self::Transform, Self::InitError>>;

  fn new_transform(&self, service: S) -> Self::Future {
    ok(IpFilterMiddleware {
      service,
      allow_list: self.allow_list.clone(),
      deny_list: self.deny_list.clone(),
    })
  }
}

pub struct IpFilterMiddleware<S> {
  service: S,
  allow_list: Vec<CidrRange>,
  deny_list: Vec<CidrRange>,
}

impl<S, B> Service<ServiceRequest> for IpFilterMiddleware<S>
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
    let client_ip_str = req
      .connection_info()
      .realip_remote_addr()
      .unwrap_or("127.0.0.1")
      .to_string();

    // Strip port from IP if present (e.g., "127.0.0.1:12345")
    let ip_only = client_ip_str
      .rsplit_once(':')
      .map(|(ip, _port)| ip)
      .unwrap_or(&client_ip_str);

    let client_ip: Option<IpAddr> = ip_only.parse().ok();

    if let Some(ip) = client_ip {
      // Check deny list first
      if !self.deny_list.is_empty() && self.deny_list.iter().any(|cidr| cidr.contains(&ip)) {
        log::warn!("IP denied by deny list: {}", ip);
        let response = HttpResponse::Forbidden().json(serde_json::json!({
          "success": false,
          "error": {
            "code": "FORBIDDEN",
            "message": "Access denied"
          }
        }));
        return Either::Right(ok(req.into_response(response).map_into_right_body()));
      }

      // Check allow list
      if !self.allow_list.is_empty() && !self.allow_list.iter().any(|cidr| cidr.contains(&ip)) {
        log::warn!("IP not in allow list: {}", ip);
        let response = HttpResponse::Forbidden().json(serde_json::json!({
          "success": false,
          "error": {
            "code": "FORBIDDEN",
            "message": "Access denied"
          }
        }));
        return Either::Right(ok(req.into_response(response).map_into_right_body()));
      }
    }

    let fut = self.service.call(req);
    Either::Left(Box::pin(async move {
      let res = fut.await?;
      Ok(res.map_into_left_body())
    }))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_cidr_parse() {
    let cidr = CidrRange::parse("10.0.0.0/8").unwrap();
    assert!(cidr.contains(&"10.1.2.3".parse().unwrap()));
    assert!(cidr.contains(&"10.255.255.255".parse().unwrap()));
    assert!(!cidr.contains(&"11.0.0.1".parse().unwrap()));
  }

  #[test]
  fn test_single_ip() {
    let cidr = CidrRange::parse("192.168.1.1").unwrap();
    assert!(cidr.contains(&"192.168.1.1".parse().unwrap()));
    assert!(!cidr.contains(&"192.168.1.2".parse().unwrap()));
  }

  #[test]
  fn test_cidr_list_parse() {
    let list = parse_cidr_list("10.0.0.0/8, 192.168.0.0/16, 172.16.0.1");
    assert_eq!(list.len(), 3);
  }
}
