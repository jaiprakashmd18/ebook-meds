import type { StructuredContent } from "@/lib/content/schema";

export const CONTENT_TYPES = [
  "study_note",
  "ebook",
  "revision_sheet",
  "exam_guide",
  "topic_summary",
  "question_bank",
  "bundle",
  "sample_chapter",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  study_note: "Study notes",
  ebook: "Ebook",
  revision_sheet: "Quick revision sheet",
  exam_guide: "Exam preparation guide",
  topic_summary: "Topic summary",
  question_bank: "Practice questions",
  bundle: "Subject bundle",
  sample_chapter: "Sample chapter",
};

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];
export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export const PUBLICATION_STATUSES = ["draft", "review", "published", "archived"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export type Subject = {
  id: string;
  name: string;
  slug: string;
  description: string;
  cover_image: string | null;
  published: boolean;
  sort_order: number;
};

export type Topic = {
  id: string;
  subject_id: string;
  name: string;
  slug: string;
};

/** Public catalog metadata for a content item. Never contains the note body. */
export type CatalogItem = {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  subject_id: string;
  subject: Pick<Subject, "id" | "name" | "slug"> | null;
  topic: Pick<Topic, "id" | "name" | "slug"> | null;
  content_type: ContentType;
  difficulty: Difficulty;
  cover_image: string | null;
  price_minor_units: number;
  currency: string;
  is_free: boolean;
  subscription_eligible: boolean;
  publication_status: PublicationStatus;
  estimated_reading_minutes: number;
  byline: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
  learning_objectives: string[];
  tags: string[];
  version_number: number | null;
  has_pdf: boolean;
  pdf_downloadable: boolean;
  published_at: string | null;
  updated_at: string;
  rating_average: number | null;
  rating_count: number;
  featured: boolean;
  /** For bundles: the items included. */
  bundle_item_ids?: string[];
};

export type CatalogSort = "relevance" | "newest" | "oldest" | "price_asc" | "price_desc" | "title";

export type CatalogFilters = {
  q?: string;
  subject?: string;
  topic?: string;
  difficulty?: Difficulty;
  type?: ContentType;
  price?: "free" | "paid";
  maxPrice?: number;
  publishedAfter?: string;
  sort?: CatalogSort;
  page?: number;
  pageSize?: number;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type ContentVersion = {
  id: string;
  content_item_id: string;
  version_number: number;
  structured_content: StructuredContent;
  pdf_storage_path: string | null;
  change_summary: string | null;
  created_at: string;
};
