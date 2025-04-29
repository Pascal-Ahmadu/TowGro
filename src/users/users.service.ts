import {
    Injectable,
    ConflictException,
    InternalServerErrorException,
    NotFoundException,
    Logger
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial, MoreThanOrEqual } from 'typeorm'
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
    private readonly SALT_ROUNDS = 10;
    private readonly logger = new Logger(UsersService.name);

    constructor(
        @InjectRepository(User)
        private readonly userRepository : Repository<User>,
    ){}

    async findAll(page: number = 1, limit: number = 10): Promise<{ users: User[], total: number }> {
        this.logger.log(`Finding all active users: page ${page}, limit ${limit}`);
        
        const [users, total] = await this.userRepository
            .createQueryBuilder('user')
            .where('user.isActive = true')
            .orderBy('user.createdAt', 'DESC')
            .skip((page - 1) * limit)
            .take(limit)
            .cache(true)
            .getManyAndCount();
        
        return { users, total };
    }

    async findByEmailOrPhoneNumber(identifier: string): Promise<User | null> {
        this.logger.log(`Searching user by identifier: , ${identifier}`);
        
        // Trim the identifier to remove any whitespace
        const trimmedIdentifier = identifier.trim();
        
        // Use LOWER() for case-insensitive comparison
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('LOWER(user.email) = LOWER(:identifier) OR user.phoneNumber = :identifier', {
                identifier: trimmedIdentifier,
            })
            .getOne();
        
        return user || null;
    }
     
    async findById(id: string): Promise<User> {
        this.logger.log(`Searching user by ID: ${id}`);
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('user.id = :id', {id})
            .andWhere('user.isActive = true')
            .cache(true)
            .getOne();

            if (!user){
                this.logger.warn(`User with ID ${id} not found`);
                throw new NotFoundException(`User with ID ${id} not found`);

            }
            return user;
    }

    async createUser(dto: {
        email?: string;
        phoneNumber?: string;
        password: string;

    }): Promise<User> {
        let { email, phoneNumber, password} = dto;

        if (!email && !phoneNumber){
            throw new ConflictException('Email or phone number must be provided');
        }

        // normalize
        if (email) email = email.toLowerCase().trim();
        if (phoneNumber) phoneNumber = phoneNumber.replace(/\D/g, '');


        const exists = await this.findByEmailOrPhoneNumber(email ?? phoneNumber);
        if(exists){
            this.logger.warn(`Duplicate registration attempt: ${email ?? phoneNumber}`);
            throw new ConflictException('Email or phone number already in use');
        }

        const hashed = await bcrypt.hash(password, this.SALT_ROUNDS);
        const user = this.userRepository.create({
            email,
            phoneNumber,
            password: hashed,
        });

        try {
            this.logger.log(`Creating user: ${email ?? phoneNumber}`);
            return await this.userRepository.save(user);

        } catch (error){
            this.handleDatabaseError(error);
        }
    }

    async updateUser(id: string, updateData: DeepPartial<User>) : Promise<User>{
        await this.findById(id);

        if (updateData.password){
            updateData.password = await bcrypt.hash(updateData.password, this.SALT_ROUNDS);
        }
        
        if(updateData.email){
            updateData.email = updateData.email.toLowerCase().trim();
        }

        if (updateData.phoneNumber){
            updateData.phoneNumber = updateData.phoneNumber.replace(/\D/g, '');
        }

        try {
            this.logger.log(`Updating user:${id}`)
            await this.userRepository.update(id, updateData);
            return await this.findById(id);
        } catch (err){
            this.handleDatabaseError(err);
        }
    }


    async deleteUser(id: string) : Promise<void>{
        const user = await this.findById(id);
        user.isActive = false;
        this.logger.log(`soft deleting user: ${id}`);
        await this.userRepository.save(user)
    }

    private handleDatabaseError(error: any): never {
        if(error.code === '23505'){
            this.logger.error('Duplicate entry', error.stack);
            throw new ConflictException('Duplicate entry found');
        }
        this.logger.error('Db operation failed', error.stack);
        throw new InternalServerErrorException('Db operation failed, please try again later or contact support for help');
    }
    
    // Add this method to the UsersService class
    async findAllUsers(): Promise<User[]> {
      this.logger.log('Finding all users (including inactive)');
      return this.userRepository.find();
    }
    
    // Add to UsersService class
    async getUserStatistics() {
      return {
        totalUsers: await this.userRepository.count(),
        activeToday: await this.userRepository.createQueryBuilder()
          .where('lastLogin >= :date', { date: new Date(Date.now() - 86400000) })
          .getCount(),
        // Fix the property name or use a query builder approach
        verifiedUsers: await this.userRepository.createQueryBuilder('user')
          .where('user.isVerified = :verified', { verified: true })
          .getCount()
      };
    }
    
    async findAllUsersWithProfiles() {
      return this.userRepository.find({
        relations: ['profile'],
        select: ['id', 'email', 'phoneNumber', 'roles', 'createdAt']
      });
    }
    
    // Add these methods to your UsersService
    
    async countUsers(): Promise<number> {
      return this.userRepository.count();
    }
    
    // Keep only one implementation of markEmailAsVerified
    async markEmailAsVerified(userId: string): Promise<void> {
        this.logger.log(`Marking email as verified for user: ${userId}`);
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        await this.userRepository.update(userId, { 
            emailVerified: true 
        });
    }
    
    // Keep only one implementation of enableTwoFactor
    async enableTwoFactor(userId: string, secret: string): Promise<void> {
        this.logger.log(`Enabling 2FA for user: ${userId}`);
        await this.userRepository.update(userId, {
            twoFactorSecret: secret,
            twoFactorEnabled: true,
            tempTwoFactorSecret: null
        });
    }

    // Fix date query syntax
    async getUsersCreatedAfter(date: Date): Promise<number> {
        return this.userRepository.count({
            where: {
                createdAt: MoreThanOrEqual(date)
            }
        });
    }

    // Fix missing closing brace in updatePassword
    async updatePassword(userId: string, newPassword: string): Promise<void> {
        this.logger.log(`Updating password for user: ${userId}`);
        const user = await this.findById(userId);
        if (!user) {
            throw new NotFoundException(`User with ID ${userId} not found`);
        }
        const hashedPassword = await bcrypt.hash(newPassword, this.SALT_ROUNDS);
        await this.userRepository.update(userId, { 
            password: hashedPassword 
        });
    } // Added missing closing brace here

    async findByEmail(email: string): Promise<User | null> {
        this.logger.log(`Searching user by email: ${email}`);
        const normalizedEmail = email.trim().toLowerCase();
        
        const user = await this.userRepository
            .createQueryBuilder('user')
            .where('LOWER(user.email) = LOWER(:email)', {
                email: normalizedEmail,
            })
            .getOne();
        
        return user || null;
    }

    async storeTempSecret(userId: string, secret: string): Promise<void> {
      this.logger.log(`Storing temporary 2FA secret for user: ${userId}`);
      await this.userRepository.update(userId, { tempTwoFactorSecret: secret });
    }

    async disableTwoFactor(userId: string): Promise<void> {
      this.logger.log(`Disabling 2FA for user: ${userId}`);
      await this.userRepository.update(userId, {
        twoFactorSecret: null,
        twoFactorEnabled: false,
        tempTwoFactorSecret: null
      });
    }

    async updateProfile(userId: string, updateProfileDto: UpdateProfileDto) {
      this.logger.log(`Updating profile for user: ${userId}`);
      
      // Remove any sensitive fields that shouldn't be updated via this method
      const { password, ...safeUpdateData } = updateProfileDto as any;
      
      await this.userRepository.update(userId, safeUpdateData);
      return this.findById(userId);
    }

    async updateAvatar(userId: string, file: Express.Multer.File) {
      this.logger.log(`Updating avatar for user: ${userId}`);
      
      // Here you would typically:
      // 1. Upload the file to a storage service (S3, local filesystem, etc.)
      // 2. Get the URL of the uploaded file
      // 3. Update the user record with the avatar URL
      
      // For this example, we'll assume a simple path-based approach
      const avatarUrl = `/uploads/avatars/${userId}-${Date.now()}-${file.originalname}`;
      
      // Save the file to the filesystem (you'd need to implement this)
      // await this.fileService.saveFile(file.buffer, avatarUrl);
      
      // Update the user record
      await this.userRepository.update(userId, { avatarUrl });
      
      return {
        avatarUrl
      };
    }
}