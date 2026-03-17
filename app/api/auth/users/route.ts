import { requireAdmin, AuthError } from '@/lib/auth/guards';
import { getAllUsers } from '@/lib/supabase/users';
import { apiSuccess, ERR } from '@/lib/api/response';

async function handleFetchUsers() {
  try {
    await requireAdmin();
  } catch (error) {
    if (error instanceof AuthError) {
      return error.status === 401 ? ERR.UNAUTHORIZED() : ERR.FORBIDDEN();
    }
    return ERR.UNAUTHORIZED();
  }

  const allUsers = await getAllUsers();

  const users = allUsers.map(u => ({
    Email: u.email || '',
    Role: u.role || 'user',
    'Tên': u.name || '',
    Level: u.member_level || 'Free',
    Phone: u.phone || '',
  }));

  return apiSuccess({ users, source: 'supabase' });
}

export async function GET() {
  return handleFetchUsers();
}

export async function POST() {
  return handleFetchUsers();
}
