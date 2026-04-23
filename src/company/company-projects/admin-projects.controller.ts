import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CompanyProjectsService } from './company-projects.service';
import { AdminJwtAuthGuard } from '../../admin/admin-auth/guards/admin-jwt-auth.guard';
import { PrimaryDataSectionReviewDto } from './dto/primary-data-review.dto';

/**
 * Admin dashboard routes under `/api/admin/projects` (and legacy `/admin/projects` for proxies).
 */
@Controller(['api/admin/projects', 'admin/projects'])
export class AdminProjectsController {
  constructor(private readonly companyProjectsService: CompanyProjectsService) {}

  private normalizeApprovalStatus(body: any): number {
    const raw = body?.approval_status ?? body?.approvalStatus ?? body?.status;
    const parsed = Number(raw);
    if (Number.isFinite(parsed) && [0, 1, 2, 3].includes(parsed)) return parsed;
    return 0;
  }

  private extractRemarks(body: any): string | undefined {
    const raw = body?.remarks ?? body?.approval_remarks ?? body?.approvalRemarks;
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length ? trimmed : undefined;
  }

  /**
   * GET /api/admin/projects/:projectId/launch-training-program
   * Legacy: GET /admin/projects/:projectId/launch-training-program
   *
   * Reads all Launch & Training session uploads plus legacy single-document fields.
   * `:projectId` may be project Mongo _id or company _id (resolved to latest project).
   */
  @Get(':projectId/launch-training-program')
  @UseGuards(AdminJwtAuthGuard)
  async getLaunchTrainingProgram(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }

  /**
   * GET /api/admin/projects/:projectId/launch-training
   * Alias of {@link getLaunchTrainingProgram} — same JSON. Prefer `launch-training-program` for new code;
   * many local frontends still call this path.
   */
  @Get(':projectId/launch-training')
  @UseGuards(AdminJwtAuthGuard)
  async getLaunchTraining(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getLaunchTrainingProgramForAdmin(projectId);
  }

  /**
   * Primary-data section review state only (`section_reviews` + labels; no full form rows).
   * GET /api/admin/projects/:projectId/primary-data/review
   * No admin JWT guard (portal callers use this path).
   */
  @Get(':projectId/primary-data/review')
  async getPrimaryDataSectionReviews(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getPrimaryDataSectionReviewsForAdmin(projectId);
  }

  /**
   * Registration payload + masters (same as GET .../admin/registration-data on company routes).
   * GET /api/admin/projects/:projectId/registration-date
   * Alias for dashboards that expect this path; no admin JWT (portal callers).
   */
  @Get(':projectId/registration-date')
  async getRegistrationDateAlias(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getRegistrationInfoForAdmin(projectId);
  }

  /**
   * Admin: Primary Data (same payload as company endpoint).
   * GET /api/admin/projects/:projectId/primary-data
   * Legacy: GET /admin/projects/:projectId/primary-data
   * No admin JWT guard (portal callers use this path).
   */
  @Get(':projectId/primary-data')
  async getPrimaryDataForAdmin(@Param('projectId') projectId: string): Promise<any> {
    return this.companyProjectsService.getPrimaryDataForAdmin(projectId);
  }

  /**
   * Admin: review one primary-data section (accepted/rejected/under_review).
   * PATCH /api/admin/projects/:projectId/primary-data/review
   * No admin JWT guard (portal callers use this path).
   */
  @Patch(':projectId/primary-data/review')
  async reviewPrimaryDataSection(
    @Param('projectId') projectId: string,
    @Body() dto: PrimaryDataSectionReviewDto,
  ): Promise<any> {
    return this.companyProjectsService.reviewPrimaryDataSectionAsAdmin(
      projectId,
      dto.info_type,
      dto.status,
      dto.remarks,
    );
  }

  @Patch(':projectId/proforma-invoices/:invoiceId/approval')
  @Patch(':projectId/tax-invoices/:invoiceId/approval')
  @Patch(':projectId/finance-v2/proforma-invoices/:invoiceId/approval')
  @Patch(':projectId/finance-v2/tax-invoices/:invoiceId/approval')
  @Patch(':projectId/finance/v2/proforma-invoices/:invoiceId/approval')
  @Patch(':projectId/finance/v2/tax-invoices/:invoiceId/approval')
  @Post(':projectId/proforma-invoices/:invoiceId/approval')
  @Post(':projectId/tax-invoices/:invoiceId/approval')
  @Post(':projectId/finance-v2/proforma-invoices/:invoiceId/approval')
  @Post(':projectId/finance-v2/tax-invoices/:invoiceId/approval')
  @Post(':projectId/finance/v2/proforma-invoices/:invoiceId/approval')
  @Post(':projectId/finance/v2/tax-invoices/:invoiceId/approval')
  @Patch(':projectId/proforma-invoices/:invoiceId/approve')
  @Patch(':projectId/tax-invoices/:invoiceId/approve')
  @Patch(':projectId/finance-v2/proforma-invoices/:invoiceId/approve')
  @Patch(':projectId/finance-v2/tax-invoices/:invoiceId/approve')
  @Patch(':projectId/finance/v2/proforma-invoices/:invoiceId/approve')
  @Patch(':projectId/finance/v2/tax-invoices/:invoiceId/approve')
  @Post(':projectId/proforma-invoices/:invoiceId/approve')
  @Post(':projectId/tax-invoices/:invoiceId/approve')
  @Post(':projectId/finance-v2/proforma-invoices/:invoiceId/approve')
  @Post(':projectId/finance-v2/tax-invoices/:invoiceId/approve')
  @Post(':projectId/finance/v2/proforma-invoices/:invoiceId/approve')
  @Post(':projectId/finance/v2/tax-invoices/:invoiceId/approve')
  async updateInvoiceApprovalCompat(
    @Param('projectId') projectId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() body: any,
  ): Promise<any> {
    const approvalStatus = this.normalizeApprovalStatus(body);
    const remarks = this.extractRemarks(body);
    return this.companyProjectsService.updateInvoiceApprovalStatusOpen(
      projectId,
      invoiceId,
      approvalStatus,
      remarks,
    );
  }
}
