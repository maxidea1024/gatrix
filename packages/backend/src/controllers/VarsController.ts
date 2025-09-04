import { Request, Response, NextFunction } from 'express';
import VarsModel from '../models/Vars';

export class VarsController {
  static async getVar(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const value = await VarsModel.get(key);
      res.json({ success: true, data: { key, value } });
    } catch (e) { next(e); }
  }

  static async setVar(req: Request, res: Response, next: NextFunction) {
    try {
      const key = req.params.key;
      const incoming = req.body?.value ?? null;
      let toStore: string | null = null;
      if (incoming === null || incoming === undefined) {
        toStore = null;
      } else if (typeof incoming === 'string') {
        toStore = incoming;
      } else {
        toStore = JSON.stringify(incoming);
      }
      await VarsModel.set(key, toStore);
      res.json({ success: true, message: 'Variable saved', data: { key, value: incoming } });
    } catch (e) { next(e); }
  }
}
