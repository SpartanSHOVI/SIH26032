export interface OutboxJobData {
  outboxId: string;
  eventType: string;
  aggregateId: string;
  payload: Record<string, any>;
  simulateFailure?: boolean;
}

export interface QueueMetricsResult {
  queue_name: string;
  counts: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  };
  total_depth: number;
  dead_letter_count: number;
}

export interface DeadLetterJobDto {
  job_id?: string;
  name: string;
  outbox_id?: string;
  event_type?: string;
  failed_reason?: string;
  attempts_made: number;
  timestamp?: number;
  processed_on?: number;
  failed_on?: number;
  data: Record<string, any>;
}
