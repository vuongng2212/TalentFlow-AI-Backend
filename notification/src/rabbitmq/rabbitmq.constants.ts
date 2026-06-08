export const TALENTFLOW_EXCHANGE = 'talentflow.events';
export const NOTIFICATION_QUEUE = 'notification.queue';

export const DEAD_LETTER_EXCHANGE = 'talentflow.dlx';
export const DEAD_LETTER_QUEUE = 'notification.dlq';

export const ROUTING_KEYS = {
  // Application Flow
  APPLICATION_CREATED: 'application.created',

  // CV Parsing Flow
  CV_PARSED: 'cv.parsed',
  CV_FAILED: 'cv.failed',

  // Direct Notification
  NOTIFICATION_SEND: 'notification.send',

  // Workspace Multi-Tenancy
  WORKSPACE_MEMBER_INVITED: 'workspace.member.invited',
};

export const BINDING_KEYS = [
  ROUTING_KEYS.APPLICATION_CREATED,
  ROUTING_KEYS.CV_PARSED,
  ROUTING_KEYS.CV_FAILED,
  ROUTING_KEYS.NOTIFICATION_SEND,
  ROUTING_KEYS.WORKSPACE_MEMBER_INVITED,
];
