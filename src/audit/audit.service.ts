import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './entities/audit-log.entity';
import { AuditAction } from './enums/audit-action.enum';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditLogRepository: Repository<AuditLogEntity>,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async logSecurityEvent(userId: string, action: string) {
    await this.redis.zadd(
      `security_audit:${userId}`,
      Date.now(),
      JSON.stringify({
        action,
        timestamp: new Date().toISOString(),
        ip: '' // Get from request
      })
    );
  }

  async log(
    userId: string,
    action: AuditAction,
    resource: string,
    resourceId?: string,
    metadata?: any,
    ipAddress?: string,
  ) {
    try {
      const auditLog = await this.auditLogRepository.save({
        userId,
        action,
        resource,
        resourceId,
        metadata: metadata || {},
        ipAddress,
        timestamp: new Date(),
      });

      this.logger.debug(
        `Audit log created: ${userId} performed ${action} on ${resource}${
          resourceId ? `/${resourceId}` : ''
        }`,
      );

      return auditLog;
    } catch (error) {
      this.logger.error(
        `Failed to create audit log: ${error.message}`,
        error.stack,
      );
      // Don't throw - audit logging should not break the main flow
      return null;
    }
  }

  async getAuditLogs(
    filters: {
      userId?: string;
      action?: AuditAction;
      resource?: string;
      resourceId?: string;
      startDate?: Date;
      endDate?: Date;
    },
    page = 1,
    limit = 20,
  ) {
    const query = this.auditLogRepository.createQueryBuilder('audit');

    if (filters.userId) {
      query.andWhere('audit.userId = :userId', { userId: filters.userId });
    }

    if (filters.action) {
      query.andWhere('audit.action = :action', { action: filters.action });
    }

    if (filters.resource) {
      query.andWhere('audit.resource = :resource', { resource: filters.resource });
    }

    if (filters.resourceId) {
      query.andWhere('audit.resourceId = :resourceId', { resourceId: filters.resourceId });
    }

    if (filters.startDate) {
      query.andWhere('audit.timestamp >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      query.andWhere('audit.timestamp <= :endDate', { endDate: filters.endDate });
    }

    query.orderBy('audit.timestamp', 'DESC');
    query.skip((page - 1) * limit);
    query.take(limit);

    const [logs, total] = await query.getManyAndCount();

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }
}