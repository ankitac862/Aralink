-- =====================================================
-- CLEANUP OLD APPLICATION AND NOTIFICATION DATA
-- Run this to clear test data before fixing the flow
-- =====================================================

-- Delete all applications (this will cascade to related records)
DELETE FROM public.applications;

-- Delete application-related notifications
DELETE FROM public.notifications 
WHERE type IN ('application', 'application_approved', 'application_rejected');

-- Delete applicant invites and related data
DELETE FROM public.applicants;

-- Reset invite status for pending invites (optional - comment out if you want to keep invites)
-- UPDATE public.invites SET status = 'expired' WHERE status = 'pending';

-- Verify cleanup
SELECT 'applications' as table_name, COUNT(*) as remaining_records FROM public.applications
UNION ALL
SELECT 'applicants', COUNT(*) FROM public.applicants
UNION ALL
SELECT 'application notifications', COUNT(*) FROM public.notifications WHERE type IN ('application', 'application_approved', 'application_rejected');

RAISE NOTICE 'Cleanup complete! All old application data has been removed.';
