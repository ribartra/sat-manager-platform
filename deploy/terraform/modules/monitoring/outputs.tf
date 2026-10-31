output "uptime_check_ids" {
  value = {
    web    = google_monitoring_uptime_check_config.web.uptime_check_id
    backup = google_monitoring_uptime_check_config.backup.uptime_check_id
  }
}

output "notification_channel" {
  value = google_monitoring_notification_channel.email.id
}
