import { test } from "node:test";
import assert from "node:assert/strict";
import { GetAdminUserProfileResponse } from "@workspace/api-zod";
import { buildAccountProfile, buildAdminUserProfile, profileInputError, PROFILE_NAME_PLACEHOLDER } from "./accountProfile.js";
import { UpdateAdminUserProfileBody } from "@workspace/api-zod";

const freshClerkUser = { firstName: null, lastName: null, username: null, primaryEmailAddress: { emailAddress: "yeni.abituriyent@example.com" } };

test("fresh applicant without application row and without Clerk names yields a schema-valid profile (was 500)", () => {
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

// Clerk panelindən birbaşa yaradılmış müəllim hesabı (user_3KWB...): müraciət yoxdur, Clerk-də ad/soyad boşdur.
const clerkCreatedTeacher = { firstName: null, lastName: null, username: null, primaryEmailAddress: { emailAddress: "adayev.farhad@gmail.com" }, emailAddresses: [{ emailAddress: "adayev.farhad@gmail.com" }] };

test("admin profile for a Clerk-created teacher without application/names is schema-valid with empty names (was 500)", () => {
  const profile = buildAdminUserProfile({ userId: "user_3KWBBqzsE9aLqjRojZKNpSMjpsG", clerkUser: clerkCreatedTeacher, application: undefined, role: "teacher", rolePermissions: ["schedule"] });
  const parsed = GetAdminUserProfileResponse.safeParse(profile);
  assert.equal(parsed.success, true, JSON.stringify(parsed.error?.issues));
  assert.equal(profile.firstName, "");
  assert.equal(profile.lastName, "");
  assert.equal(profile.email, "adayev.farhad@gmail.com");
  assert.equal(profile.phone, "");
  assert.equal(profile.hasApplication, false);
  assert.equal(parsed.data?.hasApplication, false);
});

test("admin profile keeps Clerk names and application flag", () => {
  const profile = buildAdminUserProfile({ userId: "u", clerkUser: { ...clerkCreatedTeacher, firstName: " Fərhad ", lastName: "Adayev" }, application: { phone: "+994501234567", birthDate: "2000-01-01", arabicLevel: "Əla" }, role: "teacher", rolePermissions: [] });
  assert.deepEqual([profile.firstName, profile.lastName, profile.hasApplication, profile.arabicLevel], ["Fərhad", "Adayev", true, "Əla"]);
});

test("staff save without application needs only names; application-backed save still needs phone and birth date", () => {
  const staffBody = { firstName: "Fərhad", lastName: "Adayev", username: null, email: "adayev.farhad@gmail.com", phone: "", birthDate: "", arabicLevel: "Orta" };
  assert.equal(UpdateAdminUserProfileBody.safeParse(staffBody).success, true);
  assert.equal(profileInputError(staffBody, false), null);
  assert.match(profileInputError(staffBody, true) ?? "", /Telefon/);
  assert.match(profileInputError({ ...staffBody, phone: "+994501234567" }, true) ?? "", /Doğum/);
  assert.equal(profileInputError({ ...staffBody, phone: "+994501234567", birthDate: "2000-01-01" }, true), null);
  assert.match(profileInputError({ ...staffBody, firstName: "  " }, false) ?? "", /Ad və soyad/);
  assert.equal(UpdateAdminUserProfileBody.safeParse({ ...staffBody, firstName: "" }).success, false);
  assert.equal(UpdateAdminUserProfileBody.safeParse({ ...staffBody, phone: "0501234567" }).success, false);
});
