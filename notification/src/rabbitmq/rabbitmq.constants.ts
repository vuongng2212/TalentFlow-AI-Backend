export const TALENTFLOW_EXCHANGE = 'talentflow.events';
export const NOTIFICATION_QUEUE = 'notification.queue';

export const DEAD_LETTER_EXCHANGE = 'talentflow.dlx';
export const DEAD_LETTER_QUEUE = 'notification.dlq';

export const ROUTING_KEYS = {
  // Application Flow (Enriched)
  APPLICATION_CREATED: 'application.created',
  APPLICATION_CV_PROCESSED_SUCCESSFULLY:
    'application.cv_processed_successfully',
  APPLICATION_CV_PROCESSED_FAILED: 'application.cv_processed_failed',

  // Direct Notification
  NOTIFICATION_SEND: 'notification.send',

  // Workspace Multi-Tenancy
  WORKSPACE_MEMBER_INVITED: 'workspace.member.invited',
};

export const BINDING_KEYS = [
  ROUTING_KEYS.APPLICATION_CREATED,
  ROUTING_KEYS.APPLICATION_CV_PROCESSED_SUCCESSFULLY,
  ROUTING_KEYS.APPLICATION_CV_PROCESSED_FAILED,
  ROUTING_KEYS.NOTIFICATION_SEND,
  ROUTING_KEYS.WORKSPACE_MEMBER_INVITED,
];
