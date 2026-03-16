/**
 * One-way sync: Supabase → Google Sheet (background, non-blocking)
 * Google Sheet is used as a backup/reporting tool, NOT as a data source.
 *
 * All sync functions are fire-and-forget — they log errors but never throw.
 */

const SYNC_TIMEOUT = 15000;

function getScriptUrl(): string | null {
  return process.env.GOOGLE_SCRIPT_URL || null;
}

async function callScript(params: Record<string, string>): Promise<boolean> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

  try {
    const qs = new URLSearchParams(params);
    const url = `${scriptUrl}?${qs.toString()}`;
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return !!json.success;
    } catch {
      return res.ok;
    }
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[SheetSync] Call failed:', msg);
    return false;
  }
}

/**
 * Sync a new user registration to Google Sheet (background)
 */
export function syncUserToSheet(user: {
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
}): void {
  callScript({
    action: 'register',
    name: user.name,
    email: user.email,
    passwordHash: user.passwordHash,
    phone: user.phone || '',
  }).then(ok => {
    if (ok) console.log('[SheetSync] User synced to Sheet:', user.email);
    else console.warn('[SheetSync] User sync failed for:', user.email);
  }).catch(() => {});
}

/**
 * Sync an order to Google Sheet (background)
 */
export function syncOrderToSheet(order: {
  timestamp: string;
  orderId: string;
  name: string;
  email: string;
  phone: string;
  courseNames: string;
  courseIds: string;
  total: number;
  paymentMethod: string;
}): void {
  const rowData = [
    order.timestamp,
    order.orderId,
    order.name,
    order.email,
    order.phone,
    order.courseNames,
    order.courseIds,
    String(order.total),
    order.paymentMethod,
    'Đang chờ xử lý',
    '',
  ];

  callScript({
    action: 'appendOrder',
    rowData: JSON.stringify(rowData),
  }).then(ok => {
    if (ok) console.log('[SheetSync] Order synced to Sheet:', order.orderId);
    else console.warn('[SheetSync] Order sync failed for:', order.orderId);
  }).catch(() => {});
}

/**
 * Sync course data to Google Sheet (background)
 */
export function syncCourseToSheet(course: {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
}): void {
  callScript({
    action: 'updateCourse',
    courseId: course.id,
    title: course.title,
    description: course.description || '',
    price: String(course.price || 0),
    category: course.category || '',
  }).then(ok => {
    if (ok) console.log('[SheetSync] Course synced to Sheet:', course.id);
  }).catch(() => {});
}

/**
 * Sync enrollment to Google Sheet (background)
 */
export function syncEnrollmentToSheet(email: string, courseId: string): void {
  callScript({
    action: 'enrollCourse',
    userId: email,
    courseId,
  }).then(ok => {
    if (ok) console.log('[SheetSync] Enrollment synced to Sheet:', email, courseId);
  }).catch(() => {});
}

/**
 * Sync progress to Google Sheet (background)
 */
export function syncProgressToSheet(email: string, courseId: string, lessonId: string, progress: number): void {
  callScript({
    action: 'updateProgress',
    userId: email,
    courseId,
    lessonId: lessonId || '',
    progress: String(progress),
  }).then(() => {}).catch(() => {});
}

/**
 * Sync review to Google Sheet (background)
 */
export function syncReviewToSheet(review: {
  userEmail: string;
  userName: string;
  courseId: string;
  rating: number;
  content: string;
}): void {
  callScript({
    action: 'saveReview',
    userId: review.userEmail,
    userEmail: review.userEmail,
    userName: review.userName,
    courseId: review.courseId,
    rating: String(review.rating),
    content: review.content || '',
  }).then(() => {}).catch(() => {});
}
