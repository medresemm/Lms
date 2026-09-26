import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, jsonb, pgTable, real, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const coursesTable = pgTable("lms_courses", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  instructor: text("instructor").notNull(),
  progress: integer("progress").notNull().default(0),
  completedLessons: integer("completed_lessons").notNull().default(0),
  totalLessons: integer("total_lessons").notNull().default(0),
  color: text("color").notNull().default("teal"),
  nextLesson: text("next_lesson"),
  pdfUrl: text("pdf_url"),
  telegramUrl: text("telegram_url"),
  zoomUrl: text("zoom_url"),
  googleMeetUrl: text("google_meet_url"),
  lessonUrl: text("lesson_url"),
  description: text("description").notNull(),
  curriculum: text("curriculum").array().notNull().default([]),
  lessonDescription: text("lesson_description").notNull(),
  lessonDays: text("lesson_days").array().notNull().default([]),
  lessonTime: text("lesson_time"),
  gradingComponents: text("grading_components").array().notNull().default([]),
  credits: real("credits").notNull().default(3),
  hours: integer("hours").notNull().default(45),
});

export const announcementsTable = pgTable("lms_announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  date: text("date").notNull(),
  type: text("type").notNull().default("info"),
});

export const articlesTable = pgTable("lms_articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull(),
  body: text("body").notNull(),
  author: text("author").notNull(),
  createdAt: text("created_at").notNull(),
});

export const dailyBenefitsTable = pgTable("lms_daily_benefits", {
  id: serial("id").primaryKey(),
  body: text("body").notNull(),
  source: text("source").notNull(),
  dayOfWeek: text("day_of_week").notNull().default("monday"),
  createdAt: text("created_at").notNull(),
});

export const resourcesTable = pgTable("lms_resources", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  termNumber: integer("term_number").notNull().default(1),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  url: text("url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lessonDays: text("lesson_days").array().notNull().default([]),
  lessonTime: text("lesson_time"),
  isMandatory: boolean("is_mandatory").notNull().default(true),
  teacherClerkUserId: text("teacher_clerk_user_id"),
  studentCapacity: integer("student_capacity").notNull().default(0),
}, (table) => ({
  validTermNumber: check("lms_resources_term_number_check", sql`${table.termNumber} BETWEEN 1 AND 8`),
}));

export const studentTeacherChoicesTable = pgTable("lms_student_teacher_choices", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  resourceId: integer("resource_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
}, (table) => ({
  profileResourceUnique: uniqueIndex("lms_student_teacher_choices_profile_resource_unique").on(table.profileId, table.resourceId),
  profileStatusIndex: index("lms_student_teacher_choices_profile_status_idx").on(table.profileId, table.status),
  resourceStatusIndex: index("lms_student_teacher_choices_resource_status_idx").on(table.resourceId, table.status),
}));

export const studentCourseSelectionsTable = pgTable("lms_student_course_selections", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  courseId: integer("course_id").notNull(),
  termNumber: integer("term_number").notNull(),
  selected: boolean("selected").notNull().default(true),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  profileCourseTermUnique: uniqueIndex("lms_student_course_selections_profile_course_term_unique")
    .on(table.profileId, table.courseId, table.termNumber),
}));

export const subjectRemovalRequestsTable = pgTable("lms_subject_removal_requests", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  courseId: integer("course_id").notNull(),
  termNumber: integer("term_number").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  createdAt: text("created_at").notNull(),
  reviewedAt: text("reviewed_at"),
});

export const applicationsTable = pgTable("lms_applications", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: text("username").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  birthDate: text("birth_date").notNull(),
  arabicLevel: text("arabic_level").notNull(),
  recommendationPaths: text("recommendation_paths").array().notNull(),
  recommendationNames: text("recommendation_names").array().notNull(),
  clerkUserId: text("clerk_user_id"),
  status: text("status").notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
}, (table) => ({
  clerkUserUnique: uniqueIndex("lms_applications_clerk_user_unique").on(table.clerkUserId),
  validStatus: check("lms_applications_status_check", sql`${table.status} IN ('pending', 'approved', 'rejected', 'graduated')`),
}));

export const graduateCertificatesTable = pgTable("lms_graduate_certificates", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  graduationTerm: integer("graduation_term").notNull(),
  gpa: real("gpa").notNull().default(0),
  graduationCategory: text("graduation_category").notNull().default("Zəif"),
  certificateNumber: text("certificate_number").notNull(),
  verificationToken: text("verification_token").notNull(),
  issuedAt: text("issued_at").notNull(),
  revokedAt: text("revoked_at"),
  verificationLocked: boolean("verification_locked").notNull().default(false),
  directorTitle: text("director_title").notNull().default("Akademiya Rəhbəri"),
  directorName: text("director_name").notNull().default("Fərman İsayev"),
  showDirector: boolean("show_director").notNull().default(true),
  showSeal: boolean("show_seal").notNull().default(true),
  showGpa: boolean("show_gpa").notNull().default(true),
  showGraduationCategory: boolean("show_graduation_category").notNull().default(true),
  certificateTitle: text("certificate_title").notNull().default("MƏZUN ŞƏHADƏTNAMƏSİ"),
  bodyText: text("body_text").notNull().default("Bu şəhadətnamə ilə təsdiq olunur ki, yuxarıda adı qeyd olunan məzun {term}-ci semestr üzrə akademik proqramı uğurla tamamlamışdır."),
  honorText: text("honor_text").notNull().default("Akademiyanın tədris və qiymətləndirmə tələblərinə uyğun olaraq məzun elan edilmişdir."),
}, (table) => ({
  profileUnique: uniqueIndex("lms_graduate_certificates_profile_unique").on(table.profileId),
  certificateNumberUnique: uniqueIndex("lms_graduate_certificates_number_unique").on(table.certificateNumber),
  verificationTokenUnique: uniqueIndex("lms_graduate_certificates_token_unique").on(table.verificationToken),
}));

export const applicationSettingsTable = pgTable("lms_application_settings", {
  id: integer("id").primaryKey().default(1),
  opensAt: text("opens_at"),
  closesAt: text("closes_at"),
  statisticsVisible: boolean("statistics_visible").notNull().default(false),
  admissionExamRequired: boolean("admission_exam_required").notNull().default(false),
  semesterDates: text("semester_dates").notNull().default("{}"),
  updatedAt: text("updated_at").notNull(),
});

export const studentDeletionAuditTable = pgTable("lms_student_deletion_audit", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  applicationId: integer("application_id").notNull(),
  studentClerkUserId: text("student_clerk_user_id").notNull(),
  studentFirstName: text("student_first_name").notNull(),
  studentLastName: text("student_last_name").notNull(),
  studentEmail: text("student_email").notNull(),
  reason: text("reason").notNull(),
  deletedByClerkUserId: text("deleted_by_clerk_user_id").notNull(),
  deletedByName: text("deleted_by_name").notNull(),
  deletedAt: text("deleted_at").notNull(),
});

export const applicationUploadIntentsTable = pgTable("lms_application_upload_intents", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  expiresAt: text("expires_at").notNull(),
  usedAt: text("used_at"),
});

/** Immutable security/audit trail for privileged and high-impact LMS mutations. */
export const auditEventsTable = pgTable("lms_audit_events", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  actorClerkUserId: text("actor_clerk_user_id").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
  deduplicationKey: text("deduplication_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  deduplicationUnique: uniqueIndex("lms_audit_events_deduplication_unique").on(table.deduplicationKey),
}));

export const studentAcademicProfilesTable = pgTable("lms_student_academic_profiles", {
  id: serial("id").primaryKey(),
  studentNumber: serial("student_number").notNull().unique(),
  applicationId: integer("application_id").notNull(),
  clerkUserId: text("clerk_user_id").notNull(),
  courseYear: integer("course_year").notNull().default(1),
  semester: integer("semester").notNull().default(1),
  program: text("program").notNull().default("İslam elmləri proqramı"),
  scheduleAccessApproved: boolean("schedule_access_approved").notNull().default(false),
  onboardingExamEligible: boolean("onboarding_exam_eligible").notNull().default(false),
  promotionApprovedAt: text("promotion_approved_at"),
  promotionApprovedBy: text("promotion_approved_by"),
  promotionFromTerm: integer("promotion_from_term"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  applicationUnique: uniqueIndex("lms_student_academic_profiles_application_unique").on(table.applicationId),
  clerkUserUnique: uniqueIndex("lms_student_academic_profiles_clerk_user_unique").on(table.clerkUserId),
}));

export const studentGradesTable = pgTable("lms_student_grades", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  courseId: integer("course_id").notNull(),
  termNumber: integer("term_number").notNull(),
  gradePoints: integer("grade_points"),
  componentGrades: text("component_grades"),
  updatedAt: text("updated_at").notNull(),
}, (table) => ({
  profileCourseTermUnique: uniqueIndex("lms_student_grades_profile_course_term_unique")
    .on(table.profileId, table.courseId, table.termNumber),
}));

export const studentAttendanceRecordsTable = pgTable("lms_student_attendance_records", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  courseId: integer("course_id").notNull(),
  termNumber: integer("term_number").notNull(),
  attendanceDate: text("attendance_date").notNull(),
  status: text("status").notNull().default("present"),
  teacherName: text("teacher_name").notNull(),
  recordedAt: text("recorded_at").notNull(),
}, (table) => ({
  profileCourseDateUnique: uniqueIndex("lms_student_attendance_records_profile_course_date_unique")
    .on(table.profileId, table.courseId, table.attendanceDate),
  validTermNumber: check("lms_student_attendance_records_term_number_check", sql`${table.termNumber} BETWEEN 1 AND 8`),
}));

/** Server-timestamped evidence that a student followed a scheduled live lesson link. */
export const lessonJoinEventsTable = pgTable("lms_lesson_join_events", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull(),
  profileId: integer("profile_id").notNull(),
  termNumber: integer("term_number").notNull(),
  sessionDate: text("session_date").notNull(),
  joinedAt: text("joined_at").notNull(),
  punctuality: text("punctuality").notNull(),
}, (table) => ({
  resourceProfileDateUnique: uniqueIndex("lms_lesson_join_events_resource_profile_date_unique")
    .on(table.resourceId, table.profileId, table.sessionDate),
  validTermNumber: check("lms_lesson_join_events_term_number_check", sql`${table.termNumber} BETWEEN 1 AND 8`),
}));

export const attendanceExcusesTable = pgTable("lms_attendance_excuses", {
  id: serial("id").primaryKey(),
  attendanceRecordId: integer("attendance_record_id").notNull().unique(),
  profileId: integer("profile_id").notNull(),
  courseId: integer("course_id").notNull(),
  termNumber: integer("term_number").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: text("created_at").notNull(),
});

export const messagesTable = pgTable("lms_messages", {
  id: serial("id").primaryKey(),
  senderClerkUserId: text("sender_clerk_user_id").notNull(),
  recipientClerkUserId: text("recipient_clerk_user_id").notNull(),
  subject: text("subject").notNull().default("Məsləhətləşmə"),
  body: text("body").notNull(),
  parentMessageId: integer("parent_message_id"),
  readAt: text("read_at"),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
});

export const questionsTable = pgTable("lms_questions", {
  id: serial("id").primaryKey(),
  authorClerkUserId: text("author_clerk_user_id").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  answer: text("answer"),
  answeredByClerkUserId: text("answered_by_clerk_user_id"),
  answeredByName: text("answered_by_name"),
  answeredAt: text("answered_at"),
  createdAt: text("created_at").notNull(),
});

export const studentNotificationsTable = pgTable("lms_student_notifications", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  targetTerms: integer("target_terms").array().notNull(),
  targetProfileIds: integer("target_profile_ids").array().notNull().default([]),
  destination: text("destination").notNull().default("home"),
  senderClerkUserId: text("sender_clerk_user_id").notNull(),
  createdAt: text("created_at").notNull(),
});

export const studentNotificationDismissalsTable = pgTable("lms_student_notification_dismissals", {
  id: serial("id").primaryKey(),
  notificationId: integer("notification_id").notNull(),
  profileId: integer("profile_id").notNull(),
  dismissedAt: text("dismissed_at").notNull(),
}, (table) => ({
  notificationProfileUnique: uniqueIndex("lms_student_notification_dismissal_unique").on(table.notificationId, table.profileId),
}));

export const assignmentUploadIntentsTable = pgTable("lms_assignment_upload_intents", {
  id: serial("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  uploadedByClerkUserId: text("uploaded_by_clerk_user_id").notNull(),
  assignmentId: integer("assignment_id"),
  kind: text("kind").notNull().default("assignment"),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

export const assignmentsTable = pgTable("lms_assignments", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  resourceId: integer("resource_id").notNull(),
  termNumber: integer("term_number").notNull(),
  teacherClerkUserId: text("teacher_clerk_user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
  maxScore: integer("max_score").notNull().default(100),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  validTermNumber: check("lms_assignments_term_number_check", sql`${table.termNumber} BETWEEN 1 AND 8`),
  validMaxScore: check("lms_assignments_max_score_check", sql`${table.maxScore} BETWEEN 1 AND 1000`),
}));

export const assignmentAttachmentsTable = pgTable("lms_assignment_attachments", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  submissionId: integer("submission_id"),
  kind: text("kind").notNull().default("assignment"),
  objectPath: text("object_path").notNull(),
  originalName: text("original_name").notNull(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  uploadedByClerkUserId: text("uploaded_by_clerk_user_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assignmentSubmissionsTable = pgTable("lms_assignment_submissions", {
  id: serial("id").primaryKey(),
  assignmentId: integer("assignment_id").notNull(),
  profileId: integer("profile_id").notNull(),
  answerText: text("answer_text").notNull().default(""),
  status: text("status").notNull().default("submitted"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
  score: integer("score"),
  feedback: text("feedback"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  assignmentProfileUnique: uniqueIndex("lms_assignment_submissions_assignment_profile_unique").on(table.assignmentId, table.profileId),
  validScore: check("lms_assignment_submissions_score_check", sql`${table.score} IS NULL OR ${table.score} BETWEEN 0 AND 1000`),
}));

export const examsTable = pgTable("lms_exams", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id").notNull(),
  resourceId: integer("resource_id").notNull(),
  termNumber: integer("term_number").notNull(),
  teacherClerkUserId: text("teacher_clerk_user_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  isOnboarding: boolean("is_onboarding").notNull().default(false),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  validTermNumber: check("lms_exams_term_number_check", sql`${table.termNumber} BETWEEN 1 AND 8`),
  validStatus: check("lms_exams_status_check", sql`${table.status} IN ('open', 'closed')`),
}));

export const onboardingExamAssignmentsTable = pgTable("lms_onboarding_exam_assignments", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  examId: integer("exam_id").notNull(),
  reviewStatus: text("review_status").notNull().default("pending"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedByClerkUserId: text("reviewed_by_clerk_user_id"),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  profileUnique: uniqueIndex("lms_onboarding_exam_assignments_profile_unique").on(table.profileId),
  validReviewStatus: check("lms_onboarding_exam_assignments_review_status_check", sql`${table.reviewStatus} IN ('pending', 'approved')`),
}));

export const examQuestionsTable = pgTable("lms_exam_questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  prompt: text("prompt").notNull(),
  position: integer("position").notNull(),
});

export const examOptionsTable = pgTable("lms_exam_options", {
  id: serial("id").primaryKey(),
  questionId: integer("question_id").notNull(),
  label: text("label").notNull(),
  position: integer("position").notNull(),
  isCorrect: boolean("is_correct").notNull().default(false),
});

export const examSubmissionsTable = pgTable("lms_exam_submissions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  profileId: integer("profile_id").notNull(),
  answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  examProfileUnique: uniqueIndex("lms_exam_submissions_exam_profile_unique").on(table.examId, table.profileId),
}));

export const examAttemptsTable = pgTable("lms_exam_attempts", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  profileId: integer("profile_id").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  examProfileUnique: uniqueIndex("lms_exam_attempts_exam_profile_unique").on(table.examId, table.profileId),
}));

export const insertCourseSchema = createInsertSchema(coursesTable).omit({ id: true });
export const insertAnnouncementSchema = createInsertSchema(announcementsTable).omit({ id: true });
export const insertArticleSchema = createInsertSchema(articlesTable).omit({ id: true });
export const insertDailyBenefitSchema = createInsertSchema(dailyBenefitsTable).omit({ id: true });
export const insertResourceSchema = createInsertSchema(resourcesTable).omit({ id: true });
export const insertApplicationSchema = createInsertSchema(applicationsTable).omit({ id: true });
export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssignmentSubmissionSchema = createInsertSchema(assignmentSubmissionsTable).omit({ id: true, submittedAt: true, updatedAt: true });
export const insertExamSchema = createInsertSchema(examsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExamQuestionSchema = createInsertSchema(examQuestionsTable).omit({ id: true });
export const insertExamOptionSchema = createInsertSchema(examOptionsTable).omit({ id: true });
export const insertExamSubmissionSchema = createInsertSchema(examSubmissionsTable).omit({ id: true, submittedAt: true });

export type InsertCourse = z.infer<typeof insertCourseSchema>;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type InsertDailyBenefit = z.infer<typeof insertDailyBenefitSchema>;
export type InsertResource = z.infer<typeof insertResourceSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type CourseRecord = typeof coursesTable.$inferSelect;
export type AnnouncementRecord = typeof announcementsTable.$inferSelect;
export type ArticleRecord = typeof articlesTable.$inferSelect;
export type DailyBenefitRecord = typeof dailyBenefitsTable.$inferSelect;
export type ResourceRecord = typeof resourcesTable.$inferSelect;
export type ApplicationRecord = typeof applicationsTable.$inferSelect;
export type MessageRecord = typeof messagesTable.$inferSelect;
export type QuestionRecord = typeof questionsTable.$inferSelect;
export type ApplicationUploadIntentRecord = typeof applicationUploadIntentsTable.$inferSelect;
export type StudentAcademicProfileRecord = typeof studentAcademicProfilesTable.$inferSelect;
export type StudentGradeRecord = typeof studentGradesTable.$inferSelect;
export type StudentAttendanceEntryRecord = typeof studentAttendanceRecordsTable.$inferSelect;
export type LessonJoinEventRecord = typeof lessonJoinEventsTable.$inferSelect;
export type AssignmentUploadIntentRecord = typeof assignmentUploadIntentsTable.$inferSelect;
export type AssignmentRecord = typeof assignmentsTable.$inferSelect;
export type AssignmentAttachmentRecord = typeof assignmentAttachmentsTable.$inferSelect;
export type AssignmentSubmissionRecord = typeof assignmentSubmissionsTable.$inferSelect;
export type ExamRecord = typeof examsTable.$inferSelect;
export type OnboardingExamAssignmentRecord = typeof onboardingExamAssignmentsTable.$inferSelect;
export type ExamQuestionRecord = typeof examQuestionsTable.$inferSelect;
export type ExamOptionRecord = typeof examOptionsTable.$inferSelect;
export type ExamSubmissionRecord = typeof examSubmissionsTable.$inferSelect;
export type ExamAttemptRecord = typeof examAttemptsTable.$inferSelect;