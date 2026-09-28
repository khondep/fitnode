// FitNode 2.0 — shared domain types (mirrors supabase/migrations schema).

export const APPLICATION_STATUSES = [
  "SAVED",
  "APPLIED",
  "RECRUITER_CONTACT",
  "OA",
  "INTERVIEW",
  "FINAL_ROUND",
  "OFFER",
  "REJECTED",
  "WITHDRAWN",
  "GHOSTED",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_EVENT_TYPES = [
  "JOB_SAVED",
  "APPLICATION_SUBMITTED",
  "RECRUITER_CONTACTED",
  "REFERRAL_RECEIVED",
  "OA_RECEIVED",
  "OA_COMPLETED",
  "INTERVIEW_SCHEDULED",
  "INTERVIEW_COMPLETED",
  "FOLLOWUP_SENT",
  "STATUS_CHANGED",
  "REJECTED",
  "OFFER_RECEIVED",
  "NOTE_ADDED",
] as const;
export type ApplicationEventType = (typeof APPLICATION_EVENT_TYPES)[number];

export const INTERVIEW_TYPES = [
  "PHONE_SCREEN",
  "RECRUITER_SCREEN",
  "TECHNICAL",
  "BEHAVIORAL",
  "SYSTEM_DESIGN",
  "ONSITE",
  "FINAL",
  "OTHER",
] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["OPEN", "COMPLETED"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_SOURCES = ["USER", "ENGINE", "AI"] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const CONTACT_RELATIONSHIPS = [
  "RECRUITER",
  "HIRING_MANAGER",
  "REFERRAL",
  "OTHER",
] as const;
export type ContactRelationship = (typeof CONTACT_RELATIONSHIPS)[number];

export const RESUME_TYPES = ["MASTER", "TAILORED", "OTHER"] as const;
export type ResumeType = (typeof RESUME_TYPES)[number];

// ---- Row shapes (match the SQL schema) ----

export type JobRow = {
  id: string;
  user_id: string;
  source: string;
  external_id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  url: string;
  posted_at: string;
  employment_type: string | null;
  created_at: string;
};

export type ResumeRow = {
  id: string;
  user_id: string;
  file_path: string;
  raw_text: string;
  name: string | null;
  version: number | null;
  resume_type: ResumeType | null;
  created_at: string;
};

export type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  company: string | null;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship: ContactRelationship | null;
  notes: string | null;
  last_contacted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationRow = {
  id: string;
  user_id: string;
  job_id: string;
  status: ApplicationStatus;
  date_saved: string;
  date_applied: string | null;
  resume_version_id: string | null;
  source: string | null;
  referral_contact_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationEventRow = {
  id: string;
  user_id: string;
  application_id: string;
  event_type: ApplicationEventType;
  event_date: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type InterviewRow = {
  id: string;
  user_id: string;
  application_id: string;
  type: InterviewType;
  status: InterviewStatus;
  scheduled_at: string | null;
  duration_minutes: number | null;
  meeting_url: string | null;
  interviewer: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type TaskRow = {
  id: string;
  user_id: string;
  application_id: string | null;
  title: string;
  description: string | null;
  priority: TaskPriority;
  due_at: string | null;
  status: TaskStatus;
  source: TaskSource;
  created_at: string;
  completed_at: string | null;
};

// Application aggregate returned by GET /api/applications/[id]
export type ApplicationDetail = ApplicationRow & {
  job: Pick<
    JobRow,
    "id" | "title" | "company" | "location" | "url" | "description" | "posted_at" | "source"
  > | null;
  resume_version: Pick<ResumeRow, "id" | "name" | "version" | "resume_type"> | null;
  referral_contact: Pick<ContactRow, "id" | "name" | "role" | "company" | "email" | "linkedin_url" | "last_contacted_at"> | null;
  interviews: InterviewRow[];
  tasks: TaskRow[];
  events: ApplicationEventRow[];
};
