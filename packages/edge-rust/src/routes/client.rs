// Gatrix Edge Rust - Client Routes
// Client SDK API endpoints

use std::sync::Arc;
use actix_web::{web, HttpRequest, HttpResponse, Responder};
use log::debug;

use crate::app_state::AppState;
use crate::middleware::client_auth;
use crate::services::token_mirror::TokenMirrorService;
use crate::services::environment_registry::EnvironmentRegistry;

/// Helper to authenticate and get ClientContext
async fn auth(
  req: &HttpRequest,
  data: &web::Data<AppState>,
) -> Result<client_auth::ClientContext, HttpResponse> {
  let token_mirror: Arc<TokenMirrorService> = Arc::clone(&data.token_mirror);
  let env_registry: Arc<EnvironmentRegistry> = Arc::clone(&data.env_registry);
  client_auth::authenticate_client(req, &token_mirror, &env_registry).await
}

/// GET /api/v1/client/test
async fn test_auth(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  match auth(&req, &data).await {
    Ok(ctx) => HttpResponse::Ok().json(serde_json::json!({
      "success": true,
      "message": "Client SDK authentication successful",
      "data": {
        "tokenId": "edge-token",
        "tokenName": ctx.application_name,
        "tokenType": "client",
        "environmentId": ctx.environment_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
      }
    })),
    Err(resp) => resp,
  }
}

/// GET /api/v1/client/client-version
async fn client_version(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let query = web::Query::<std::collections::HashMap<String, String>>::from_query(
    req.query_string(),
  );
  let params = query.unwrap_or_else(|_| web::Query(std::collections::HashMap::new()));

  let platform = match params.get("platform") {
    Some(p) => p.clone(),
    None => {
      return HttpResponse::BadRequest().json(serde_json::json!({
        "success": false,
        "message": "platform is a required query parameter"
      }));
    }
  };

  let version = params.get("version").cloned();
  let status = params.get("status").cloned();
  let lang = params.get("lang").cloned();

  // Validate status parameter
  let valid_statuses = [
    "ONLINE", "OFFLINE", "MAINTENANCE", "UPDATE_REQUIRED",
    "RECOMMENDED_UPDATE", "FORCED_UPDATE",
  ];
  let status_filter = if let Some(ref s) = status {
    let upper = s.to_uppercase();
    if !valid_statuses.contains(&upper.as_str()) {
      return HttpResponse::BadRequest().json(serde_json::json!({
        "success": false,
        "message": format!("Invalid status. Valid values are: {}", valid_statuses.join(", "))
      }));
    }
    Some(upper)
  } else {
    None
  };

  let sdk = data.sdk.read().await;
  let env_versions = sdk
    .client_version
    .get_cached(Some(&ctx.cache_key))
    .await;

  // Filter by platform
  let platform_versions: Vec<_> = env_versions
    .iter()
    .filter(|v| v.platform == platform || v.platform == "all")
    .collect();

  let is_latest = version.is_none()
    || version
      .as_ref()
      .map(|v| v.to_lowercase() == "latest")
      .unwrap_or(false);

  let record = if is_latest {
    let mut candidates: Vec<_> = platform_versions.into_iter().collect();
    if let Some(ref sf) = status_filter {
      candidates.retain(|v| v.client_status == *sf);
    }
    candidates.sort_by(|a, b| {
      b.client_version.cmp(&a.client_version)
    });
    candidates.into_iter().next()
  } else {
    let ver = version.as_ref().unwrap();
    platform_versions
      .into_iter()
      .find(|v| v.client_version == *ver)
  };

  let record = match record {
    Some(r) => r,
    None => {
      let msg = if is_latest {
        format!(
          "No client version found for platform: {}{}",
          platform,
          status_filter.as_ref().map(|s| format!(" with status: {}", s)).unwrap_or_default()
        )
      } else {
        "Client version not found".to_string()
      };
      return HttpResponse::NotFound().json(serde_json::json!({
        "success": false,
        "message": msg
      }));
    }
  };

  // Build maintenance message
  let maintenance_message = record.maintenance_message.clone();
  if record.client_status == "MAINTENANCE" {
    if let Some(ref _lang) = lang {
      // Note: ClientVersion in Rust SDK does not have maintenanceLocales field yet,
      // so we use the default maintenance_message
    }
  }

  // Build meta from custom_payload
  let meta = record.custom_payload.clone().unwrap_or(serde_json::json!({}));

  let mut client_data = serde_json::json!({
    "platform": record.platform,
    "clientVersion": record.client_version,
    "status": record.client_status,
    "gameServerAddress": record.game_server_address,
    "patchAddress": record.patch_address,
    "guestModeAllowed": if record.client_status == "MAINTENANCE" {
      false
    } else {
      record.guest_mode_allowed
    },
    "externalClickLink": record.external_click_link,
    "meta": meta,
  });

  if record.client_status == "MAINTENANCE" {
    client_data["maintenanceMessage"] = serde_json::json!(
      maintenance_message.unwrap_or_default()
    );
  }

  debug!(
    "Client version retrieved: env={}, platform={}, version={}",
    ctx.environment_id, platform, record.client_version
  );

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": client_data,
    "cached": true,
  }))
}

/// GET /api/v1/client/game-worlds
async fn game_worlds(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let sdk = data.sdk.read().await;
  let env_worlds = sdk.game_world.get_cached(Some(&ctx.cache_key)).await;

  // Filter non-maintenance worlds
  let visible_worlds: Vec<_> = env_worlds
    .iter()
    .filter(|w| !w.is_maintenance)
    .collect();

  let worlds_json: Vec<serde_json::Value> = visible_worlds
    .iter()
    .map(|world| {
      serde_json::json!({
        "id": world.id,
        "worldId": world.world_id,
        "name": world.name,
        "displayOrder": world.display_order,
        "meta": world.custom_payload.clone().unwrap_or(serde_json::json!({})),
        "createdAt": world.created_at,
      })
    })
    .collect();

  debug!(
    "Game worlds retrieved: env={}, count={}",
    ctx.environment_id,
    worlds_json.len()
  );

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": {
      "worlds": worlds_json,
      "total": worlds_json.len(),
      "timestamp": chrono::Utc::now().to_rfc3339(),
    },
    "cached": true,
  }))
}

/// GET /api/v1/client/banners
async fn banners(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let sdk = data.sdk.read().await;
  let env_banners = sdk.banner.get_cached(Some(&ctx.cache_key)).await;

  let client_banners: Vec<serde_json::Value> = env_banners
    .iter()
    .map(|banner| {
      serde_json::json!({
        "bannerId": banner.banner_id,
        "name": banner.name,
        "width": banner.width,
        "height": banner.height,
        "playbackSpeed": banner.playback_speed,
        "sequences": banner.sequences,
        "metadata": banner.metadata,
        "version": banner.version,
      })
    })
    .collect();

  debug!(
    "Banners retrieved: env={}, count={}",
    ctx.environment_id,
    client_banners.len()
  );

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": {
      "banners": client_banners,
      "timestamp": chrono::Utc::now().to_rfc3339(),
    },
  }))
}

/// GET /api/v1/client/banners/{bannerId}
async fn banner_by_id(
  req: HttpRequest,
  path: web::Path<String>,
  data: web::Data<AppState>,
) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let banner_id = path.into_inner();

  let sdk = data.sdk.read().await;
  let env_banners = sdk.banner.get_cached(Some(&ctx.cache_key)).await;

  let banner = env_banners.iter().find(|b| b.banner_id == banner_id);

  match banner {
    Some(banner) => {
      let client_banner = serde_json::json!({
        "bannerId": banner.banner_id,
        "name": banner.name,
        "width": banner.width,
        "height": banner.height,
        "playbackSpeed": banner.playback_speed,
        "sequences": banner.sequences,
        "metadata": banner.metadata,
        "version": banner.version,
      });

      HttpResponse::Ok().json(serde_json::json!({
        "success": true,
        "data": {
          "banner": client_banner,
          "timestamp": chrono::Utc::now().to_rfc3339(),
        },
      }))
    }
    None => HttpResponse::NotFound().json(serde_json::json!({
      "success": false,
      "error": {
        "code": "NOT_FOUND",
        "message": "Banner not found"
      }
    })),
  }
}

/// GET /api/v1/client/service-notices
async fn service_notices(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let query = web::Query::<std::collections::HashMap<String, String>>::from_query(
    req.query_string(),
  );
  let params = query.unwrap_or_else(|_| web::Query(std::collections::HashMap::new()));
  let platform = params.get("platform").or(ctx.platform.as_ref());

  let sdk = data.sdk.read().await;
  let env_notices = sdk.service_notice.get_cached(Some(&ctx.cache_key)).await;

  let filtered_notices: Vec<_> = if let Some(plat) = platform {
    env_notices
      .iter()
      .filter(|n| n.platforms.is_empty() || n.platforms.contains(&plat.to_string()))
      .collect()
  } else {
    env_notices.iter().collect()
  };

  let notices_json: Vec<serde_json::Value> = filtered_notices
    .iter()
    .map(|n| serde_json::to_value(n).unwrap_or(serde_json::json!({})))
    .collect();

  debug!(
    "Service notices retrieved: env={}, count={}",
    ctx.environment_id,
    notices_json.len()
  );

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": {
      "notices": notices_json,
      "total": notices_json.len(),
    },
  }))
}

/// GET /api/v1/client/client-versions
async fn client_versions(req: HttpRequest, data: web::Data<AppState>) -> impl Responder {
  let ctx = match auth(&req, &data).await {
    Ok(c) => c,
    Err(resp) => return resp,
  };

  let sdk = data.sdk.read().await;
  let env_versions = sdk
    .client_version
    .get_cached(Some(&ctx.cache_key))
    .await;

  let platform = ctx.platform.as_deref();
  let filtered: Vec<_> = if let Some(plat) = platform {
    env_versions
      .iter()
      .filter(|v| v.platform == plat || v.platform == "all")
      .collect()
  } else {
    env_versions.iter().collect()
  };

  let versions_json: Vec<serde_json::Value> = filtered
    .iter()
    .map(|v| serde_json::to_value(v).unwrap_or(serde_json::json!({})))
    .collect();

  HttpResponse::Ok().json(serde_json::json!({
    "success": true,
    "data": {
      "versions": versions_json,
      "total": versions_json.len(),
    },
  }))
}

/// Configure client routes
pub fn configure(cfg: &mut web::ServiceConfig) {
  cfg.service(
    web::scope("/api/v1/client")
      .route("/test", web::get().to(test_auth))
      .route("/client-version", web::get().to(client_version))
      .route("/client-versions", web::get().to(client_versions))
      .route("/game-worlds", web::get().to(game_worlds))
      .route("/banners", web::get().to(banners))
      .route("/banners/{bannerId}", web::get().to(banner_by_id))
      .route("/service-notices", web::get().to(service_notices)),
  );
}
