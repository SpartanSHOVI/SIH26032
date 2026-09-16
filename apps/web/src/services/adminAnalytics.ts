/**
 * Admin Analytics Data Transformations and Visualizations Contract
 * Supporting real /admin/analytics endpoint payload from Backend prompt 2/4.
 */

export interface CenterAnalyticsMetric {
  id?: string;
  name?: string;
  code?: string;
  center_id: string;
  center_name: string;
  centerName: string;
  state?: string;
  district?: string;
  total_bookings: number;
  bookings: number;
  capacity: number;
  utilization_pct: number;
  utilizationPct: number;
  completed: number;
  completion_rate_pct: number;
  completionRatePct: number;
  waiting: number;
  rejected: number;
  avg_wait_time_mins: number;
  avgWaitMins: number;
  status: 'Normal' | 'Moderate' | 'Congested' | 'Critical';
  [key: string]: any;
}

/**
 * Calculates bookings vs. capacity metrics per center
 */
export function computeBookingsVsCapacity(centers: any[] = []): CenterAnalyticsMetric[] {
  return centers.map((c) => {
    const bookings = Number(c.total_bookings ?? c.todays_farmers ?? c.bookings ?? 0);
    const capacity = Number(c.capacity ?? (c.capacity_per_hour ? c.capacity_per_hour * 7 : 175));
    const utilizationPct = capacity > 0 ? Number(((bookings / capacity) * 100).toFixed(1)) : 0;
    const completed = Number(c.completed ?? 0);
    const waiting = Number(c.waiting ?? 0);
    const rejected = Number(c.rejected ?? 0);
    const completionRatePct = bookings > 0 ? Number(((completed / bookings) * 100).toFixed(1)) : 0;
    const avgWait = Number(c.avg_wait_time_mins ?? c.avgWaitMins ?? (waiting === 0 ? 0 : Math.max(3, Math.round((waiting * 7) / (c.counters || 2)))));

    const status: 'Normal' | 'Congested' | 'Critical' =
      utilizationPct >= 90 ? 'Critical' : utilizationPct >= 75 ? 'Congested' : 'Normal';

    const name = String(c.center_name || c.name || c.centerName || 'Center');

    return {
      center_id: String(c.center_id || c.id || ''),
      center_name: name,
      centerName: name,
      state: c.state ? String(c.state) : undefined,
      district: c.district ? String(c.district) : undefined,
      total_bookings: bookings,
      bookings,
      capacity,
      utilization_pct: utilizationPct,
      utilizationPct,
      completed,
      completion_rate_pct: completionRatePct,
      completionRatePct,
      waiting,
      rejected,
      avg_wait_time_mins: avgWait,
      avgWaitMins: avgWait,
      status: c.status || status,
    };
  });
}

/**
 * Extracts average wait time trends across centers and operational hours
 */
export function computeWaitTimeTrends(
  centers: any[] = [],
  hourlySlots: any[] = [],
) {
  return centers.map((c) => {
    const waiting = Number(c.waiting ?? 0);
    const waitMins = Number(c.avg_wait_time_mins ?? c.avgWaitMins ?? (waiting === 0 ? 0 : Math.max(3, Math.round((waiting * 7) / (c.counters || 2)))));
    const name = String(c.center_name || c.name || c.centerName || 'Center');
    return {
      label: name,
      center_name: name,
      centerName: name,
      wait_mins: waitMins,
      avgWaitMins: waitMins,
      avg_wait_time_mins: waitMins,
      waiting_farmers: waiting,
      status: c.status || (waitMins >= 45 ? 'Congested' : 'Normal'),
    };
  });
}

/**
 * Computes procurement completion rate percentage per center and system-wide
 */
export function computeCompletionRates(centers: any[] = []) {
  return centers.map((c) => {
    const bookings = Number(c.total_bookings ?? c.todays_farmers ?? c.bookings ?? 0);
    const completed = Number(c.completed ?? 0);
    const rate = bookings > 0 ? Number(((completed / bookings) * 100).toFixed(1)) : 0;
    const name = String(c.center_name || c.name || c.centerName || 'Center');
    return {
      center_id: String(c.center_id || c.id || ''),
      center_name: name,
      centerName: name,
      total_bookings: bookings,
      totalBookings: bookings,
      completed,
      completion_rate_pct: rate,
      completionRatePct: rate,
    };
  });
}

export type CenterAnalyticsItem = Partial<CenterAnalyticsMetric> & {
  id?: string;
  name?: string;
  code?: string;
  capacity?: number;
  total_bookings?: number;
  completed?: number;
  waiting?: number;
  [key: string]: any;
};

/**
 * Formats an honest zero-data state for a center with no bookings.
 * Ensures zero fabricated placeholder numbers (no 12,450 or random defaults).
 */
export function formatZeroStateCenter(center: any): CenterAnalyticsMetric {
  const cap = Number(center.capacity ?? (center.capacity_per_hour ? center.capacity_per_hour * 7 : 175));
  const name = String(center.center_name || center.name || 'Empty Mandi');
  return {
    center_id: String(center.center_id || center.id || ''),
    center_name: name,
    centerName: name,
    state: center.state,
    district: center.district,
    total_bookings: 0,
    bookings: 0,
    capacity: cap,
    utilization_pct: 0.0,
    utilizationPct: 0.0,
    completed: 0,
    completion_rate_pct: 0.0,
    completionRatePct: 0.0,
    waiting: 0,
    rejected: 0,
    avg_wait_time_mins: 0,
    avgWaitMins: 0,
    status: 'Normal',
  };
}
