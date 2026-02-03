import { Request, Response, NextFunction } from 'express';
import { DataManagementService } from '../services/DataManagementService';
import logger from '../config/logger';

export const exportData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buffer = await DataManagementService.exportData();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gatrix-backup-${timestamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const importData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new Error('No file uploaded');
    }

    await DataManagementService.importData(req.file.buffer);

    res.json({
      success: true,
      message: 'Data imported successfully. All caches have been cleared.',
    });
  } catch (error) {
    next(error);
  }
};
