output "data_bucket" {
  value = google_storage_bucket.data.name
}

output "offsite_bucket" {
  value = google_storage_bucket.offsite.name
}

output "stack_objects" {
  value = { for key, object in google_storage_bucket_object.stack : key => object.md5hash }
}
