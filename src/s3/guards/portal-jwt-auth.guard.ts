import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { verify } from 'jsonwebtoken';
import { Request } from 'express';
import { Company, CompanyDocument } from '../../company/schemas/company.schema';
import { Admin, AdminDocument } from '../../admin/schemas/admin.schema';
import { Assessor, AssessorDocument } from '../../company/schemas/assessor.schema';

type PortalUser = {
  userId: string;
  email?: string;
  role: 'company' | 'admin' | 'assessor';
};

@Injectable()
export class PortalJwtAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Admin.name) private readonly adminModel: Model<AdminDocument>,
    @InjectModel(Assessor.name) private readonly assessorModel: Model<AssessorDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: PortalUser }>();
    const token = this.extractBearer(req);
    if (!token) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Authorization required. Send Bearer token from company, admin, or assessor login.',
      });
    }

    const attempts: Array<{
      secret: string;
      role: PortalUser['role'];
      validate: (payload: { sub?: string; email?: string }) => Promise<PortalUser | null>;
    }> = [
      {
        secret: this.configService.get<string>('JWT_SECRET') || 'your-secret-key',
        role: 'company',
        validate: (p) => this.validateCompany(p),
      },
      {
        secret:
          this.configService.get<string>('ADMIN_JWT_SECRET') ||
          this.configService.get<string>('JWT_SECRET') ||
          'your-secret-key',
        role: 'admin',
        validate: (p) => this.validateAdmin(p),
      },
      {
        secret:
          this.configService.get<string>('ASSESSOR_JWT_SECRET') ||
          this.configService.get<string>('JWT_SECRET') ||
          'your-secret-key',
        role: 'assessor',
        validate: (p) => this.validateAssessor(p),
      },
    ];

    for (const attempt of attempts) {
      try {
        const payload = verify(token, attempt.secret) as { sub?: string; email?: string };
        const user = await attempt.validate(payload);
        if (user) {
          req.user = user;
          return true;
        }
      } catch {
        // try next secret / role
      }
    }

    throw new UnauthorizedException({
      status: 'error',
      message: 'Invalid or expired token.',
    });
  }

  private extractBearer(req: Request): string | null {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    const q = req.query?.token;
    return typeof q === 'string' && q.trim() ? q.trim() : null;
  }

  private async validateCompany(payload: {
    sub?: string;
    email?: string;
  }): Promise<PortalUser | null> {
    if (!payload?.sub || !Types.ObjectId.isValid(String(payload.sub))) {
      return null;
    }
    const company = await this.companyModel.findById(payload.sub).select('_id email').lean();
    if (!company) return null;
    return {
      userId: String(company._id),
      email: payload.email,
      role: 'company',
    };
  }

  private async validateAdmin(payload: {
    sub?: string;
    email?: string;
  }): Promise<PortalUser | null> {
    const subStr =
      payload?.sub === undefined || payload?.sub === null
        ? ''
        : String(payload.sub).trim();
    if (!subStr) return null;

    let admin = Types.ObjectId.isValid(subStr)
      ? await this.adminModel.findById(subStr).lean()
      : null;
    if (!admin && subStr.includes('@')) {
      admin = await this.adminModel.findOne({ email: subStr.toLowerCase() }).lean();
    }
    if (!admin || (admin as any).status !== '1') return null;
    return {
      userId: String(admin._id),
      email: (admin as any).email,
      role: 'admin',
    };
  }

  private async validateAssessor(payload: {
    sub?: string;
    email?: string;
  }): Promise<PortalUser | null> {
    if (!payload?.sub || !Types.ObjectId.isValid(String(payload.sub))) {
      return null;
    }
    const assessor = await this.assessorModel.findById(payload.sub).lean();
    if (!assessor || (assessor as any).status !== '1') return null;
    return {
      userId: String(assessor._id),
      email: payload.email,
      role: 'assessor',
    };
  }
}

/** Use on routes when S3 env is missing (clear 503 instead of opaque AWS errors). */
@Injectable()
export class S3ConfiguredGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(): boolean {
    const bucket = this.configService.get<string>('AWS_S3_BUCKET');
    const region = this.configService.get<string>('AWS_REGION');
    const keyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secret = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    if (bucket && region && keyId && secret) {
      return true;
    }
    throw new ServiceUnavailableException({
      status: 'error',
      message:
        'S3 is not configured on the server. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY.',
    });
  }
}
