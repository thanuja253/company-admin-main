import { Body, Controller, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { CompanyProjectsService } from './company-projects.service';

/**
 * Legacy compatibility routes used by existing frontend clients.
 * Mirrors /api/company/projects/:projectId/primary-data/save behavior.
 */
@Controller(['company/primary-data', 'company/primary_data'])
export class CompanyPrimaryDataLegacyController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  @Post('save/:projectId')
  @UseGuards(JwtAuthGuard, AccountStatusGuard)
  async savePrimaryDataLegacy(
    @Request() req,
    @Param('projectId') projectId: string,
    @Body() body: { form_type?: string; data?: any; doc?: any[]; final_submit?: boolean; [key: string]: any },
  ): Promise<any> {
    const formType = body?.form_type ?? 'all';
    const payload = body?.data ?? body?.doc ?? (formType && body?.[formType]) ?? body;
    return this.companyProjectsService.savePrimaryDataBySection(
      req.user.userId,
      projectId,
      formType,
      payload,
      body?.final_submit,
    );
  }
}
