output "sql_warehouse_id" {
  description = "ID of the Databricks SQL warehouse"
  value       = databricks_sql_endpoint.calcom_warehouse.id
}

output "sql_warehouse_jdbc_url" {
  description = "JDBC URL for connecting to the SQL warehouse"
  value       = databricks_sql_endpoint.calcom_warehouse.jdbc_url
}

output "catalog_name" {
  description = "Name of the Unity Catalog"
  value       = databricks_catalog.calcom.name
}

output "schema_name" {
  description = "Name of the schema within the catalog"
  value       = databricks_schema.booking_data.name
}

output "booking_table_name" {
  description = "Fully qualified name of the booking table"
  value       = "${databricks_catalog.calcom.name}.${databricks_schema.booking_data.name}.${databricks_sql_table.booking.name}"
}

output "ingestion_job_id" {
  description = "ID of the booking ingestion job"
  value       = databricks_job.booking_ingestion.id
}

output "ingestion_job_url" {
  description = "URL to the booking ingestion job in Databricks"
  value       = databricks_job.booking_ingestion.url
}

output "ingestion_cluster_id" {
  description = "ID of the ingestion cluster"
  value       = databricks_cluster.ingestion_cluster.id
}

output "notebook_path" {
  description = "Path to the ingestion notebook"
  value       = databricks_notebook.booking_ingestion.path
}
