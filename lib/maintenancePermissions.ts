// =====================================================
// Centralized permission rules for maintenance requests
// =====================================================

export type MaintenanceCreatorRole = 'tenant' | 'landlord' | 'manager';

/** Who can approve a request (accept/reject) */
export function canApprove(role: MaintenanceCreatorRole): boolean {
  return role === 'landlord' || role === 'manager';
}

/** Who can change request status */
export function canChangeStatus(role: MaintenanceCreatorRole): boolean {
  return role === 'landlord' || role === 'manager';
}

/** Who can assign a vendor */
export function canAssignVendor(role: MaintenanceCreatorRole): boolean {
  return role === 'landlord' || role === 'manager';
}

/** Who can add resolution notes */
export function canAddResolutionNotes(role: MaintenanceCreatorRole): boolean {
  return role === 'landlord' || role === 'manager';
}

/** Who can create a maintenance request */
export function canCreateRequest(_role: MaintenanceCreatorRole): boolean {
  return true;
}

/** Initial status based on who creates the request */
export function getInitialStatus(creatorRole: MaintenanceCreatorRole): string {
  switch (creatorRole) {
    case 'landlord':
    case 'manager':
      return 'in_progress';
    default:
      return 'under_review';
  }
}

/** Activity log message for request creation */
export function getCreationActivityMessage(creatorRole: MaintenanceCreatorRole): string {
  switch (creatorRole) {
    case 'landlord':
      return 'Request created by landlord.';
    case 'manager':
      return 'Request created by property manager.';
    default:
      return 'Request submitted by tenant and is under review.';
  }
}

/** Error message when a tenant tries to perform a restricted action */
export const TENANT_PERMISSION_ERROR =
  'Tenants are not permitted to perform this action.';
