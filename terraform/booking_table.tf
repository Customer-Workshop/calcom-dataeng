resource "databricks_sql_table" "booking" {
  catalog_name = databricks_catalog.calcom.name
  schema_name  = databricks_schema.booking_data.name
  name         = "booking"
  table_type   = "MANAGED"
  comment      = "Cal.com booking records - core scheduling data from PostgreSQL"

  column {
    name    = "id"
    type    = "INT"
    comment = "Primary key - auto-incrementing booking ID"
  }

  column {
    name    = "uid"
    type    = "STRING"
    comment = "Unique identifier for the booking"
  }

  column {
    name    = "idempotency_key"
    type    = "STRING"
    comment = "Optional UID based on slot start/end time and email to prevent duplicates"
  }

  column {
    name    = "user_id"
    type    = "INT"
    comment = "Foreign key to the User table - the host of the booking"
  }

  column {
    name    = "user_primary_email"
    type    = "STRING"
    comment = "User's email at the time of booking"
  }

  column {
    name    = "event_type_id"
    type    = "INT"
    comment = "Foreign key to the EventType table"
  }

  column {
    name    = "title"
    type    = "STRING"
    comment = "Title of the booking"
  }

  column {
    name    = "description"
    type    = "STRING"
    comment = "Description of the booking"
  }

  column {
    name    = "start_time"
    type    = "TIMESTAMP"
    comment = "Start time of the booking"
  }

  column {
    name    = "end_time"
    type    = "TIMESTAMP"
    comment = "End time of the booking"
  }

  column {
    name    = "location"
    type    = "STRING"
    comment = "Location of the booking (URL, address, or meeting link)"
  }

  column {
    name    = "status"
    type    = "STRING"
    comment = "Booking status: CANCELLED, ACCEPTED, REJECTED, PENDING, AWAITING_HOST"
  }

  column {
    name    = "paid"
    type    = "BOOLEAN"
    comment = "Whether the booking has been paid for"
  }

  column {
    name    = "cancellation_reason"
    type    = "STRING"
    comment = "Reason for cancellation if cancelled"
  }

  column {
    name    = "rejection_reason"
    type    = "STRING"
    comment = "Reason for rejection if rejected"
  }

  column {
    name    = "reassign_reason"
    type    = "STRING"
    comment = "Reason for reassignment if reassigned"
  }

  column {
    name    = "reassign_by_id"
    type    = "INT"
    comment = "User ID who reassigned the booking"
  }

  column {
    name    = "rescheduled"
    type    = "BOOLEAN"
    comment = "Whether the booking has been rescheduled"
  }

  column {
    name    = "from_reschedule"
    type    = "STRING"
    comment = "UID of the original booking if this is a rescheduled booking"
  }

  column {
    name    = "recurring_event_id"
    type    = "STRING"
    comment = "ID linking recurring booking instances"
  }

  column {
    name    = "sms_reminder_number"
    type    = "STRING"
    comment = "Phone number for SMS reminders"
  }

  column {
    name    = "is_recorded"
    type    = "BOOLEAN"
    comment = "Whether the meeting was recorded"
  }

  column {
    name    = "ical_uid"
    type    = "STRING"
    comment = "iCal unique identifier"
  }

  column {
    name    = "ical_sequence"
    type    = "INT"
    comment = "iCal sequence number for updates"
  }

  column {
    name    = "rating"
    type    = "INT"
    comment = "Rating given for the booking"
  }

  column {
    name    = "rating_feedback"
    type    = "STRING"
    comment = "Feedback text for the rating"
  }

  column {
    name    = "no_show_host"
    type    = "BOOLEAN"
    comment = "Whether the host was a no-show"
  }

  column {
    name    = "cancelled_by"
    type    = "STRING"
    comment = "Email of the person who cancelled"
  }

  column {
    name    = "rescheduled_by"
    type    = "STRING"
    comment = "Email of the person who rescheduled"
  }

  column {
    name    = "creation_source"
    type    = "STRING"
    comment = "Source of booking creation: API_V1, API_V2, WEBAPP"
  }

  column {
    name    = "custom_inputs"
    type    = "STRING"
    comment = "JSON string containing custom input fields"
  }

  column {
    name    = "responses"
    type    = "STRING"
    comment = "JSON string containing booking form responses"
  }

  column {
    name    = "metadata"
    type    = "STRING"
    comment = "JSON string containing additional booking metadata"
  }

  column {
    name    = "destination_calendar_id"
    type    = "INT"
    comment = "Foreign key to destination calendar"
  }

  column {
    name    = "dynamic_event_slug_ref"
    type    = "STRING"
    comment = "Reference to dynamic event slug"
  }

  column {
    name    = "dynamic_group_slug_ref"
    type    = "STRING"
    comment = "Reference to dynamic group slug"
  }

  column {
    name    = "one_time_password"
    type    = "STRING"
    comment = "One-time password for booking access"
  }

  column {
    name    = "created_at"
    type    = "TIMESTAMP"
    comment = "Timestamp when the booking was created"
  }

  column {
    name    = "updated_at"
    type    = "TIMESTAMP"
    comment = "Timestamp when the booking was last updated"
  }

  column {
    name    = "_ingested_at"
    type    = "TIMESTAMP"
    comment = "Timestamp when the record was ingested into the lakehouse"
  }

  column {
    name    = "_source_system"
    type    = "STRING"
    comment = "Source system identifier (calcom_postgres)"
  }
}
