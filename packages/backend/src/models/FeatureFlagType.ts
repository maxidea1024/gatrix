import { getPool } from '../database';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface FeatureFlagTypeAttributes {
    flagType: string;
    displayName: string;
    description: string | null;
    lifetimeDays: number | null;
    iconName: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface UpdateFlagTypeInput {
    displayName?: string;
    description?: string | null;
    lifetimeDays?: number | null;
    iconName?: string | null;
    sortOrder?: number;
}

export class FeatureFlagTypeModel {
    private static tableName = 'g_feature_flag_types';

    /**
     * Find all flag types
     */
    static async findAll(): Promise<FeatureFlagTypeAttributes[]> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM ${this.tableName} ORDER BY sortOrder ASC`
        );
        return rows as FeatureFlagTypeAttributes[];
    }

    /**
     * Find by flag type
     */
    static async findByType(flagType: string): Promise<FeatureFlagTypeAttributes | null> {
        const pool = getPool();
        const [rows] = await pool.execute<RowDataPacket[]>(
            `SELECT * FROM ${this.tableName} WHERE flagType = ?`,
            [flagType]
        );
        return rows.length > 0 ? (rows[0] as FeatureFlagTypeAttributes) : null;
    }

    /**
     * Update a flag type
     */
    static async update(
        flagType: string,
        input: UpdateFlagTypeInput
    ): Promise<FeatureFlagTypeAttributes> {
        const pool = getPool();

        const updateFields: string[] = [];
        const values: any[] = [];

        if (input.displayName !== undefined) {
            updateFields.push('displayName = ?');
            values.push(input.displayName);
        }
        if (input.description !== undefined) {
            updateFields.push('description = ?');
            values.push(input.description);
        }
        if (input.lifetimeDays !== undefined) {
            updateFields.push('lifetimeDays = ?');
            values.push(input.lifetimeDays);
        }
        if (input.iconName !== undefined) {
            updateFields.push('iconName = ?');
            values.push(input.iconName);
        }
        if (input.sortOrder !== undefined) {
            updateFields.push('sortOrder = ?');
            values.push(input.sortOrder);
        }

        if (updateFields.length === 0) {
            const existing = await this.findByType(flagType);
            if (!existing) throw new Error('Flag type not found');
            return existing;
        }

        values.push(flagType);

        await pool.execute<ResultSetHeader>(
            `UPDATE ${this.tableName} SET ${updateFields.join(', ')} WHERE flagType = ?`,
            values
        );

        const updated = await this.findByType(flagType);
        if (!updated) throw new Error('Flag type not found after update');
        return updated;
    }
}
