// Exchange name per ADR-009
export const TALENTFLOW_EVENTS_EXCHANGE = 'talentflow.events';

// CV Parser queues
export const CV_PROCESSING_QUEUE = 'cv_parser.jobs';
export const CV_PARSING_DLQ = 'cv_parser.jobs.dlq';

// Notification queues (for future use)
export const NOTIFICATION_EVENTS_QUEUE = 'notification.events';
export const NOTIFICATION_EVENTS_DLQ = 'notification.events.dlq';

// Routing keys - CV events
export const ROUTING_KEY_CV_UPLOADED = 'cv.uploaded';
export const ROUTING_KEY_CV_PARSED = 'cv.parsed';
export const ROUTING_KEY_CV_FAILED = 'cv.failed';

// Routing keys - Application events
export const ROUTING_KEY_APPLICATION_CREATED = 'application.created';

// Routing keys - Notification events
export const ROUTING_KEY_NOTIFICATION_SEND = 'notification.send';

/** @deprecated Use TALENTFLOW_EVENTS_EXCHANGE instead */
export const CV_EVENTS_EXCHANGE = TALENTFLOW_EVENTS_EXCHANGE;
