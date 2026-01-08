output "sql_warehouse_id" {
  description = "ID of the Databricks SQL warehouse (if created)"
  value       = var.create_warehouse ? databricks_sql_endpoint.calcom_warehouse[0].id : null
}

output "sql_warehouse_jdbc_url" {
  description = "JDBC URL for connecting to the SQL warehouse (if created)"
  value       = var.create_warehouse ? databricks_sql_endpoint.calcom_warehouse[0].jdbc_url : null
}

output "catalog_name" {
  description = "Name of the Unity Catalog"
  value       = local.catalog_name
}

output "schema_name" {
  description = "Name of the schema within the catalog"
  value       = databricks_schema.booking_data.name
}

output "booking_table_name" {
  description = "Fully qualified name of the booking table (created by ingestion notebook)"
  value       = "${local.catalog_name}.${databricks_schema.booking_data.name}.booking"
}

output "ingestion_job_id" {
  description = "ID of the booking ingestion job"
  value       = databricks_job.booking_ingestion.id
}

output "ingestion_job_url" {
  description = "URL to the booking ingestion job in Databricks"
  value       = databricks_job.booking_ingestion.url
}

output "notebook_path" {
  description = "Path to the ingestion notebook"
  value       = databricks_notebook.booking_ingestion.path
}
