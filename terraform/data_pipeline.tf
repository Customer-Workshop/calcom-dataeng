resource "databricks_secret_scope" "calcom" {
  name = "calcom-postgres-credentials"
}

resource "databricks_secret" "postgres_host" {
  key          = "postgres_host"
  string_value = var.postgres_host
  scope        = databricks_secret_scope.calcom.name
}

resource "databricks_secret" "postgres_port" {
  key          = "postgres_port"
  string_value = tostring(var.postgres_port)
  scope        = databricks_secret_scope.calcom.name
}

resource "databricks_secret" "postgres_database" {
  key          = "postgres_database"
  string_value = var.postgres_database
  scope        = databricks_secret_scope.calcom.name
}

resource "databricks_secret" "postgres_user" {
  key          = "postgres_user"
  string_value = var.postgres_user
  scope        = databricks_secret_scope.calcom.name
}

resource "databricks_secret" "postgres_password" {
  key          = "postgres_password"
  string_value = var.postgres_password
  scope        = databricks_secret_scope.calcom.name
}

resource "databricks_notebook" "booking_ingestion" {
  path     = "/Shared/calcom/booking_ingestion"
  language = "PYTHON"
  content_base64 = base64encode(<<-EOT
# Databricks notebook source
# MAGIC %md
# MAGIC # Cal.com Booking Data Ingestion
# MAGIC This notebook copies booking data from PostgreSQL to the Databricks lakehouse.
# MAGIC No transformations are applied - data is copied as-is.

# COMMAND ----------

from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, lit
import json

# COMMAND ----------

# PostgreSQL connection configuration from secrets
postgres_host = dbutils.secrets.get(scope="calcom-postgres-credentials", key="postgres_host")
postgres_port = dbutils.secrets.get(scope="calcom-postgres-credentials", key="postgres_port")
postgres_database = dbutils.secrets.get(scope="calcom-postgres-credentials", key="postgres_database")
postgres_user = dbutils.secrets.get(scope="calcom-postgres-credentials", key="postgres_user")
postgres_password = dbutils.secrets.get(scope="calcom-postgres-credentials", key="postgres_password")

jdbc_url = f"jdbc:postgresql://{postgres_host}:{postgres_port}/{postgres_database}"

connection_properties = {
    "user": postgres_user,
    "password": postgres_password,
    "driver": "org.postgresql.Driver"
}

# COMMAND ----------

# MAGIC %md
# MAGIC ## Read Booking Data from PostgreSQL

# COMMAND ----------

# SQL query to extract booking data
# Column names are mapped from camelCase to snake_case for the lakehouse
booking_query = """
(SELECT 
    id,
    uid,
    "idempotencyKey" as idempotency_key,
    "userId" as user_id,
    "userPrimaryEmail" as user_primary_email,
    "eventTypeId" as event_type_id,
    title,
    description,
    "startTime" as start_time,
    "endTime" as end_time,
    location,
    status::text as status,
    paid,
    "cancellationReason" as cancellation_reason,
    "rejectionReason" as rejection_reason,
    "reassignReason" as reassign_reason,
    "reassignById" as reassign_by_id,
    rescheduled,
    "fromReschedule" as from_reschedule,
    "recurringEventId" as recurring_event_id,
    "smsReminderNumber" as sms_reminder_number,
    "isRecorded" as is_recorded,
    "iCalUID" as ical_uid,
    "iCalSequence" as ical_sequence,
    rating,
    "ratingFeedback" as rating_feedback,
    "noShowHost" as no_show_host,
    "cancelledBy" as cancelled_by,
    "rescheduledBy" as rescheduled_by,
    "creationSource"::text as creation_source,
    "customInputs"::text as custom_inputs,
    responses::text as responses,
    metadata::text as metadata,
    "destinationCalendarId" as destination_calendar_id,
    "dynamicEventSlugRef" as dynamic_event_slug_ref,
    "dynamicGroupSlugRef" as dynamic_group_slug_ref,
    "oneTimePassword" as one_time_password,
    "createdAt" as created_at,
    "updatedAt" as updated_at
FROM "Booking") as booking_data
"""

# Read data from PostgreSQL
booking_df = spark.read.jdbc(
    url=jdbc_url,
    table=booking_query,
    properties=connection_properties
)

# COMMAND ----------

# MAGIC %md
# MAGIC ## Add Ingestion Metadata

# COMMAND ----------

# Add ingestion metadata columns
booking_df_with_metadata = booking_df \
    .withColumn("_ingested_at", current_timestamp()) \
    .withColumn("_source_system", lit("calcom_postgres"))

# COMMAND ----------

# MAGIC %md
# MAGIC ## Write to Delta Lake

# COMMAND ----------

# Target table in Unity Catalog
target_table = "${var.catalog_name}.${var.schema_name}.booking"

# Write to Delta Lake using merge for idempotent updates
# For initial load, use overwrite mode
booking_df_with_metadata.write \
    .format("delta") \
    .mode("overwrite") \
    .option("overwriteSchema", "true") \
    .saveAsTable(target_table)

print(f"Successfully wrote {booking_df_with_metadata.count()} records to {target_table}")

# COMMAND ----------

# MAGIC %md
# MAGIC ## Verify Data Load

# COMMAND ----------

# Display sample of loaded data
display(spark.sql(f"SELECT * FROM {target_table} LIMIT 10"))

# COMMAND ----------

# Show record count
record_count = spark.sql(f"SELECT COUNT(*) as count FROM {target_table}").collect()[0]["count"]
print(f"Total records in {target_table}: {record_count}")
EOT
  )
}

resource "databricks_cluster" "ingestion_cluster" {
  cluster_name            = "calcom-ingestion-cluster"
  spark_version           = "13.3.x-scala2.12"
  node_type_id            = "i3.xlarge"
  autotermination_minutes = 20
  num_workers             = 0

  spark_conf = {
    "spark.databricks.cluster.profile" = "singleNode"
    "spark.master"                     = "local[*]"
  }

  custom_tags = {
    "ResourceClass" = "SingleNode"
    "project"       = local.common_tags["project"]
    "environment"   = var.environment
    "managed_by"    = "terraform"
  }

  library {
    maven {
      coordinates = "org.postgresql:postgresql:42.6.0"
    }
  }
}

resource "databricks_job" "booking_ingestion" {
  name = "calcom-booking-ingestion"

  task {
    task_key = "ingest_bookings"

    existing_cluster_id = databricks_cluster.ingestion_cluster.id

    notebook_task {
      notebook_path = databricks_notebook.booking_ingestion.path
    }
  }

  schedule {
    quartz_cron_expression = "0 0 * * * ?"
    timezone_id            = "UTC"
    pause_status           = "PAUSED"
  }

  email_notifications {
    no_alert_for_skipped_runs = true
  }

  tags = local.common_tags
}
