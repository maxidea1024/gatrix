import { Request, Response } from 'express';
import { consoleService } from '../services/ConsoleService';
import { pubSubService } from '../services/PubSubService';
import { AuditLogModel } from '../models/AuditLog';
import logger from '../config/logger';

export class SystemConsoleController {
  static async listCommands(req: Request, res: Response) {
    return res.json({ success: true, commands: consoleService.listCommands() });
  }

  static async execute(req: Request, res: Response) {
    const { command, args } = req.body || {};
    if (!command || typeof command !== 'string') {
      return res.status(400).json({ success: false, message: 'command is required' });
    }
    const argv: string[] = Array.isArray(args) ? args.map(String) : [];
    const ctx = { user: (req as any)?.user };
    const result = await consoleService.execute(command, argv, ctx);

    // Create audit log if command requires auditing
    if (consoleService.shouldAudit(command)) {
      try {
        await AuditLogModel.create({
          userId: (req as any)?.user?.id || (req as any)?.userId,
          action: `console_${command}`,
          description: `Console command '${command}' executed with args [${argv.join(', ')}]`,
          resourceType: 'console',
          resourceId: undefined, // Console commands don't have numeric entity IDs
          newValues: {
            command,
            args: argv,
          },
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
        });
      } catch (error) {
        // Don't fail the request if audit logging fails
        logger.error('Failed to create console audit log:', error);
      }
    }

    // Also broadcast via SSE (to the requesting user only)
    try {
      const userId = (req as any)?.user?.id || (req as any)?.userId;
      await pubSubService.publishNotification({
        type: 'console_output',
        data: { command, args: argv, output: result.output },
        targetUsers: userId ? [userId] : undefined,
      });
    } catch (err) {
      // Non-fatal: logging only
      // eslint-disable-next-line no-console
      console.error('Failed to publish console_output notification:', err);
    }

    return res.json({ success: true, output: result.output });
  }
}
