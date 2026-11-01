# Uptime checks, the 5xx log metric, alert policies and the email channel (created by hand on
# 2026-10-02, imported into Terraform on 2026-10-31). The 5xx metric reads the `sat_docker` log
# that the Ops Agent ships (deploy/vm/ops-agent.yaml).

resource "google_monitoring_notification_channel" "email" {
  display_name = "SAT ops (${var.alert_email})"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

resource "google_monitoring_uptime_check_config" "web" {
  display_name = "sat-web-health"
  period       = "300s"
  timeout      = "10s"
  checker_type = "STATIC_IP_CHECKERS"

  http_check {
    path           = "/api/health"
    port           = 443
    request_method = "GET"
    use_ssl        = true
    validate_ssl   = false
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = var.domain
      project_id = var.project_id
    }
  }

  content_matchers {
    content = "\"status\":\"ok\""
    matcher = "CONTAINS_STRING"
  }
}

resource "google_monitoring_uptime_check_config" "backup" {
  display_name = "sat-backup-fresh"
  period       = "900s"
  timeout      = "10s"
  checker_type = "STATIC_IP_CHECKERS"

  http_check {
    path           = "/api/health/backup"
    port           = 443
    request_method = "GET"
    use_ssl        = true
    validate_ssl   = false
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host       = var.domain
      project_id = var.project_id
    }
  }

  content_matchers {
    content = "\"backup\":\"fresh\""
    matcher = "CONTAINS_STRING"
  }
}

resource "google_logging_metric" "http_5xx" {
  name        = "sat_http_5xx"
  description = "SAT web API responses with status >= 500 (lib/api-error.ts http.request lines)"
  filter      = "logName=\"projects/${var.project_id}/logs/sat_docker\" AND jsonPayload.event=\"http.request\" AND jsonPayload.status>=500"

  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_monitoring_alert_policy" "web_down" {
  display_name          = "SAT web down (${var.domain} /api/health)"
  combiner              = "OR"
  enabled               = true
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "Uptime /api/health failing"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.web.uptime_check_id}\" AND resource.type=\"uptime_url\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "300s"
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id", "resource.label.host"]
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "Uptime check sat-web-health failing from 2+ regions for 5 min. Runbook: ${var.runbook_path}#alertas"
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "backup_stale" {
  display_name          = "SAT backup stale (/api/health/backup)"
  combiner              = "OR"
  enabled               = true
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "Backup freshness check failing"
    condition_threshold {
      filter          = "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${google_monitoring_uptime_check_config.backup.uptime_check_id}\" AND resource.type=\"uptime_url\""
      comparison      = "COMPARISON_GT"
      threshold_value = 1
      duration        = "1800s"
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "900s"
        per_series_aligner   = "ALIGN_NEXT_OLDER"
        cross_series_reducer = "REDUCE_COUNT_FALSE"
        group_by_fields      = ["resource.label.project_id", "resource.label.host"]
      }
    }
  }

  alert_strategy {
    auto_close = "3600s"
  }

  documentation {
    content   = "Last successful DB backup is older than 13 h (or missing). Check /var/log/sat-db-backup.log on sat-vm. Runbook: ${var.runbook_path}#backups"
    mime_type = "text/markdown"
  }
}

resource "google_monitoring_alert_policy" "http_5xx" {
  display_name          = "SAT API 5xx burst"
  combiner              = "OR"
  enabled               = true
  notification_channels = [google_monitoring_notification_channel.email.id]

  conditions {
    display_name = "5xx > 5 in 5 min"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/${google_logging_metric.http_5xx.name}\" AND resource.type=\"gce_instance\""
      comparison      = "COMPARISON_GT"
      threshold_value = 5
      duration        = "0s"
      trigger {
        count = 1
      }
      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = "More than 5 API responses with status >= 500 in 5 min. Logs Explorer: jsonPayload.event=\"http.request\" jsonPayload.status>=500; follow jsonPayload.requestId. Runbook: ${var.runbook_path}#alertas"
    mime_type = "text/markdown"
  }
}
