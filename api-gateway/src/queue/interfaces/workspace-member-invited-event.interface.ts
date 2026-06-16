/**
 * Event published when a user is invited to a workspace. The
 * notification service consumes this event and dispatches an
 * invitation email containing the secure acceptance link.
 */
export interface WorkspaceMemberInvitedEvent {
  email: string;
  workspaceName: string;
  token: string;
  inviteUrl: string;
}
