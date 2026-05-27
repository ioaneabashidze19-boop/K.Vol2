# KavShare API Documentation Template

This document serves as the master API reference template for KavShare. It details endpoints, payload contracts, expected HTTP status codes, webhooks, and error response structures.

---

## 1. Base Configurations & Error Handling

### Base URL

- **Local Development**: `http://localhost:3000/api`
- **Production**: `https://api.kavshare.com/v1` (Example)

### Standard Headers

All requests modifying metadata or fetching personal profiles must include authorization tokens:

```http
Authorization: Bearer <clerk_session_jwt>
Content-Type: application/json
Accept-Language: en
```

### Standard Error Payload

When an error occurs, the server returns an appropriate HTTP status code paired with a JSON error payload:

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "The field 'expiration_hours' must be an integer between 1 and 168.",
    "details": [
      {
        "field": "expiration_hours",
        "issue": "must_be_less_than_or_equal_to_168"
      }
    ]
  }
}
```

#### Common Response Codes

- `200 OK`: Request succeeded.
- `201 Created`: Resource (e.g. upload session) created successfully.
- `400 Bad Request`: Validation failure or malformed payload.
- `401 Unauthorized`: Missing or expired Session JWT.
- `403 Forbidden`: Insufficient permissions (e.g. attempting to delete someone else's file share).
- `404 Not Found`: File share or profile does not exist.
- `410 Gone`: Shared link has expired or been deleted.
- `429 Too Many Requests`: Rate limit exceeded (e.g. too many download attempts).

---

## 2. Authentication

Authentication and session tokens are managed via **Clerk**. Secure endpoints decrypt the Session JWT passed in the `Authorization` header to identify the calling user.

---

## 3. Provider Endpoints (File Owners/Creators)

These endpoints allow registered users to manage files, configure share settings, and track download analytics.

### A. Create Upload Session

Generates a pre-signed S3-compatible URL to upload a file directly to storage.

- **Endpoint**: `POST /files/upload-session`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "file_name": "quarterly_presentation.pdf",
    "file_size_bytes": 10485760,
    "expiration_hours": 24,
    "password_protection": "optional_plain_text_password"
  }
  ```
- **Response (`201 Created`)**:
  ```json
  {
    "file_id": "8c593b4e-9b7e-40cc-87df-57d36aef42cd",
    "upload_url": "https://your-project.supabase.co/storage/v1/object/upload/files/8c593b4e-9b7e-40cc-87df-57d36aef42cd/quarterly_presentation.pdf?token=...",
    "share_url": "http://localhost:3000/en/share/8c593b4e-9b7e-40cc-87df-57d36aef42cd",
    "expires_at": "2026-05-29T20:00:00Z"
  }
  ```

### B. Update File Settings

Updates expiration, title, password security, or toggles active status.

- **Endpoint**: `PATCH /files/:id`
- **Auth Required**: Yes
- **Request Body**:
  ```json
  {
    "password_protection": "new_secure_password",
    "is_active": false
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "file_id": "8c593b4e-9b7e-40cc-87df-57d36aef42cd",
    "is_active": false,
    "updated_at": "2026-05-28T00:30:00Z"
  }
  ```

### C. Revoke File Share

Deletes metadata records and instructs Supabase Storage to delete the binary asset.

- **Endpoint**: `DELETE /files/:id`
- **Auth Required**: Yes
- **Response (`204 No Content`)**:
  _(Empty response body)_

### D. Get Share Analytics

Retrieves total downloads and file views.

- **Endpoint**: `GET /files/:id/analytics`
- **Auth Required**: Yes
- **Response (`200 OK`)**:
  ```json
  {
    "file_id": "8c593b4e-9b7e-40cc-87df-57d36aef42cd",
    "total_views": 142,
    "total_downloads": 89,
    "downloads_timeline": [
      { "date": "2026-05-27", "count": 45 },
      { "date": "2026-05-28", "count": 44 }
    ]
  }
  ```

---

## 4. Seeker Endpoints (Recipients/Downloaders)

Publicly accessible endpoints used to retrieve shared assets. These endpoints are subject to strict rate limits.

### A. Fetch Shared Link Metadata

Fetches generic details (e.g. name, size, type) without granting file download access.

- **Endpoint**: `GET /share/:id`
- **Auth Required**: No (Optional)
- **Response (`200 OK`)**:
  ```json
  {
    "file_name": "quarterly_presentation.pdf",
    "file_size_bytes": 10485760,
    "created_at": "2026-05-27T20:00:00Z",
    "expires_at": "2026-05-29T20:00:00Z",
    "password_required": true
  }
  ```

### B. Generate Download Link

Retrieves a short-lived download URL if authorization gates pass.

- **Endpoint**: `POST /share/:id/download-link`
- **Auth Required**: No (Subject to Password Gate)
- **Request Body**:
  ```json
  {
    "password": "correct_password_here"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "download_url": "https://your-project.supabase.co/storage/v1/object/sign/files/8c593b4e-9b7e-40cc-87df-57d36aef42cd/quarterly_presentation.pdf?token=...",
    "expires_in_seconds": 60
  }
  ```

---

## 5. Admin Endpoints

Endpoints restricted to administrator accounts. Restricted by role checks.

### A. System Health & Bandwidth Metrics

- **Endpoint**: `GET /admin/metrics`
- **Auth Required**: Yes (Admin role check)
- **Response (`200 OK`)**:
  ```json
  {
    "total_files_hosted": 4120,
    "total_active_storage_bytes": 542918451200,
    "egress_bandwidth_24h_bytes": 12891823901,
    "active_users_count": 892
  }
  ```

---

## 6. Webhook Handlers

Asynchronous event listeners triggered by external systems. Requests must pass signature verification rules.

### A. Stripe Billing Hook

Handles subscription lifecycle state changes.

- **Endpoint**: `POST /webhooks/stripe`
- **Headers**: `Stripe-Signature: t=...,v1=...`
- **Payload Signature**: Verified using `STRIPE_WEBHOOK_SECRET`
- **Event Handling**: Updates database profiles status based on `customer.subscription.updated` or `checkout.session.completed`.

### B. Clerk User Lifecycle Hook

Keeps local profiles synchronized with Clerk auth directories.

- **Endpoint**: `POST /webhooks/clerk`
- **Headers**: `svix-signature: ...`
- **Event Handling**: Automatically adds rows to the database profiles table on `user.created` and deletes rows on `user.deleted`.

### C. Tally.so Ingestion Webhook

Appends customer feedback directly to database metrics.

- **Endpoint**: `POST /webhooks/tally`
- **Headers**: `Tally-Signature: ...`
- **Event Handling**: Inserts feedback records into support databases.
