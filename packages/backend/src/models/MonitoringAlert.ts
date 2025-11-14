import { Model } from 'objection';
import { generateULID } from '../utils/ulid';

export class MonitoringAlert extends Model {
  id!: string;
  alertName!: string;
  alertSeverity!: string;
  alertStatus!: string;
  alertMessage?: string | null;
  alertLabels?: any;
  alertAnnotations?: any;
  startsAt?: Date | null;
  endsAt?: Date | null;
  generatorUrl?: string | null;
  fingerprint?: string | null;
  createdAt?: Date;
  updatedAt?: Date | null;

  static get tableName() {
    return 'monitoring_alerts';
  }

  $beforeInsert() {
    if (!this.id) {
      this.id = generateULID();
    }
    if (!this.createdAt) {
      this.createdAt = new Date();
    }
  }

  $beforeUpdate() {
    this.updatedAt = new Date();
  }
}

