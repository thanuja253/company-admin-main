import { Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { AccountStatusGuard } from '../company-auth/guards/account-status.guard';
import { JwtAuthGuard } from '../company-auth/guards/jwt-auth.guard';
import { CompanyProjectsService } from './company-projects.service';

/**
 * Legacy compatibility routes used by existing frontend clients.
 * Mirrors /api/company/projects/:projectId/primary-data/save behavior.
 */
@Controller([
  'api/company/primary-data',
  'api/company/primary_data',
  'company/primary-data',
  'company/primary_data',
])
export class CompanyPrimaryDataLegacyController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  /**
   * GET /api/company/primary-data/:projectId — same behavior as GET .../api/company/projects/:id/primary-data
   * (company JWT or open admin-style resolve).
   */
  @Get(':projectId')
  async getPrimaryDataLegacy(
    @Request() req,
    @Param('projectId') projectId: string,
  ): Promise<any> {
    const companyId = req?.user?.userId;
    if (companyId) {
      return this.companyProjectsService.getPrimaryData(companyId, projectId);
    }
    return this.companyProjectsService.getPrimaryDataForAdmin(projectId);
  }

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
