import { verifyAdminSession } from '@/lib/admin-auth';
import { ENGINE, bridgeHeaders } from '@/lib/customer-bridge';
export { POST } from '../accounts/route';

// Legacy readers share the authoritative account ledger, never a second balance.
export async function GET(request: Request) {
  if (!(await verifyAdminSession(request))) return Response.json({error:'Unauthorized'}, {status:401});
  try {
    const response = await fetch(`${ENGINE}/internal/panel/admin/accounts`, {
      method:'POST', headers:bridgeHeaders(request), body:JSON.stringify({action:'state'}), cache:'no-store', signal:AbortSignal.timeout(30000),
    });
    return Response.json(await response.json(), {status:response.status, headers:{'cache-control':'no-store'}});
  } catch { return Response.json({error:'Accounts unavailable'}, {status:503}); }
}
