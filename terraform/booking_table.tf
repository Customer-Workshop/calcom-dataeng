# Note: The booking table is created dynamically by the ingestion notebook
# using saveAsTable() when it runs. This allows the table schema to be
# inferred from the source data and avoids issues with cluster provisioning
# for SQL table creation in serverless-only workspaces.
#
# Table will be created at: ${local.catalog_name}.${databricks_schema.booking_data.name}.booking
#
# Expected columns (35+ fields from Cal.com Booking model):
# - id (INT) - Primary key
# - uid (STRING) - Unique identifier
# - user_id (INT) - Foreign key to User
# - event_type_id (INT) - Foreign key to EventType
# - title, description (STRING) - Booking details
# - start_time, end_time (TIMESTAMP) - Booking time range
# - status (STRING) - CANCELLED, ACCEPTED, REJECTED, PENDING, AWAITING_HOST
# - paid (BOOLEAN) - Payment status
# - custom_inputs, responses, metadata (STRING) - JSON fields
# - created_at, updated_at (TIMESTAMP) - Audit timestamps
# - _ingested_at (TIMESTAMP) - Ingestion timestamp
# - _source_system (STRING) - Source identifier
