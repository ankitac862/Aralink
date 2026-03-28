/**
 * Applicant invite / password recovery — canonical route per Supabase redirect_to.
 * Same screen as invite-auth (legacy path); email links should use /set-password.
 */
export { default } from './invite-auth';
