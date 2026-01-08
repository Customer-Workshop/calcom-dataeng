# Cal.com Databricks Lakehouse Infrastructure

This Terraform configuration creates a Databricks lakehouse infrastructure for ingesting and analyzing Cal.com booking data from PostgreSQL.

## Architecture Overview

The infrastructure includes:

1. **Databricks SQL Warehouse** - Serverless SQL endpoint for querying data
2. **Unity Catalog** - Catalog and schema for organizing lakehouse tables
3. **Booking Table** - Delta Lake table storing Cal.com booking records
4. **Data Pipeline** - Automated job to copy data from PostgreSQL to Databricks

## Prerequisites

- Terraform >= 1.0.0
- Databricks workspace with Unity Catalog enabled
- Databricks personal access token with appropriate permissions
- Access to the Cal.com PostgreSQL database

## Quick Start

1. Copy the example variables file:
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

2. Edit `terraform.tfvars` with your configuration:
   - Databricks workspace URL and token
   - PostgreSQL connection details
   - Desired catalog and schema names

3. Initialize Terraform:
   ```bash
   terraform init
   ```

4. Review the planned changes:
   ```bash
   terraform plan
   ```

5. Apply the configuration:
   ```bash
   terraform apply
   ```

## Resources Created

| Resource | Description |
|----------|-------------|
| `databricks_sql_endpoint` | SQL warehouse for querying data |
| `databricks_catalog` | Unity Catalog for the lakehouse |
| `databricks_schema` | Schema within the catalog |
| `databricks_sql_table` | Booking table definition |
| `databricks_secret_scope` | Secure storage for PostgreSQL credentials |
| `databricks_notebook` | PySpark notebook for data ingestion |
| `databricks_cluster` | Compute cluster for running the pipeline |
| `databricks_job` | Scheduled job for data ingestion |

## Booking Table Schema

The booking table maps the Cal.com PostgreSQL `Booking` model to a Delta Lake table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INT | Primary key |
| `uid` | STRING | Unique booking identifier |
| `user_id` | INT | Foreign key to User |
| `event_type_id` | INT | Foreign key to EventType |
| `title` | STRING | Booking title |
| `start_time` | TIMESTAMP | Booking start time |
| `end_time` | TIMESTAMP | Booking end time |
| `status` | STRING | CANCELLED, ACCEPTED, REJECTED, PENDING, AWAITING_HOST |
| `paid` | BOOLEAN | Payment status |
| `metadata` | STRING | JSON metadata |
| `_ingested_at` | TIMESTAMP | Ingestion timestamp |
| `_source_system` | STRING | Source system identifier |

See `booking_table.tf` for the complete schema definition.

## Data Pipeline

The data pipeline:

1. Reads booking data from PostgreSQL using JDBC
2. Maps column names from camelCase to snake_case
3. Adds ingestion metadata (`_ingested_at`, `_source_system`)
4. Writes to Delta Lake using overwrite mode

The job is created in a paused state. To enable scheduled runs:

```sql
-- In Databricks, update the job schedule
ALTER JOB calcom-booking-ingestion SET SCHEDULE UNPAUSED
```

Or manually trigger a run from the Databricks Jobs UI.

## Environment Variables

For CI/CD pipelines, you can use environment variables instead of tfvars:

```bash
export TF_VAR_databricks_host="https://your-workspace.cloud.databricks.com"
export TF_VAR_databricks_token="your-token"
export TF_VAR_postgres_host="your-postgres-host"
export TF_VAR_postgres_user="your-user"
export TF_VAR_postgres_password="your-password"
```

## Outputs

After applying, Terraform outputs useful information:

- `sql_warehouse_jdbc_url` - JDBC URL for BI tools
- `booking_table_name` - Fully qualified table name
- `ingestion_job_url` - Link to the ingestion job

## Cleanup

To destroy all resources:

```bash
terraform destroy
```

## Future Enhancements

This is a proof-of-concept implementation. Future enhancements could include:

- Additional tables (User, EventType, Attendee, etc.)
- Incremental data loading using Change Data Capture
- Data quality checks and monitoring
- dbt models for transformations
- Streaming ingestion using Kafka/Debezium
