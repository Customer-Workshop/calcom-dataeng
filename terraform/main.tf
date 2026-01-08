locals {
  common_tags = merge(var.tags, {
    environment = var.environment
  })
}

data "databricks_current_user" "me" {}

resource "databricks_sql_endpoint" "calcom_warehouse" {
  name             = var.warehouse_name
  cluster_size     = var.warehouse_size
  max_num_clusters = 1
  auto_stop_mins   = 15

  tags {
    custom_tags {
      key   = "project"
      value = local.common_tags["project"]
    }
    custom_tags {
      key   = "environment"
      value = var.environment
    }
    custom_tags {
      key   = "managed_by"
      value = "terraform"
    }
  }
}

resource "databricks_catalog" "calcom" {
  name    = var.catalog_name
  comment = "Cal.com Lakehouse catalog for booking and scheduling data"
}

resource "databricks_schema" "booking_data" {
  catalog_name = databricks_catalog.calcom.name
  name         = var.schema_name
  comment      = "Schema containing Cal.com booking data from PostgreSQL"
}
