output "static_ip" {
  value = google_compute_address.ip.address
}

output "instance_name" {
  value = google_compute_instance.vm.name
}

output "zone" {
  value = google_compute_instance.vm.zone
}

output "data_device_name" {
  value = var.data_device_name
}
