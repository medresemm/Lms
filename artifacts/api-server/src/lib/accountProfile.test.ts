import { test } from "node:test";
import assert from "node:assert/strict";
import { GetAdminUserProfileResponse } from "@workspace/api-zod";
import { buildAccountProfile, PROFILE_NAME_PLACEHOLDER } from "./accountProfile.js";

const freshClerkUser = { firstName: null, lastName: null, username: null, primaryEmailAddress: { emailAddress: "yeni.abituriyent@example.com" } };

test("fresh applicant without application row and without Clerk names yields a schema-valid profile (was 500)", () => {
  // Köhnə davranışın təkrarı: boş ad sxemdə xəta verirdi.
  const legacy = { id: "user_1", firstName: "", lastName: "", username: null, email: "yeni.abituriyent@example.com", phone: "", birthDate: "", arabicLevel: "Orta", role: "none", rolePermissions: [] };
  assert.equal(GetAdminUserProfileResponse.safeParse(legacy).success, false);

  const profile = buildAccountProfile({ userId: "user_1", clerkUser: freshClerkUser, application: undefined, role: "none", rolePermissions: [] });
  const parsed = GetAdminUserProfileResponse.safeParse(profile);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  assert.equal(profile.firstName, "yeni.abituriyent");
  assert.equal(profile.lastName, PROFILE_NAME_PLACEHOLDER);
  assert.equal(profile.role, "none");
  assert.equal(profile.arabicLevel, "Orta");
});

test("application row fills names and keeps valid phone/level", () => {
  const profile = buildAccountProfile({
    userId: "user_2", clerkUser: freshClerkUser, role: "none", rolePermissions: [],
    application: { firstName: "Əli", lastName: "Məmmədov", username: "ali", email: "x@example.com", phone: "+994501234567", birthDate: "2000-01-01", arabicLevel: "Yaxşı" },
  });
  assert.equal(GetAdminUserProfileResponse.safeParse(profile).success, true);
  assert.deepEqual([profile.firstName, profile.lastName, profile.phone, profile.arabicLevel, profile.username], ["Əli", "Məmmədov", "+994501234567", "Yaxşı", "ali"]);
});

test("legacy phone, unknown arabic level and missing email are sanitized instead of throwing", () => {
  const profile = buildAccountProfile({
    userId: "user_3", clerkUser: { firstName: "  Aynur ", lastName: "Quliyeva", primaryEmailAddress: null }, role: "teacher", rolePermissions: ["schedule"],
    application: { phone: "0551234567", arabicLevel: "Yoxdur", email: "aynur@example.com", birthDate: "1999-02-03" },
  });
  assert.equal(GetAdminUserProfileResponse.safeParse(profile).success, true);
  assert.deepEqual([profile.firstName, profile.phone, profile.arabicLevel, profile.email], ["Aynur", "", "Orta", "aynur@example.com"]);
});
