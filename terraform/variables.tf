variable "databricks_host" {
  description = "Databricks workspace URL"
  type        = string
}

variable "databricks_token" {
  description = "Databricks personal access token"
  type        = string
  sensitive   = true
}

variable "catalog_name" {
  description = "Unity Catalog name for the lakehouse"
  type        = string
  default     = "calcom_lakehouse"
}

variable "schema_name" {
  description = "Schema name within the catalog"
  type        = string
  default     = "booking_data"
}

variable "warehouse_name" {
  description = "Name of the SQL warehouse"
  type        = string
  default     = "calcom-warehouse"
}

variable "warehouse_size" {
  description = "Size of the SQL warehouse (2X-Small, X-Small, Small, Medium, Large, X-Large, 2X-Large, 3X-Large, 4X-Large)"
  type        = string
  default     = "2X-Small"
}

variable "postgres_host" {
  description = "PostgreSQL host for the Cal.com database"
  type        = string
}

variable "postgres_port" {
  description = "PostgreSQL port"
  type        = number
  default     = 5432
}

variable "postgres_database" {
  description = "PostgreSQL database name"
  type        = string
  default     = "calcom"
}

variable "postgres_user" {
  description = "PostgreSQL username"
  type        = string
}

variable "postgres_password" {
  description = "PostgreSQL password"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default = {
    project    = "calcom-lakehouse"
    managed_by = "terraform"
  }
}
