import { SetMetadata } from '@nestjs/common';

export const SKIP_WORKSPACE_CONTEXT_KEY = 'skipWorkspaceContext';
export const SkipWorkspaceContext = () => SetMetadata(SKIP_WORKSPACE_CONTEXT_KEY, true);
