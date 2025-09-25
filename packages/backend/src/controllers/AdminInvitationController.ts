import { Response } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { asyncHandler } from '../utils/asyncHandler';

// Minimal admin invitations controller to satisfy frontend calls
// For now, we do not persist invitations. If no invitation exists, return 404.
// You can extend this to create/list/delete admin invitations backed by DB.

export class AdminInvitationController {
  static getCurrent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    // TODO: Replace with real storage-backed implementation
    res.status(404).json({ success: false, error: 'No active invitation' });
  });
}

