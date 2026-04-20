This section covers Notification. Part 7 of 8.

## Notification
- The Notification service is documented as the future home for email notifications, WebSocket push updates, and notification history, but the current repository snapshot does not contain runtime code for the service.
- Current maturity: planning docs exist; no executable service entry point exists in the current snapshot; the service should not be treated as runnable or production-ready yet.
- Intended responsibilities according to the planning docs are sending transactional email, pushing real-time notifications to clients, storing notification history, and consuming RabbitMQ events from the backend ecosystem.
- Intended integration points are RabbitMQ for `application.created`, `cv.parsed`, `cv.failed`, and `notification.send`; PostgreSQL for notification history; Redis for Socket.IO scaling; SMTP for email; and Socket.IO for real-time client push.
- Planning-doc architecture themes are a modular NestJS service, an HTTP API for notification history and actions, a WebSocket gateway for authenticated push notifications, a RabbitMQ consumer for backend events, a Prisma-backed persistence layer, and JWT-based auth shared with the rest of the backend.
- Important caution: all of the above are design intentions, not current runtime facts.
- Recommended interpretation: treat Notification as a service design area rather than a live service, and check future implementation against the current event contracts and the live code in `api-gateway/` and `cv-parser/`.
