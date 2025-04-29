// src/payment/entities/transaction.entity.ts
import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    UpdateDateColumn,
    Index,
    BeforeInsert,
    BeforeUpdate
  } from 'typeorm';
  import { Exclude } from 'class-transformer';
  
  @Entity('transactions')
  export class Transaction {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ unique: true })
    @Index()
    reference: string;
  
    @Column()
    @Index()
    customerEmail: string;
  
    @Column('int')
    amount: number;
  
    @Column()
    currency: string;
  
    @Column({ default: 'pending' })
    @Index()
    status: 'pending' | 'success' | 'failed' | 'refunded';
    
    @Column({ type: 'json', nullable: true })
    metadata?: string;  // Change from Record<string, any> to string
  
    @Column({ nullable: true })
    @Exclude({ toPlainOnly: true }) // Exclude from JSON responses
    ipAddress?: string;
  
    @Column({ nullable: true })
    @Exclude({ toPlainOnly: true }) // Exclude from JSON responses
    userAgent?: string;
  
    @CreateDateColumn()
    createdAt: Date;
  
    @UpdateDateColumn()
    updatedAt: Date;
  
    // Sanitize sensitive data before insert/update
    @BeforeInsert()
    @BeforeUpdate()
    sanitizeData() {
      // Remove potentially dangerous keys from metadata
      if (this.metadata) {
        // Parse metadata first since it's stored as string
        const parsedMetadata = JSON.parse(this.metadata);
        const sensitiveKeys = ['password', 'secret', 'token', 'authorization', 'script'];
        
        Object.keys(parsedMetadata).forEach(key => {
          const lowerKey = key.toLowerCase();
          if (sensitiveKeys.some(badKey => lowerKey.includes(badKey))) {
            delete parsedMetadata[key];
          }
        });
        
        // Re-stringify the cleaned metadata
        this.metadata = JSON.stringify(parsedMetadata);
      }
    }
  }