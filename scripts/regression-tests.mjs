import assert from "node:assert/strict";

const baseUrl = (process.env.REGRESSION_BASE_URL || "http://localhost:80").replace(/\/$/, "");
const studentAuthorization = process.env.REGRESSION_STUDENT_AUTHORIZATION;

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { Accept: "application/json", ...(options?.headers || {}) },
  });
  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new Error(`${path} returned non-JSON response: ${text.slice(0, 120)}`);
    }
  }
  return { response, body };
}

function assertObject(value, path) {
  assert.equal(typeof value, "object", `${path} must be an object`);
  assert.notEqual(value, null, `${path} must not be null`);
}

function assertArray(value, path) {
  assert.ok(Array.isArray(value), `${path} must be an array`);
}

async function expectStatus(path, expectedStatus, options) {
  const { response, body } = await request(path, options);
  assert.equal(response.status, expectedStatus, `${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function run() {
  const health = await expectStatus("/api/healthz", 200);
  assert.deepEqual(health, { status: "ok" }, "health response contract changed");

  const questions = await expectStatus("/api/questions", 200);
  assertArray(questions, "/api/questions");
  for (const [index, question] of questions.entries()) {
    assert.equal(typeof question.id, "number", `/api/questions[${index}].id must be a number`);
    assert.equal(typeof question.title, "string", `/api/questions[${index}].title must be a string`);
    assert.equal(typeof question.body, "string", `/api/questions[${index}].body must be a string`);
    assert.ok(question.answer === null || typeof question.answer === "string", `/api/questions[${index}].answer must be nullable string`);
    assert.ok(question.answeredAt === null || typeof question.answeredAt === "string", `/api/questions[${index}].answeredAt must be nullable string`);
  }

  const articles = await expectStatus("/api/articles", 200);
  assertArray(articles, "/api/articles");
  for (const [index, article] of articles.entries()) {
    assert.equal(typeof article.id, "number", `/api/articles[${index}].id must be a number`);
    assert.equal(typeof article.title, "string", `/api/articles[${index}].title must be a string`);
    assert.equal(typeof article.body, "string", `/api/articles[${index}].body must be a string`);
  }

  const applicationWindow = await expectStatus("/api/application-window", 200);
  assertObject(applicationWindow, "/api/application-window");
  assert.equal(typeof applicationWindow.isOpen, "boolean", "application window isOpen must be boolean");
  assert.ok(["open", "not_started", "ended", "unscheduled"].includes(applicationWindow.status), "application window status is invalid");

  const dailyBenefit = await expectStatus("/api/daily-benefit", 200);
  assertObject(dailyBenefit, "/api/daily-benefit");
  assert.equal(typeof dailyBenefit.body, "string", "daily benefit body must be a string");
  assert.equal(typeof dailyBenefit.source, "string", "daily benefit source must be a string");

  const statistics = await expectStatus("/api/system-statistics", 200);
  assertObject(statistics, "/api/system-statistics");
  for (const field of ["teachers", "currentStudents", "graduatedStudents"]) {
    assert.equal(typeof statistics[field], "number", `/api/system-statistics.${field} must be a number`);
    assert.ok(statistics[field] >= 0, `/api/system-statistics.${field} must not be negative`);
  }
  assert.equal(typeof statistics.visible, "boolean", "/api/system-statistics.visible must be boolean");

  const protectedReads = [
    "/api/account/profile",
    "/api/dashboard",
    "/api/messages",
    "/api/messages/unread-count",
    "/api/courses",
    "/api/student/deletion-notice",
    "/api/admin/applications",
    "/api/admin/lesson-attendance",
    "/api/admin/audit-events",
    "/api/admin/users/user_test/profile-history",
    "/api/courses/1/pdf",
    "/api/resources/1/file",
    "/api/admin/teachers",
    "/api/admin/teacher-schedule?termNumber=1",
    "/api/admin/resources?termNumber=1",
    "/api/admin/resources/1/students",
    "/api/attendance-excuses",
    "/api/admin/attendance-excuses",
    "/api/admin/lesson-attendance",
    "/api/admin/academic-profiles",
    "/api/admin/graduation-candidates",
    "/api/admin/graduation-certificates",
    "/api/student/schedule-access",
    "/api/student/teacher-choices?termNumber=1",
    "/api/semester-subject-removal-requests",
    "/api/admin/semester-subject-removal-requests",
  ];
  for (const path of protectedReads) {
    await expectStatus(path, 401);
  }

  const protectedWrites = [
    ["/api/questions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "regression-test", body: "must be rejected without auth" }) }],
    ["/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipientClerkUserId: "regression-test", body: "must be rejected without auth" }) }],
    ["/api/student/lesson-joins", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["/api/student/teacher-choices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resourceId: 1 }) }],
    ["/api/student/notifications/1/dismiss", { method: "POST" }],
    ["/api/assignments/1/submission-upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "submission.pdf", size: 1024, contentType: "application/pdf" }) }],
    ["/api/assignments/1/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answerText: "must be rejected without auth" }) }],
    ["/api/exams/1/submissions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: {} }) }],
    ["/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["/api/admin/courses/upload-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "lesson.pdf", size: 1024, contentType: "application/pdf" }) }],
    ["/api/admin/courses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "regression-test", pdfUrl: "/objects/courses/not-a-pdf.txt" }) }],
    ["/api/admin/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: "http://unsafe.example", termNumber: 1 }) }],
    ["/api/admin/resources/1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termNumber: 1, teacherClerkUserId: "unauthorized-test" }) }],
    ["/api/admin/resources/1/students", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileIds: [1, 1] }) }],
    ["/api/admin/applications/1/teacher-role", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["/api/admin/articles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "regression-test", excerpt: "must be rejected without auth", body: "must be rejected without auth", author: "regression-test" }) }],
    ["/api/admin/articles/1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "must be rejected without auth" }) }],
    ["/api/admin/articles/1", { method: "DELETE" }],
    ["/api/admin/daily-benefits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dayOfWeek: "monday", body: "must be rejected without auth", source: "regression-test" }) }],
    ["/api/admin/daily-benefits/monday", { method: "DELETE" }],
    ["/api/attendance-excuses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attendanceRecordId: 1, reason: "must be rejected without auth" }) }],
    ["/api/admin/lesson-attendance/1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "present" }) }],
    ["/api/admin/academic-profiles/1/attendance", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: 1, termNumber: 1, attendanceDate: "2026-08-25", status: "absent" }) }],
    ["/api/admin/academic-profiles/1/grades", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ termNumber: 1, grades: [{ courseId: 1, grade: 80, componentNames: ["İştirak"], componentGrades: { "İştirak": 101 } }] }) }],
    ["/api/admin/academic-profiles/1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseYear: 2, semester: 1 }) }],
    ["/api/admin/students/1/graduate", { method: "POST" }],
    ["/api/admin/students/1", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" }],
    ["/api/admin/students/1/certificate", { method: "POST" }],
    ["/api/admin/students/1/certificate", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revoked: true }) }],
     ["/api/admin/students/1/ungraduate", { method: "POST" }],
    ["/api/admin/users/user_test/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: "Test", lastName: "User", username: "test-user", email: "test@example.com", phone: "000", birthDate: "2000-01-01", arabicLevel: "Orta" }) }],
    ["/api/admin/users/user_test/role", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role: "none" }) }],
    ["/api/admin/attendance-records/1", { method: "DELETE" }],
    ["/api/semester-subject-removal-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ courseId: 1, termNumber: 1, reason: "must be rejected without auth" }) }],
    ["/api/semester-subjects/1/1", { method: "DELETE" }],
    ["/api/admin/semester-subject-removal-requests/1", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approved" }) }],
  ];
  for (const [path, options] of protectedWrites) {
    await expectStatus(path, 401, options);
  }

  const invalidVerification = await expectStatus("/api/certificates/verify/invalid-verification-token-12345", 200);
  assert.equal(invalidVerification.valid, false, "unknown verification tokens must be rejected without leaking certificate data");
  assert.equal(invalidVerification.certificateNumber, null, "invalid verification must not expose a certificate number");

  const authorization = process.env.REGRESSION_AUTHORIZATION;
  if (authorization) {
    const authenticatedHeaders = { Authorization: authorization, "Content-Type": "application/json" };
    const upload = await expectStatus("/api/admin/courses/upload-url", 200, {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ name: "lesson.pdf", size: 1024, contentType: "application/pdf" }),
    });
    assertObject(upload, "/api/admin/courses/upload-url");
    assert.equal(typeof upload.uploadURL, "string", "valid PDF upload must return an upload URL");
    assert.match(upload.objectPath, /^\/objects\/courses\/[a-zA-Z0-9-]+\.pdf$/, "valid PDF upload must return a safe internal object path");
    const missingPdfCourse = await expectStatus("/api/admin/courses", 400, {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({
        title: "Regression missing PDF",
        category: "Regression",
        instructor: "Regression",
        color: "#123456",
        pdfUrl: "/objects/courses/missing-regression-file.pdf",
        description: "Must reject a PDF object path that does not exist.",
        lessonDescription: "Regression lesson",
        lessonDays: ["monday"],
        lessonTime: "09:00",
      }),
    });
    assert.match(missingPdfCourse.error, /tapılmadı|yenidən/i, "missing PDF objects must be rejected when creating a course");

    const teacherId = process.env.REGRESSION_TEACHER_CLERK_USER_ID;
    if (teacherId) {
      const savedPdfResource = await expectStatus("/api/admin/resources", 201, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
          termNumber: 1,
          kind: "pdf",
          title: "Regression PDF resource",
          body: "Regression resource; removed after validation.",
          url: upload.objectPath,
          lessonDays: ["monday"],
          lessonTime: "09:00",
          isMandatory: true,
          teacherClerkUserId: teacherId,
          studentCapacity: 0,
        }),
      });
      assert.equal(savedPdfResource.url, upload.objectPath, "saved PDF resource must preserve the internal object path");
      await expectStatus(`/api/admin/resources/${savedPdfResource.id}`, 204, {
        method: "DELETE",
        headers: authenticatedHeaders,
      });

      const subjectTerm = Number(process.env.REGRESSION_STUDENT_TERM || 1);
      const studentHeaders = studentAuthorization ? { Authorization: studentAuthorization } : null;
      let lifecycleResourceId = null;
      let lifecycleResourceDeleted = false;

      const lifecycleCourseId = studentHeaders
        ? await (async () => {
          const studentDashboard = await expectStatus("/api/dashboard", 200, { headers: studentHeaders });
          assertArray(studentDashboard.courses, "/api/dashboard.courses");
          const configuredCourseId = Number(process.env.REGRESSION_COURSE_ID || 0);
          const selectedCourse = configuredCourseId
            ? studentDashboard.courses.find((course) => course.id === configuredCourseId)
            : studentDashboard.courses[0];
          assert.ok(selectedCourse, "semester subject lifecycle needs a course visible to the regression student");
          return selectedCourse.id;
        })()
        : Number(process.env.REGRESSION_COURSE_ID || 1);

      try {
        const lifecycleTitle = `Regression semester subject ${Date.now()}`;
        const savedResource = await expectStatus("/api/admin/resources", 201, {
          method: "POST",
          headers: authenticatedHeaders,
          body: JSON.stringify({
            courseId: lifecycleCourseId,
            termNumber: subjectTerm,
            kind: "material",
            title: lifecycleTitle,
            body: "Regression semester subject; removed after validation.",
            url: "https://example.com/regression-semester-subject",
            lessonDays: ["monday"],
            lessonTime: "09:00",
            isMandatory: true,
            teacherClerkUserId: teacherId,
            studentCapacity: 0,
          }),
        });
        lifecycleResourceId = savedResource.id;
        assert.equal(savedResource.courseId, lifecycleCourseId, "created semester subject must preserve its course");
        assert.equal(savedResource.termNumber, subjectTerm, "created semester subject must preserve its semester");
        assert.equal(savedResource.title, lifecycleTitle, "created semester subject must preserve its title");

        const updatedTitle = `${lifecycleTitle} (edited)`;
        const updatedResource = await expectStatus(`/api/admin/resources/${savedResource.id}`, 200, {
          method: "PATCH",
          headers: authenticatedHeaders,
          body: JSON.stringify({
            courseId: lifecycleCourseId,
            termNumber: subjectTerm,
            kind: "material",
            title: updatedTitle,
            body: "Edited regression semester subject.",
            url: "https://example.com/edited-regression-semester-subject",
            lessonDays: ["tuesday"],
            lessonTime: "10:30",
            isMandatory: false,
            teacherClerkUserId: teacherId,
            studentCapacity: 12,
          }),
        });
        assert.equal(updatedResource.id, savedResource.id, "edited semester subject must keep its identity");
        assert.equal(updatedResource.title, updatedTitle, "edited semester subject must return its new title");
        assert.equal(updatedResource.termNumber, subjectTerm, "edited semester subject must remain in its selected semester");
        assert.equal(updatedResource.lessonTime, "10:30", "edited semester subject must return its updated lesson time");

        if (studentHeaders) {
          const resourcesAfterCreate = await expectStatus(`/api/resources?termNumber=${subjectTerm}`, 200, { headers: studentHeaders });
          assertArray(resourcesAfterCreate, `/api/resources?termNumber=${subjectTerm}`);
          assert.ok(resourcesAfterCreate.some((resource) => resource.id === savedResource.id && resource.title === updatedTitle), "student must see the selected semester subject after it is created and edited");
          for (const [index, resource] of resourcesAfterCreate.entries()) {
            assert.equal(resource.termNumber, subjectTerm, `/api/resources?termNumber=${subjectTerm}[${index}] must not include another semester`);
          }
        }

        await expectStatus(`/api/admin/resources/${savedResource.id}`, 204, {
          method: "DELETE",
          headers: authenticatedHeaders,
        });
        lifecycleResourceDeleted = true;

        if (studentHeaders) {
          const resourcesAfterDelete = await expectStatus(`/api/resources?termNumber=${subjectTerm}`, 200, { headers: studentHeaders });
          assert.ok(!resourcesAfterDelete.some((resource) => resource.id === savedResource.id), "student must not see a semester subject after it is deleted");
        }
      } finally {
        if (lifecycleResourceId && !lifecycleResourceDeleted) {
          await request(`/api/admin/resources/${lifecycleResourceId}`, {
            method: "DELETE",
            headers: authenticatedHeaders,
          });
        }
      }

      const unsafeResource = await expectStatus("/api/admin/resources", 400, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
          termNumber: 1,
          kind: "pdf",
          title: "Regression unsafe URL",
          body: "Must reject unsafe external links.",
          url: "http://unsafe.example/lesson.pdf",
          lessonDays: ["monday"],
          lessonTime: "09:00",
          isMandatory: true,
          teacherClerkUserId: teacherId,
          studentCapacity: 0,
        }),
      });
      assert.equal(typeof unsafeResource.error, "string", "unsafe resource URL must return an explanatory error");

      const invalidPdfResource = await expectStatus("/api/admin/resources", 400, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
          termNumber: 1,
          kind: "pdf",
          title: "Regression invalid PDF path",
          body: "Must reject non-PDF course object paths.",
          url: "/objects/courses/not-a-pdf.txt",
          lessonDays: ["monday"],
          lessonTime: "09:00",
          isMandatory: true,
          teacherClerkUserId: teacherId,
          studentCapacity: 0,
        }),
      });
      assert.equal(typeof invalidPdfResource.error, "string", "PDF resources must reject non-PDF object paths");

      const invalidTeacherAssignment = await expectStatus("/api/admin/resources", 400, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
          termNumber: 1,
          kind: "pdf",
          title: "Regression invalid teacher assignment",
          body: "Must reject unknown teacher accounts.",
          url: null,
          lessonDays: ["monday"],
          lessonTime: "09:00",
          isMandatory: true,
          teacherClerkUserId: "user_invalid_teacher_assignment",
          studentCapacity: 0,
        }),
      });
      assert.equal(typeof invalidTeacherAssignment.error, "string", "unknown teacher assignment must return an explanatory error");

      const missingTeacherAssignment = await expectStatus("/api/admin/resources", 400, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
          termNumber: 1,
          kind: "text",
          title: "Regression missing teacher assignment",
          body: "Must reject resources without a teacher assignment.",
          url: null,
          lessonDays: ["monday"],
          lessonTime: "09:00",
          isMandatory: true,
          teacherClerkUserId: "",
          studentCapacity: 0,
        }),
      });
      assert.equal(typeof missingTeacherAssignment.error, "string", "missing teacher assignments must return an explanatory error");
    }

    for (const body of [
      { name: "lesson.exe", size: 1024, contentType: "application/octet-stream" },
      { name: "lesson.pdf", size: 0, contentType: "application/pdf" },
      { name: "lesson.pdf", size: 25 * 1024 * 1024 + 1, contentType: "application/pdf" },
    ]) {
      const invalid = await expectStatus("/api/admin/courses/upload-url", 400, {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify(body),
      });
      assert.equal(typeof invalid.error, "string", "invalid PDF upload must return an explanatory error");
    }

    const adminArticles = await expectStatus("/api/admin/articles", 200, { headers: authenticatedHeaders });
    assertArray(adminArticles, "/api/admin/articles");
    for (const [index, article] of adminArticles.entries()) {
      assert.equal(typeof article.id, "number", `/api/admin/articles[${index}].id must be a number`);
      assert.equal(typeof article.author, "string", `/api/admin/articles[${index}].author must be a string`);
      assert.equal(typeof article.createdAt, "string", `/api/admin/articles[${index}].createdAt must be a string`);
    }

    const profileId = process.env.REGRESSION_PROFILE_ID;
    if (profileId && teacherId) {
      const calculatedGrade = await expectStatus(`/api/admin/academic-profiles/${profileId}/grades`, 200, {
        method: "PUT",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          termNumber: 1,
          grades: [{
            courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
            grade: 10,
            componentNames: ["İştirak", "İmtahan"],
            componentGrades: { "İştirak": 60, "İmtahan": 66 },
          }],
        }),
      });
      const calculatedSubject = calculatedGrade.semesters?.find((semester) => semester.termNumber === 1)?.subjects
        ?.find((subject) => subject.courseId === Number(process.env.REGRESSION_COURSE_ID || 1));
      assert.equal(calculatedSubject?.grade, 3.15, "component average must be stored and returned as 3.15/5.0");
      assert.deepEqual(
        calculatedSubject?.gradingComponents?.map((component) => component.score),
        [60, 66],
        "component scores must remain visible after saving",
      );

      const invalidGrade = await expectStatus(`/api/admin/academic-profiles/${profileId}/grades`, 400, {
        method: "PUT",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          termNumber: 1,
          grades: [{
            courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
            grade: 80,
            componentNames: ["İştirak"],
            componentGrades: { "İştirak": 101 },
          }],
        }),
      });
      assert.equal(typeof invalidGrade.error, "string", "out-of-range component grades must return an explanatory error");
      const gradeAfterInvalidUpdate = await expectStatus(`/api/admin/academic-profiles/${profileId}`, 200, { headers: authenticatedHeaders });
      const unchangedGrade = gradeAfterInvalidUpdate.semesters?.find((semester) => semester.termNumber === 1)?.subjects
        ?.find((subject) => subject.courseId === Number(process.env.REGRESSION_COURSE_ID || 1));
      assert.equal(unchangedGrade?.grade, 3.15, "rejected component grades must preserve the previous calculated average");

      const invalidAttendance = await expectStatus(`/api/admin/academic-profiles/${profileId}/attendance`, 400, {
        method: "PUT",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          courseId: Number(process.env.REGRESSION_COURSE_ID || 1),
          termNumber: 1,
          attendanceDate: "2026-08-25",
          status: "unknown-status",
        }),
      });
      assert.equal(typeof invalidAttendance.error, "string", "invalid attendance status must return an explanatory error");
    }

    const invalidArticle = await expectStatus("/api/admin/articles", 400, {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ title: "   ", excerpt: "   ", body: "   ", author: "   " }),
    });
    assert.equal(typeof invalidArticle.error, "string", "blank article fields must return an explanatory error");

    const invalidDailyBenefit = await expectStatus("/api/admin/daily-benefits", 400, {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ dayOfWeek: "monday", body: "   ", source: "   " }),
    });
    assert.equal(typeof invalidDailyBenefit.error, "string", "blank daily benefit fields must return an explanatory error");
  }

  if (studentAuthorization) {
    const studentHeaders = { Authorization: studentAuthorization };
    const activeDeletionNotice = await expectStatus("/api/student/deletion-notice", 200, { headers: studentHeaders });
    assert.equal(activeDeletionNotice, null, "active students must not receive a deletion notice");
    const dashboard = await expectStatus("/api/dashboard", 200, { headers: studentHeaders });
    assertObject(dashboard, "/api/dashboard");
    assertArray(dashboard.courses, "/api/dashboard.courses");
    const dashboardCourseIds = new Set(dashboard.courses.map((course) => course.id));
    for (const [index, course] of dashboard.courses.entries()) {
      assert.equal(typeof course.id, "number", `/api/dashboard.courses[${index}].id must be a number`);
      assert.equal(typeof course.title, "string", `/api/dashboard.courses[${index}].title must be a string`);
    }
    const studentTerm = Number(process.env.REGRESSION_STUDENT_TERM || 1);
    const semesterResources = await expectStatus(`/api/resources?termNumber=${studentTerm}`, 200, { headers: studentHeaders });
    assertArray(semesterResources, "/api/resources");
    for (const [index, resource] of semesterResources.entries()) {
      assert.equal(resource.termNumber, studentTerm, `/api/resources[${index}] must use the requested semester`);
      assert.equal(typeof resource.courseId, "number", `/api/resources[${index}].courseId must be a number`);
      assert.equal(typeof resource.title, "string", `/api/resources[${index}].title must be a string`);
      assert.ok(dashboardCourseIds.has(resource.courseId), `/api/resources[${index}] must belong to a dashboard course`);
    }
    const legacyResource = semesterResources.find((resource) => resource.teacherClerkUserId === null);
    if (legacyResource) {
      const profile = await expectStatus("/api/profile", 200, { headers: studentHeaders });
      const legacySubject = profile.semesters
        ?.find((semester) => semester.termNumber === legacyResource.termNumber)
        ?.subjects
        ?.find((subject) => subject.courseId === legacyResource.courseId);
      const legacyCourse = dashboard.courses.find((course) => course.id === legacyResource.courseId);
      assert.ok(legacySubject, "legacy resources without a teacher assignment must remain visible in the academic profile");
      assert.ok(legacyCourse, "legacy resources without a teacher assignment must belong to a visible dashboard course");
      assert.equal(legacyResource.teacherName, null, "legacy resources without a teacher assignment must not invent a teacher name");
      assert.equal(
        legacySubject.instructor,
        legacyCourse.instructor,
        "legacy resources without a teacher assignment must fall back to the course instructor",
      );
    }
    const invalidSemesterResources = await expectStatus("/api/resources?termNumber=9", 400, { headers: studentHeaders });
    assert.equal(typeof invalidSemesterResources.error, "string", "invalid semester resource requests must return an explanatory error");
    const scheduleAccess = await expectStatus("/api/student/schedule-access", 200, { headers: studentHeaders });
    assertObject(scheduleAccess, "/api/student/schedule-access");
    assert.equal(typeof scheduleAccess.approved, "boolean", "/api/student/schedule-access.approved must be boolean");
    const teacherChoices = await expectStatus(`/api/student/teacher-choices?termNumber=${studentTerm}`, 200, { headers: studentHeaders });
    assertArray(teacherChoices, "/api/student/teacher-choices");
    for (const [index, choice] of teacherChoices.entries()) {
      assert.equal(choice.termNumber, studentTerm, `/api/student/teacher-choices[${index}] must use the requested term`);
      assert.equal(typeof choice.courseId, "number", `/api/student/teacher-choices[${index}].courseId must be a number`);
      assert.equal(typeof choice.resourceId, "number", `/api/student/teacher-choices[${index}].resourceId must be a number`);
      assert.ok(dashboardCourseIds.has(choice.courseId), `/api/student/teacher-choices[${index}] must belong to a dashboard course`);
      assert.equal(typeof choice.studentCapacity, "number", `/api/student/teacher-choices[${index}].studentCapacity must be a number`);
      assert.equal(typeof choice.activeChoiceCount, "number", `/api/student/teacher-choices[${index}].activeChoiceCount must be a number`);
      assert.equal(typeof choice.isFull, "boolean", `/api/student/teacher-choices[${index}].isFull must be boolean`);
    }
    const studentExcuses = await expectStatus("/api/attendance-excuses", 200, { headers: studentHeaders });
    assertArray(studentExcuses, "/api/attendance-excuses");
    for (const [index, excuse] of studentExcuses.entries()) {
      assert.equal(typeof excuse.attendanceRecordId, "number", `/api/attendance-excuses[${index}].attendanceRecordId must be a number`);
      assert.equal(typeof excuse.status, "string", `/api/attendance-excuses[${index}].status must be a string`);
    }
    const announcements = await expectStatus("/api/announcements", 200, { headers: studentHeaders });
    assertArray(announcements, "/api/announcements");
    for (let index = 1; index < announcements.length; index += 1) {
      assert.ok(announcements[index - 1].id > announcements[index].id, "newest announcements must appear first");
    }
    const studentRemovalRequests = await expectStatus("/api/semester-subject-removal-requests", 200, { headers: studentHeaders });
    assertArray(studentRemovalRequests, "/api/semester-subject-removal-requests");
    for (const [index, request] of studentRemovalRequests.entries()) {
      assert.equal(typeof request.id, "number", `/api/semester-subject-removal-requests[${index}].id must be a number`);
      assert.equal(typeof request.courseId, "number", `/api/semester-subject-removal-requests[${index}].courseId must be a number`);
      assert.equal(typeof request.termNumber, "number", `/api/semester-subject-removal-requests[${index}].termNumber must be a number`);
      assert.ok(["pending", "approved", "rejected"].includes(request.status), `/api/semester-subject-removal-requests[${index}].status must be valid`);
    }
    const pendingRemovalRequest = studentRemovalRequests.find((request) => request.status === "pending");
    if (pendingRemovalRequest) {
      const repeatedRemoval = await expectStatus("/api/semester-subject-removal-requests", 409, {
        method: "POST",
        headers: { ...studentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: pendingRemovalRequest.courseId,
          termNumber: pendingRemovalRequest.termNumber,
          reason: pendingRemovalRequest.reason,
        }),
      });
      assert.equal(typeof repeatedRemoval.error, "string", "repeated pending subject removal requests must return an explanatory conflict");
    } else {
      console.log("Duplicate subject-removal check skipped; no pending student request fixture is available.");
    }
    const selectedTeacherChoice = teacherChoices.find((choice) => choice.status === "pending" || choice.status === "approved");
    if (selectedTeacherChoice) {
      const repeatedTeacherChoice = await expectStatus("/api/student/teacher-choices", 409, {
        method: "POST",
        headers: { ...studentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: selectedTeacherChoice.resourceId }),
      });
      assert.equal(typeof repeatedTeacherChoice.error, "string", "repeated teacher choices must return an explanatory conflict");
    } else {
      console.log("Duplicate teacher-choice check skipped; no pending or approved choice fixture is available.");
    }
    const studentAssignments = await expectStatus(`/api/assignments?termNumber=${studentTerm}`, 200, { headers: studentHeaders });
    assertArray(studentAssignments, "/api/assignments");
    const resubmittableAssignment = studentAssignments.find((assignment) =>
      assignment.status === "open"
      && assignment.submission
      && assignment.submission.score === null
      && typeof assignment.submission.answerText === "string"
      && assignment.submission.answerText.trim().length > 0,
    );
    if (resubmittableAssignment) {
      const repeatedAssignment = await expectStatus(`/api/assignments/${resubmittableAssignment.id}/submissions`, 200, {
        method: "POST",
        headers: { ...studentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ answerText: resubmittableAssignment.submission.answerText }),
      });
      assert.equal(repeatedAssignment.id, resubmittableAssignment.submission.id, "assignment resubmission must reuse the existing submission");
      assert.equal(repeatedAssignment.assignmentId, resubmittableAssignment.id, "assignment resubmission must preserve its assignment");
      assert.equal(repeatedAssignment.answerText, resubmittableAssignment.submission.answerText, "assignment resubmission must preserve the answer");
    } else {
      console.log("Duplicate assignment-submission check skipped; no open ungraded submission fixture is available.");
    }
    const studentExams = await expectStatus(`/api/exams?termNumber=${studentTerm}`, 200, { headers: studentHeaders });
    assertArray(studentExams, "/api/exams");
    const alreadySubmittedExam = studentExams.find((exam) =>
      exam.status === "open"
      && exam.submission
      && exam.questions?.length
      && Object.keys(exam.submission.answers ?? {}).length === exam.questions.length,
    );
    if (alreadySubmittedExam) {
      const repeatedExam = await expectStatus(`/api/exams/${alreadySubmittedExam.id}/submissions`, 409, {
        method: "POST",
        headers: { ...studentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ answers: alreadySubmittedExam.submission.answers }),
      });
      assert.equal(typeof repeatedExam.error, "string", "repeated exam submissions must return an explanatory conflict");
    } else {
      console.log("Duplicate exam-submission check skipped; no completed exam fixture is available.");
    }
    for (const path of [
      "/api/admin/teachers",
      "/api/admin/teacher-schedule?termNumber=1",
      "/api/admin/applications/1/teacher-role",
      "/api/admin/resources?termNumber=1",
      "/api/admin/lesson-attendance",
      "/api/admin/academic-profiles",
      "/api/admin/audit-events",
    ]) {
      await expectStatus(path, 403, { headers: studentHeaders });
    }
    for (const [path, method, body] of [
      ["/api/admin/resources", "POST", {}],
      ["/api/admin/resources/1", "PATCH", {}],
      ["/api/admin/resources/1", "DELETE", undefined],
    ]) {
      await expectStatus(path, 403, {
        method,
        headers: { ...studentHeaders, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    for (const [path, method, body] of [
      ["/api/questions/1/answer", "POST", { answer: "Tələbə müəllim cavabı yaza bilməməlidir." }],
      ["/api/messages/1/reply", "POST", { body: "Tələbə müəllim cavabı yaza bilməməlidir." }],
      ["/api/admin/teacher-choices/1", "PATCH", { decision: "approved" }],
      ["/api/admin/academic-profiles/1/promote", "POST", { expectedTermNumber: 1 }],
      ["/api/admin/academic-profiles/1/demote", "POST", { expectedTermNumber: 1 }],
    ]) {
      await expectStatus(path, 403, {
        method,
        headers: { ...studentHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    const assignedResource = semesterResources.find((resource) => resource.teacherClerkUserId);
    const nonTeacherResourceId = assignedResource?.id ?? Number(process.env.REGRESSION_RESOURCE_ID || 1);
    const nonTeacherResourcePayload = {
      courseId: assignedResource?.courseId ?? Number(process.env.REGRESSION_COURSE_ID || 1),
      termNumber: assignedResource?.termNumber ?? studentTerm,
      kind: "text",
      title: "Unauthorized teacher assignment regression",
      body: "A non-teacher account must not create or edit resources.",
      url: null,
      lessonDays: ["monday"],
      lessonTime: "09:00",
      isMandatory: true,
      teacherClerkUserId: assignedResource?.teacherClerkUserId ?? process.env.REGRESSION_TEACHER_CLERK_USER_ID ?? "user_regression_teacher",
      studentCapacity: 0,
    };
    await expectStatus("/api/admin/resources", 403, {
      method: "POST",
      headers: { ...studentHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(nonTeacherResourcePayload),
    });
    await expectStatus(`/api/admin/resources/${nonTeacherResourceId}`, 403, {
      method: "PATCH",
      headers: { ...studentHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(nonTeacherResourcePayload),
    });
    const studentMessages = await expectStatus("/api/messages", 200, { headers: studentHeaders });
    assertArray(studentMessages, "/api/messages");
    for (const [index, message] of studentMessages.entries()) {
      assert.equal(typeof message.id, "number", `/api/messages[${index}].id must be a number`);
      assert.equal(typeof message.body, "string", `/api/messages[${index}].body must be a string`);
    }
    const studentUnreadMessages = await expectStatus("/api/messages/unread-count", 200, { headers: studentHeaders });
    assert.equal(typeof studentUnreadMessages.count, "number", "/api/messages/unread-count.count must be a number");
    const missingStudentResourceFile = await expectStatus("/api/resources/999999999/file", 404, { headers: studentHeaders });
    assert.equal(typeof missingStudentResourceFile.error, "string", "missing student resource files must return an explanatory error");
    await expectStatus("/api/messages/1/reply", 403, {
      method: "POST",
      headers: { ...studentHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "Tələbə cavab səlahiyyətini keçməməlidir." }),
    });
    const invalidRemoval = await expectStatus("/api/semester-subject-removal-requests", 400, {
      method: "POST",
      headers: { ...studentHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: 1, termNumber: 1, reason: "x" }),
    });
    assert.equal(typeof invalidRemoval.error, "string", "subject removal requests must reject short reasons");
    await expectStatus("/api/semester-subjects/not-a-course/1", 400, {
      method: "DELETE",
      headers: studentHeaders,
    });
  }

  const deletedAuthorization = process.env.REGRESSION_DELETED_AUTHORIZATION;
  if (deletedAuthorization) {
    const deletedHeaders = { Authorization: deletedAuthorization };
    const deletionNotice = await expectStatus("/api/student/deletion-notice", 200, { headers: deletedHeaders });
    assertObject(deletionNotice, "/api/student/deletion-notice");
    assert.equal(typeof deletionNotice.studentName, "string", "deleted account notice must include the student name");
    assert.equal(typeof deletionNotice.reason, "string", "deleted account notice must include a string deletion reason");
    assert.ok(deletionNotice.reason.trim().length > 0, "deleted account notice must include the deletion reason");
    assert.equal(typeof deletionNotice.deletedByName, "string", "deleted account notice must include a string deletion actor");
    assert.ok(deletionNotice.deletedByName.trim().length > 0, "deleted account notice must include who performed the deletion");
    assert.ok(Number.isFinite(new Date(deletionNotice.deletedAt).getTime()), "deleted account notice must include a valid deletion timestamp");
    const deletedCourseId = Number(process.env.REGRESSION_COURSE_ID || 1);
    for (const path of [
      "/api/account/profile",
      "/api/dashboard",
      "/api/courses",
      `/api/courses/${deletedCourseId}`,
      "/api/profile",
    ]) {
      const deletedResponse = await expectStatus(path, 403, { headers: deletedHeaders });
      assert.equal(typeof deletedResponse.error, "string", `${path} must return an explanatory deleted-account error`);
    }
    const deletedMessages = await expectStatus("/api/messages", 403, { headers: deletedHeaders });
    assert.equal(typeof deletedMessages.error, "string", "deleted accounts must not access authenticated data");
  }

  const teacherAuthorization = process.env.REGRESSION_TEACHER_AUTHORIZATION;
  if (teacherAuthorization) {
    const teacherHeaders = { Authorization: teacherAuthorization };
    const teacherMessages = await expectStatus("/api/messages", 200, { headers: teacherHeaders });
    assertArray(teacherMessages, "/api/messages");
    for (const [path, method, body] of [
      ["/api/student/lesson-joins", "POST", { resourceId: 1, termNumber: 1 }],
      ["/api/student/teacher-choices", "POST", { resourceId: 1 }],
      ["/api/student/notifications/1/dismiss", "POST", undefined],
      ["/api/semester-subject-removal-requests", "POST", { courseId: 1, termNumber: 1, reason: "Müəllim tələbə müraciəti göndərə bilməməlidir." }],
      ["/api/assignments/1/submissions", "POST", { answerText: "Müəllim tələbə təhvili göndərə bilməməlidir." }],
      ["/api/exams/1/submissions", "POST", { answers: {} }],
    ]) {
      await expectStatus(path, 403, {
        method,
        headers: { ...teacherHeaders, ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    const teacherUnreadMessages = await expectStatus("/api/messages/unread-count", 200, { headers: teacherHeaders });
    assert.equal(typeof teacherUnreadMessages.count, "number", "/api/messages/unread-count.count must be a number");
    const invalidReply = await expectStatus("/api/messages/1/reply", 400, {
      method: "POST",
      headers: { ...teacherHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "   " }),
    });
    assert.equal(typeof invalidReply.error, "string", "teacher replies must reject empty message bodies");
    const invalidRemovalDecision = await expectStatus("/api/admin/semester-subject-removal-requests/1", 400, {
      method: "PATCH",
      headers: { ...teacherHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "pending" }),
    });
    assert.equal(typeof invalidRemovalDecision.error, "string", "invalid subject removal decisions must return an explanatory error");
    const teacherRemovalRequests = await expectStatus("/api/admin/semester-subject-removal-requests", 200, { headers: teacherHeaders });
    assertArray(teacherRemovalRequests, "/api/admin/semester-subject-removal-requests");
    for (const [index, request] of teacherRemovalRequests.entries()) {
      assert.equal(typeof request.id, "number", `/api/admin/semester-subject-removal-requests[${index}].id must be a number`);
      assert.equal(typeof request.profileId, "number", `/api/admin/semester-subject-removal-requests[${index}].profileId must be a number`);
      assert.ok(["pending", "approved", "rejected"].includes(request.status), `/api/admin/semester-subject-removal-requests[${index}].status must be valid`);
    }
    await expectStatus("/api/admin/applications/1/teacher-role", 403, {
      method: "POST",
      headers: { ...teacherHeaders, "Content-Type": "application/json" },
      body: "{}",
    });
    const teachers = await expectStatus("/api/admin/teachers", 200, { headers: teacherHeaders });
    assertArray(teachers, "/api/admin/teachers");
    for (const [index, teacher] of teachers.entries()) {
      assert.equal(typeof teacher.clerkUserId, "string", `/api/admin/teachers[${index}].clerkUserId must be a string`);
      assert.equal(typeof teacher.displayName, "string", `/api/admin/teachers[${index}].displayName must be a string`);
    }

    const teacherSchedule = await expectStatus("/api/admin/teacher-schedule?termNumber=1", 200, { headers: teacherHeaders });
    assertArray(teacherSchedule, "/api/admin/teacher-schedule");
    const expectedTeacherId = process.env.REGRESSION_TEACHER_CLERK_USER_ID;
    for (const [index, resource] of teacherSchedule.entries()) {
      assert.equal(typeof resource.teacherClerkUserId, "string", `/api/admin/teacher-schedule[${index}].teacherClerkUserId must be a string`);
      if (expectedTeacherId) {
        assert.equal(resource.teacherClerkUserId, expectedTeacherId, "teacher schedule must only contain the authenticated teacher's assignments");
      }
    }
    if (teacherSchedule[0]) {
      const resource = teacherSchedule[0];
      const invalidTeacherUpdate = await expectStatus(`/api/admin/resources/${resource.id}`, 400, {
        method: "PATCH",
        headers: { ...teacherHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: resource.courseId,
          termNumber: resource.termNumber,
          kind: resource.kind,
          title: resource.title,
          body: resource.body,
          url: resource.url,
          lessonDays: resource.lessonDays,
          lessonTime: resource.lessonTime,
          isMandatory: resource.isMandatory,
          studentCapacity: resource.studentCapacity,
          teacherClerkUserId: "user_invalid_teacher_update",
        }),
      });
      assert.equal(typeof invalidTeacherUpdate.error, "string", "invalid teacher updates must return an explanatory error");
      const scheduleAfterInvalidUpdate = await expectStatus("/api/admin/teacher-schedule?termNumber=1", 200, { headers: teacherHeaders });
      const unchangedResource = scheduleAfterInvalidUpdate.find((item) => item.id === resource.id);
      assert.equal(unchangedResource?.teacherClerkUserId, resource.teacherClerkUserId, "invalid teacher updates must preserve the previous assignment");
    }
    const duplicateResourceId = process.env.REGRESSION_DUPLICATE_RESOURCE_ID;
    const duplicateProfileId = Number(process.env.REGRESSION_DUPLICATE_PROFILE_ID || process.env.REGRESSION_PROFILE_ID);
    if (duplicateResourceId && Number.isInteger(duplicateProfileId) && duplicateProfileId > 0) {
      const duplicateTarget = await expectStatus(`/api/admin/resources/${duplicateResourceId}/students`, 200, { headers: teacherHeaders });
      assertArray(duplicateTarget.selectedProfileIds, `/api/admin/resources/${duplicateResourceId}/students.selectedProfileIds`);
      const duplicateAssignment = await expectStatus(`/api/admin/resources/${duplicateResourceId}/students`, 409, {
        method: "PUT",
        headers: { ...teacherHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ profileIds: [...duplicateTarget.selectedProfileIds, duplicateProfileId] }),
      });
      assert.equal(typeof duplicateAssignment.error, "string", "a student already assigned to another teacher group must be rejected");
      const rosterAfterDuplicate = await expectStatus(`/api/admin/resources/${duplicateResourceId}/students`, 200, { headers: teacherHeaders });
      assert.deepEqual(rosterAfterDuplicate.selectedProfileIds, duplicateTarget.selectedProfileIds, "rejected duplicate assignments must not change the target roster");
    }

    const attendance = await expectStatus("/api/admin/lesson-attendance", 200, { headers: teacherHeaders });
    assertArray(attendance, "/api/admin/lesson-attendance");
    for (const [index, event] of attendance.entries()) {
      assert.equal(typeof event.resourceId, "number", `/api/admin/lesson-attendance[${index}].resourceId must be a number`);
      assert.equal(typeof event.profileId, "number", `/api/admin/lesson-attendance[${index}].profileId must be a number`);
      assert.ok(event.finalStatus === null || typeof event.finalStatus === "string", `/api/admin/lesson-attendance[${index}].finalStatus must be nullable string`);
    }
    const invalidAttendanceDecision = await expectStatus("/api/admin/lesson-attendance/1", 400, {
      method: "PATCH",
      headers: teacherHeaders,
      body: JSON.stringify({ status: "unknown-status" }),
    });
    assert.equal(typeof invalidAttendanceDecision.error, "string", "invalid attendance decisions must return an explanatory error");
    const profileId = process.env.REGRESSION_PROFILE_ID;
    if (profileId) {
      const profile = await expectStatus(`/api/admin/academic-profiles/${profileId}`, 200, { headers: teacherHeaders });
      const targetTerm = profile.currentTermNumber === 8 ? 1 : profile.currentTermNumber + 1;
      const targetCourseYear = Math.ceil(targetTerm / 2);
      const targetSemester = targetTerm % 2 === 0 ? 2 : 1;
      const manualSemesterEdit = await expectStatus(`/api/admin/academic-profiles/${profileId}`, 409, {
        method: "PATCH",
        headers: teacherHeaders,
        body: JSON.stringify({ courseYear: targetCourseYear, semester: targetSemester }),
      });
      assert.equal(typeof manualSemesterEdit.error, "string", "manual semester edits must require the promotion flow");
      const profileAfterManualEdit = await expectStatus(`/api/admin/academic-profiles/${profileId}`, 200, { headers: teacherHeaders });
      assert.equal(profileAfterManualEdit.currentTermNumber, profile.currentTermNumber, "rejected manual semester edits must preserve the current term");

      const semesterRaceProfileId = Number(process.env.REGRESSION_SEMESTER_RACE_PROFILE_ID || profileId);
      if (Number.isInteger(semesterRaceProfileId) && semesterRaceProfileId > 0) {
        const raceProfile = await expectStatus(`/api/admin/academic-profiles/${semesterRaceProfileId}`, 200, { headers: teacherHeaders });
        const startingTerm = raceProfile.currentTermNumber;
        if (startingTerm >= 8) {
          console.log("Semester correction race checks skipped; the configured regression profile is already in the final semester.");
        } else {
          const mutationHeaders = { ...teacherHeaders, "Content-Type": "application/json" };
          const promotionBody = JSON.stringify({ expectedTermNumber: startingTerm });
          const [firstPromotion, secondPromotion] = await Promise.all([
            request(`/api/admin/academic-profiles/${semesterRaceProfileId}/promote`, { method: "POST", headers: mutationHeaders, body: promotionBody }),
            request(`/api/admin/academic-profiles/${semesterRaceProfileId}/promote`, { method: "POST", headers: mutationHeaders, body: promotionBody }),
          ]);
          const promotionStatuses = [firstPromotion.response.status, secondPromotion.response.status].sort((left, right) => left - right);
          if (promotionStatuses[0] === 409 && promotionStatuses[1] === 409 && [firstPromotion.body, secondPromotion.body].some((body) => /aktivləşdirilməyib/i.test(body?.error || ""))) {
            console.log("Semester correction race checks skipped; the next semester is not active for the configured regression profile.");
          } else {
            let stillPromoted = promotionStatuses.includes(200);
            try {
              assert.deepEqual(promotionStatuses, [200, 409], "duplicate promotion requests must produce exactly one success and one stale-request conflict");
              const promotedProfile = await expectStatus(`/api/admin/academic-profiles/${semesterRaceProfileId}`, 200, { headers: teacherHeaders });
              assert.equal(promotedProfile.currentTermNumber, startingTerm + 1, "the winning promotion must advance the student exactly one semester");
              assert.notEqual(promotedProfile.promotionApprovedAt, null, "a successful promotion must expose its approval timestamp to admin views");
              assert.equal(promotedProfile.promotionFromTerm, startingTerm, "a successful promotion must record its source semester");

              const staleDemotion = await expectStatus(`/api/admin/academic-profiles/${semesterRaceProfileId}/demote`, 409, {
                method: "POST",
                headers: mutationHeaders,
                body: JSON.stringify({ expectedTermNumber: startingTerm }),
              });
              assert.equal(typeof staleDemotion.error, "string", "a stale demotion must return an explanatory conflict");
              const unchangedAfterStaleDemotion = await expectStatus(`/api/admin/academic-profiles/${semesterRaceProfileId}`, 200, { headers: teacherHeaders });
              assert.equal(unchangedAfterStaleDemotion.currentTermNumber, startingTerm + 1, "a stale demotion must not overwrite a newer semester decision");

              const restoredProfile = await expectStatus(`/api/admin/academic-profiles/${semesterRaceProfileId}/demote`, 200, {
                method: "POST",
                headers: mutationHeaders,
                body: JSON.stringify({ expectedTermNumber: startingTerm + 1 }),
              });
              stillPromoted = false;
              assert.equal(restoredProfile.currentTermNumber, startingTerm, "a valid demotion must return the student to the previous semester");
              assert.equal(restoredProfile.promotionApprovedAt, null, "a valid demotion must clear the promotion approval timestamp");
              assert.equal(restoredProfile.promotionApprovedBy, null, "a valid demotion must clear the promotion approver");
              assert.equal(restoredProfile.promotionFromTerm, null, "a valid demotion must clear the promotion source semester");
            } finally {
              if (stillPromoted) {
                await request(`/api/admin/academic-profiles/${semesterRaceProfileId}/demote`, {
                  method: "POST",
                  headers: mutationHeaders,
                  body: JSON.stringify({ expectedTermNumber: startingTerm + 1 }),
                });
              }
            }
          }
        }
      }
    }
    await expectStatus("/api/admin/audit-events", 403, { headers: teacherHeaders });
    await expectStatus("/api/admin/student-deletion-audit", 403, { headers: teacherHeaders });
    const missingDeletionReason = await expectStatus(`/api/admin/students/${process.env.REGRESSION_PROFILE_ID || 1}`, 400, {
      method: "DELETE",
      headers: { ...teacherHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(typeof missingDeletionReason.error, "string", "student deletion without a reason must return an explanatory 400 error");
    await expectStatus("/api/admin/graduation-candidates", 403, { headers: teacherHeaders });
  }

  const ownerAuthorization = process.env.REGRESSION_OWNER_AUTHORIZATION;
  if (ownerAuthorization) {
    const ownerHeaders = { Authorization: ownerAuthorization, "Content-Type": "application/json" };
    const graduationCandidates = await expectStatus("/api/admin/graduation-candidates", 200, { headers: ownerHeaders });
    assertObject(graduationCandidates, "/api/admin/graduation-candidates");
    assert.equal(typeof graduationCandidates.graduationTerm, "number", "graduation term must be a number");
    assertArray(graduationCandidates.students, "/api/admin/graduation-candidates.students");
    for (const [index, student] of graduationCandidates.students.entries()) {
      assert.equal(typeof student.profileId, "number", `/api/admin/graduation-candidates.students[${index}].profileId must be a number`);
      assert.equal(student.currentTermNumber, graduationCandidates.graduationTerm, `/api/admin/graduation-candidates.students[${index}] must be in the graduation term`);
    }
    const invalidGraduation = await expectStatus("/api/admin/students/999999999/graduate", 404, { headers: ownerHeaders, method: "POST" });
    assert.equal(typeof invalidGraduation.error, "string", "invalid graduation profile must return an explanatory error");
    const certificateList = await expectStatus("/api/admin/graduation-certificates", 200, { headers: ownerHeaders });
    assertArray(certificateList, "/api/admin/graduation-certificates");
    for (const [index, item] of certificateList.entries()) {
      assert.equal(typeof item.profileId, "number", `/api/admin/graduation-certificates[${index}].profileId must be a number`);
      assert.equal(typeof item.studentName === "undefined", true, "certificate list must not expose a synthetic studentName field");
      assert.ok(item.certificate === null || typeof item.certificate === "object", `/api/admin/graduation-certificates[${index}].certificate must be nullable object`);
      if (item.certificate) {
        assert.match(item.certificate.certificateNumber, /^CERT-\d{4}-\d{4,}$/, "certificate number must use the stable CERT-YYYY-NNNN format");
        assert.equal(typeof item.certificate.verificationToken, "string", "certificate verification token must be returned to certificate managers");
      }
    }
    const invalidCertificate = await expectStatus("/api/admin/students/999999999/certificate", 409, { headers: ownerHeaders, method: "POST" });
    assert.equal(typeof invalidCertificate.error, "string", "certificate creation for a missing or non-graduated student must return an explanatory error");
    const graduationProfileId = process.env.REGRESSION_GRADUATION_PROFILE_ID;
    if (graduationProfileId) {
       const statisticsBeforeGraduation = await expectStatus("/api/system-statistics", 200);
       assertObject(statisticsBeforeGraduation, "/api/system-statistics before graduation");
      const graduationResult = await expectStatus(`/api/admin/students/${graduationProfileId}/graduate`, 200, {
        headers: ownerHeaders,
        method: "POST",
      });
      assert.equal(graduationResult.profileId, Number(graduationProfileId), "graduation response must identify the graduated student");
      assert.equal(graduationResult.graduationTerm, graduationCandidates.graduationTerm, "graduation response must use the active graduation term");
      assert.equal(typeof graduationResult.studentName, "string", "graduation response must include the student name");
       const statisticsAfterGraduation = await expectStatus("/api/system-statistics", 200);
       assert.equal(statisticsAfterGraduation.graduatedStudents, statisticsBeforeGraduation.graduatedStudents + 1, "graduating a student must increase the graduated count");
       assert.equal(statisticsAfterGraduation.currentStudents, statisticsBeforeGraduation.currentStudents - 1, "graduating a student must remove them from the current-student count");

       const restoredGraduation = await expectStatus(`/api/admin/students/${graduationProfileId}/ungraduate`, 200, {
         headers: ownerHeaders,
         method: "POST",
       });
       assert.equal(restoredGraduation.profileId, Number(graduationProfileId), "restoring graduation must identify the student");
       assert.equal(restoredGraduation.status, "approved", "restoring graduation must return the approved status");
       const statisticsAfterRestore = await expectStatus("/api/system-statistics", 200);
       assert.equal(statisticsAfterRestore.graduatedStudents, statisticsBeforeGraduation.graduatedStudents, "restoring graduation must remove the student from the graduated count");
       assert.equal(statisticsAfterRestore.currentStudents, statisticsBeforeGraduation.currentStudents, "restoring graduation must return the student to the current-student count");

       const regraduationResult = await expectStatus(`/api/admin/students/${graduationProfileId}/graduate`, 200, {
         headers: ownerHeaders,
         method: "POST",
       });
       assert.equal(regraduationResult.profileId, Number(graduationProfileId), "a restored student must be eligible for graduation again");
      const certificate = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, { headers: ownerHeaders, method: "POST" });
      assert.match(certificate.certificateNumber, /^CERT-\d{4}-\d{4,}$/, "created certificate number must use the stable CERT-YYYY-NNNN format");
      assert.equal(typeof certificate.verificationToken, "string", "created certificate must include a verification token");
       assert.equal(typeof certificate.gpa, "number", "certificate GPA must be numeric");
       assert.ok(certificate.gpa >= 0 && certificate.gpa <= 5, "certificate GPA must use the 0-5 scale");
       assert.ok(["Zəif", "Orta", "Əla", "Fərqlənmə ilə bitirən"].includes(certificate.graduationCategory), "certificate graduation category must be one of the official categories");
       assert.equal(certificate.directorTitle, "Akademiya Rəhbəri", "new certificates must use the default director title");
       assert.equal(certificate.directorName, "Fərman İsayev", "new certificates must use the default director name");
       assert.equal(certificate.showDirector, true, "new certificates must show the director by default");
       assert.equal(certificate.showSeal, true, "new certificates must show the seal by default");
       assert.equal(certificate.showGpa, true, "new certificates must show GPA by default");
       assert.equal(certificate.showGraduationCategory, true, "new certificates must show the graduation category by default");
       assert.equal(certificate.verificationLocked, false, "new certificates must be publicly verifiable by default");
      const repeatedCertificate = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, { headers: ownerHeaders, method: "POST" });
      assert.equal(repeatedCertificate.id, certificate.id, "repeated certificate creation must be idempotent");
      assert.equal(repeatedCertificate.certificateNumber, certificate.certificateNumber, "repeated certificate creation must preserve the certificate number");
       assert.equal(repeatedCertificate.verificationToken, certificate.verificationToken, "repeated certificate creation must preserve the verification token");
       const blockedRestore = await expectStatus(`/api/admin/students/${graduationProfileId}/ungraduate`, 409, {
         headers: ownerHeaders,
         method: "POST",
       });
       assert.equal(typeof blockedRestore.error, "string", "students with certificates must not be restored to approved status");
      const verification = await expectStatus(`/api/certificates/verify/${encodeURIComponent(certificate.verificationToken)}`, 200);
      assert.equal(verification.valid, true, "a newly created certificate must verify publicly");
      assert.equal(verification.certificateNumber, certificate.certificateNumber, "public verification must return the certificate number");
       assert.equal(verification.gpa, certificate.gpa, "public verification must use the certificate GPA snapshot");
       assert.equal(verification.graduationCategory, certificate.graduationCategory, "public verification must use the certificate category snapshot");
       assert.equal(verification.directorName, certificate.directorName, "public verification must expose the configured director while visible");
       const editedCertificate = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, {
         headers: ownerHeaders,
         method: "PATCH",
         body: JSON.stringify({
           directorTitle: "Akademiya Direktoru",
           directorName: "Test Rəhbər",
           showDirector: false,
           showSeal: false,
           showGpa: false,
           showGraduationCategory: false,
           certificateTitle: "MƏZUNİYYƏT SƏNƏDİ",
           bodyText: "Test mətn {term}-ci semestr üzrə proqramı tamamlamışdır.",
           honorText: "Test nəticə mətni.",
         }),
       });
       assert.equal(editedCertificate.id, certificate.id, "editing certificate settings must preserve its id");
       assert.equal(editedCertificate.certificateNumber, certificate.certificateNumber, "editing certificate settings must preserve its number");
       assert.equal(editedCertificate.verificationToken, certificate.verificationToken, "editing certificate settings must preserve its verification token");
       assert.equal(editedCertificate.gpa, certificate.gpa, "editing certificate settings must not change the GPA snapshot");
       assert.equal(editedCertificate.showDirector, false, "certificate director visibility must be editable");
       assert.equal(editedCertificate.showSeal, false, "certificate seal visibility must be editable");
       assert.equal(editedCertificate.showGpa, false, "certificate GPA visibility must be editable");
       assert.equal(editedCertificate.showGraduationCategory, false, "certificate graduation category visibility must be editable");
       const hiddenDirectorVerification = await expectStatus(`/api/certificates/verify/${encodeURIComponent(certificate.verificationToken)}`, 200);
       assert.equal(hiddenDirectorVerification.valid, true, "an edited but unlocked certificate must remain verifiable");
       assert.equal(hiddenDirectorVerification.directorName, null, "hidden director settings must be respected by public verification");
       assert.equal(hiddenDirectorVerification.gpa, null, "hidden GPA settings must be respected by public verification");
       assert.equal(hiddenDirectorVerification.graduationCategory, null, "hidden category settings must be respected by public verification");
       const lockedCertificate = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, {
         headers: ownerHeaders,
         method: "PATCH",
         body: JSON.stringify({ verificationLocked: true }),
       });
       assert.equal(lockedCertificate.verificationLocked, true, "owner must be able to lock public verification");
       const lockedVerification = await expectStatus(`/api/certificates/verify/${encodeURIComponent(certificate.verificationToken)}`, 200);
       assert.equal(lockedVerification.valid, false, "a locked certificate must fail public verification");
       assert.equal(lockedVerification.certificateNumber, null, "locked verification must not expose the certificate number");
       assert.equal(lockedVerification.gpa, null, "locked verification must not expose the GPA");
      const revokedCertificate = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, {
        headers: ownerHeaders,
        method: "PATCH",
        body: JSON.stringify({ revoked: true }),
      });
      assert.equal(revokedCertificate.id, certificate.id, "revoking a certificate must preserve its id");
      assert.equal(revokedCertificate.certificateNumber, certificate.certificateNumber, "revoking a certificate must preserve its number");
      assert.equal(revokedCertificate.verificationToken, certificate.verificationToken, "revoking a certificate must preserve its verification token");
      assert.equal(typeof revokedCertificate.revokedAt, "string", "revoked certificates must include a revocation timestamp");
      const revokedVerification = await expectStatus(`/api/certificates/verify/${encodeURIComponent(certificate.verificationToken)}`, 200);
      assert.equal(revokedVerification.valid, false, "a revoked certificate must fail public verification");
      const restoredCertificate = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, {
        headers: ownerHeaders,
        method: "PATCH",
        body: JSON.stringify({ revoked: false }),
      });
      assert.equal(restoredCertificate.id, certificate.id, "restoring a certificate must preserve its id");
      assert.equal(restoredCertificate.certificateNumber, certificate.certificateNumber, "restoring a certificate must preserve its number");
      assert.equal(restoredCertificate.verificationToken, certificate.verificationToken, "restoring a certificate must preserve its verification token");
      assert.equal(restoredCertificate.revokedAt, null, "restored certificates must clear the revocation timestamp");
       const restoredSettings = await expectStatus(`/api/admin/students/${graduationProfileId}/certificate`, 200, {
         headers: ownerHeaders,
         method: "PATCH",
         body: JSON.stringify({
           verificationLocked: false,
           directorTitle: certificate.directorTitle,
           directorName: certificate.directorName,
           showDirector: certificate.showDirector,
           showSeal: certificate.showSeal,
           showGpa: certificate.showGpa,
           showGraduationCategory: certificate.showGraduationCategory,
           certificateTitle: certificate.certificateTitle,
           bodyText: certificate.bodyText,
           honorText: certificate.honorText,
         }),
       });
       assert.equal(restoredSettings.verificationLocked, false, "owner must be able to unlock public verification");
      const restoredVerification = await expectStatus(`/api/certificates/verify/${encodeURIComponent(certificate.verificationToken)}`, 200);
      assert.equal(restoredVerification.valid, true, "a restored certificate must verify publicly while the student is graduated");
    }
    const auditEvents = await expectStatus("/api/admin/audit-events?limit=50", 200, { headers: ownerHeaders });
    assertArray(auditEvents, "/api/admin/audit-events");
    for (const [index, event] of auditEvents.entries()) {
      assert.equal(typeof event.id, "number", `/api/admin/audit-events[${index}].id must be a number`);
      assert.equal(typeof event.eventType, "string", `/api/admin/audit-events[${index}].eventType must be a string`);
      assert.equal(typeof event.actorClerkUserId, "string", `/api/admin/audit-events[${index}].actorClerkUserId must be a string`);
      assert.equal(typeof event.targetType, "string", `/api/admin/audit-events[${index}].targetType must be a string`);
      assert.equal(typeof event.createdAt, "string", `/api/admin/audit-events[${index}].createdAt must be a string`);
      assertObject(event.details, `/api/admin/audit-events[${index}].details`);
      for (const key of Object.keys(event.details)) {
        assert.ok(!/(password|token|secret|privateKey)/i.test(key), `audit details must not expose secret field ${key}`);
      }
    }
    const deletionAudit = await expectStatus("/api/admin/student-deletion-audit", 200, { headers: ownerHeaders });
    assertArray(deletionAudit, "/api/admin/student-deletion-audit");
    for (const [index, entry] of deletionAudit.entries()) {
      assert.equal(typeof entry.id, "number", `/api/admin/student-deletion-audit[${index}].id must be a number`);
      assert.equal(typeof entry.profileId, "number", `/api/admin/student-deletion-audit[${index}].profileId must be a number`);
      assert.equal(typeof entry.applicationId, "number", `/api/admin/student-deletion-audit[${index}].applicationId must be a number`);
      assert.equal(typeof entry.studentName, "string", `/api/admin/student-deletion-audit[${index}].studentName must be a string`);
      assert.equal(typeof entry.email, "string", `/api/admin/student-deletion-audit[${index}].email must be a string`);
      assert.equal(typeof entry.reason, "string", `/api/admin/student-deletion-audit[${index}].reason must be a string`);
      assert.ok(entry.reason.trim().length > 0, `/api/admin/student-deletion-audit[${index}].reason must not be empty`);
      assert.equal(typeof entry.deletedByName, "string", `/api/admin/student-deletion-audit[${index}].deletedByName must be a string`);
      assert.ok(Number.isFinite(new Date(entry.deletedAt).getTime()), `/api/admin/student-deletion-audit[${index}].deletedAt must be a valid timestamp`);
    }
    for (let index = 1; index < auditEvents.length; index += 1) {
      assert.ok(
        new Date(auditEvents[index - 1].createdAt).getTime() >= new Date(auditEvents[index].createdAt).getTime(),
        "audit history must show newest changes first",
      );
    }

    const originalWindow = await expectStatus("/api/admin/application-window", 200, { headers: ownerHeaders });
    const assertIsoTimestamp = (value, path) => {
      assert.equal(typeof value, "string", `${path} must be an ISO timestamp`);
      assert.ok(Number.isFinite(Date.parse(value)), `${path} must be a parseable ISO timestamp`);
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `${path} must be normalized to UTC ISO format`);
    };
    const assertWindow = async (expectedStatus, expectedOpen, expectedNextOpenAt = null) => {
      const window = await expectStatus("/api/application-window", 200);
      assert.equal(window.status, expectedStatus, `application window should be ${expectedStatus}`);
      assert.equal(window.isOpen, expectedOpen, `application window ${expectedStatus} open flag changed`);
      assert.equal(window.nextOpenAt, expectedNextOpenAt, `application window ${expectedStatus} nextOpenAt changed`);
      if (window.opensAt !== null) assertIsoTimestamp(window.opensAt, `/api/application-window.opensAt (${expectedStatus})`);
      if (window.closesAt !== null) assertIsoTimestamp(window.closesAt, `/api/application-window.closesAt (${expectedStatus})`);
      if (window.nextOpenAt !== null) assertIsoTimestamp(window.nextOpenAt, `/api/application-window.nextOpenAt (${expectedStatus})`);
      return window;
    };
    const updateWindow = (opensAt, closesAt) => expectStatus("/api/admin/application-window", 200, {
      method: "PATCH",
      headers: ownerHeaders,
      body: JSON.stringify({ opensAt, closesAt }),
    });
    try {
      const invalidWindow = await expectStatus("/api/admin/application-window", 400, {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify({
          opensAt: new Date(Date.now() + 90_000).toISOString(),
          closesAt: new Date(Date.now() + 30_000).toISOString(),
        }),
      });
      assert.match(invalidWindow.error, /Bitmə vaxtı/i, "invalid application window must explain the ordering error");
      const partialWindow = await expectStatus("/api/admin/application-window", 400, {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify({ opensAt: new Date(Date.now() + 30_000).toISOString(), closesAt: null }),
      });
      assert.match(partialWindow.error, /hər ikisi|ikisi/i, "partial application windows must be rejected");

      await updateWindow(null, null);
      await assertWindow("unscheduled", true);

      const now = Date.now();
      const futureOpen = new Date(now + 30_000).toISOString();
      await updateWindow(futureOpen, new Date(now + 90_000).toISOString());
      await assertWindow("not_started", false, futureOpen);

      await updateWindow(new Date(Date.now() - 30_000).toISOString(), new Date(Date.now() + 30_000).toISOString());
      await assertWindow("open", true);

      await updateWindow(new Date(Date.now() - 90_000).toISOString(), new Date(Date.now() - 30_000).toISOString());
      await assertWindow("ended", false);
      const closedUpload = await expectStatus("/api/applications/upload-url", 403, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "recommendation.pdf", size: 1024, contentType: "application/pdf" }),
      });
      assert.equal(closedUpload.applicationWindow.status, "ended", "closed upload must include ended window status");
      if (studentAuthorization) {
        const closedSubmit = await expectStatus("/api/applications", 403, {
          method: "POST",
          headers: { Authorization: studentAuthorization, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        assert.equal(closedSubmit.applicationWindow.status, "ended", "closed submit must include ended window status");
      }

      const exactOpening = new Date(Date.now()).toISOString();
      const exactOpeningClose = new Date(Date.parse(exactOpening) + 90_000).toISOString();
      await updateWindow(exactOpening, exactOpeningClose);
      const exactOpeningWindow = await assertWindow("open", true);
      assert.equal(exactOpeningWindow.opensAt, exactOpening, "exact opening instant must be preserved");
      assert.equal(exactOpeningWindow.closesAt, exactOpeningClose, "exact opening test must preserve its closing instant");

      const exactClose = new Date(Date.now()).toISOString();
      const exactCloseOpening = new Date(Date.parse(exactClose) - 90_000).toISOString();
      await updateWindow(exactCloseOpening, exactClose);
      const exactCloseWindow = await assertWindow("ended", false);
      assert.equal(exactCloseWindow.opensAt, exactCloseOpening, "exact closing test must preserve its opening instant");
      assert.equal(exactCloseWindow.closesAt, exactClose, "exact closing instant must be preserved");

      const timezoneOpeningInstant = new Date(Date.now() + 30_000);
      const timezoneClosingInstant = new Date(timezoneOpeningInstant.getTime() + 60_000);
      const toAzerbaijanIso = (date) => `${new Date(date.getTime() + 4 * 60 * 60 * 1000).toISOString().slice(0, -1)}+04:00`;
      const timezoneWindow = await updateWindow(
        toAzerbaijanIso(timezoneOpeningInstant),
        toAzerbaijanIso(timezoneClosingInstant),
      );
      assert.equal(timezoneWindow.opensAt, timezoneOpeningInstant.toISOString(), "timezone-offset opening must be normalized without changing its instant");
      assert.equal(timezoneWindow.closesAt, timezoneClosingInstant.toISOString(), "timezone-offset closing must be normalized without changing its instant");
      await assertWindow("not_started", false, timezoneOpeningInstant.toISOString());
    } finally {
      await updateWindow(originalWindow.opensAt, originalWindow.closesAt);
    }
  }

  console.log(`Regression checks passed against ${baseUrl}`);
  console.log(`Validated ${questions.length} questions, ${articles.length} articles, ${protectedReads.length} protected reads, and ${protectedWrites.length} protected writes.`);
  console.log(authorization ? "Authenticated PDF upload checks were enabled." : "Authenticated PDF upload checks skipped; set REGRESSION_AUTHORIZATION to enable them.");
  console.log(studentAuthorization ? "Student-versus-teacher role checks were enabled." : "Student-versus-teacher role checks skipped; set REGRESSION_STUDENT_AUTHORIZATION to enable them.");
  console.log(teacherAuthorization ? "Teacher assignment scope checks were enabled." : "Teacher assignment scope checks skipped; set REGRESSION_TEACHER_AUTHORIZATION to enable them.");
  console.log(ownerAuthorization ? "Application window boundary checks were enabled." : "Application window boundary checks skipped; set REGRESSION_OWNER_AUTHORIZATION to enable them.");
}

run().catch((error) => {
  console.error("Regression checks failed.");
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});