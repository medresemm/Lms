// GET /account/profile cavabını təhlükəsiz qurur.
// Yeni qeydiyyatdan keçmiş abituriyentdə (e-poçt təsdiqlənib, müraciət sətri hələ yazılmayıb)
// Clerk istifadəçisinin adı/soyadı boş olur; əvvəllər bu, cavab sxemində (minLength: 1) xəta verib 500 qaytarırdı.
// Burada hər sahə sxemə uyğun dəyərə endirilir ki, belə hallarda 500 əvəzinə adi 200 cavabı qayıtsın.

export const ARABIC_LEVELS = ["Zəif", "Orta", "Yaxşı", "Əla"] as const;
export type ArabicLevel = (typeof ARABIC_LEVELS)[number];

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_PATTERN = /^\+994\d{9}$/;
export const PROFILE_NAME_PLACEHOLDER = "—";

export type AccountProfileClerkUser = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: Array<{ emailAddress?: string | null }> | null;
};

export type AccountProfileApplication = {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
  phone?: string | null;
  birthDate?: string | null;
  arabicLevel?: string | null;
} | null | undefined;

export type AccountProfile<Role extends string = string> = {
  id: string;
  firstName: string;
  lastName: string;
  username: string | null;
  email: string;
  phone: string;
  birthDate: string;
  arabicLevel: ArabicLevel;
  role: Role;
  rolePermissions: string[];
};

function clean(value: string | null | undefined, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function firstNonEmpty(max: number, ...values: Array<string | null | undefined>) {
  for (const value of values) {
    const cleaned = clean(value, max);
    if (cleaned) return cleaned;
  }
  return "";
}

export function buildAccountProfile<Role extends string>(input: {
  userId: string;
  clerkUser: AccountProfileClerkUser;
  application: AccountProfileApplication;
  role: Role;
  rolePermissions: string[];
}): AccountProfile<Role> {
  const { userId, clerkUser, application, role, rolePermissions } = input;
  const emailCandidates = [
    clerkUser.primaryEmailAddress?.emailAddress,
    ...(clerkUser.emailAddresses ?? []).map((entry) => entry?.emailAddress),
    application?.email,
  ];
  const email = emailCandidates.map((value) => clean(value, 320)).find((value) => EMAIL_PATTERN.test(value)) ?? "";
  const emailLocalPart = email.split("@")[0] ?? "";
  const phone = clean(application?.phone, 40);
  const arabicLevel = ARABIC_LEVELS.find((level) => level === application?.arabicLevel) ?? "Orta";
  return {
    id: userId,
    // Ad hələ yoxdursa (müraciət sətri yazılmamış yeni hesab) e-poçtun yerli hissəsi, o da yoxdursa tire göstərilir.
    firstName: firstNonEmpty(100, clerkUser.firstName, application?.firstName, emailLocalPart) || PROFILE_NAME_PLACEHOLDER,
    lastName: firstNonEmpty(100, clerkUser.lastName, application?.lastName) || PROFILE_NAME_PLACEHOLDER,
    username: firstNonEmpty(100, clerkUser.username, application?.username) || null,
    email,
    phone: PHONE_PATTERN.test(phone) ? phone : "",
    birthDate: clean(application?.birthDate, 20),
    arabicLevel,
    role,
    rolePermissions: rolePermissions.filter((permission): permission is string => typeof permission === "string"),
  };
}

// Admin «Məlumatları düzəlt» pəncərəsi üçün profil.
// Clerk panelindən birbaşa yaradılmış heyət hesablarında (müəllim və s.) müraciət sətri yoxdur və Clerk-də ad/soyad boşdur.
// Əvvəllər belə hesablarda cavab sxemi (ad minLength: 1) pozulur və GET 500 qaytarırdı.
// Burada ad/soyad boş qala bilər (admin formada özü yazsın deyə — yer tutucu «—» formaya düşməsin),
// qalan sahələr isə sxemə uyğun təhlükəsiz dəyərlərə endirilir.
export function buildAdminUserProfile<Role extends string>(input: {
  userId: string;
  clerkUser: AccountProfileClerkUser;
  application: AccountProfileApplication;
  role: Role;
  rolePermissions: string[];
}): AccountProfile<Role> & { hasApplication: boolean } {
  const base = buildAccountProfile(input);
  const { clerkUser, application } = input;
  return {
    ...base,
    firstName: firstNonEmpty(100, clerkUser.firstName, application?.firstName),
    lastName: firstNonEmpty(100, clerkUser.lastName, application?.lastName),
    hasApplication: Boolean(application),
  };
}

export type ProfileInputExtras = { phone: string; birthDate: string };

// Müraciəti (tələbə profili) olan hesablarda telefon və doğum tarixi məcburidir.
// Müraciəti olmayan heyət hesablarında bu sahələr saxlanılmır, ona görə boş qala bilər.
export function profileInputError(input: ProfileInputExtras & { firstName: string; lastName: string }, hasApplication: boolean): string | null {
  if (!input.firstName.trim() || !input.lastName.trim()) return "Ad və soyad boş ola bilməz.";
  if (!hasApplication) return null;
  if (!PHONE_PATTERN.test(input.phone.trim())) return "Telefon nömrəsi +994XXXXXXXXX formatında olmalıdır.";
  if (!input.birthDate.trim()) return "Doğum tarixi daxil edilməlidir.";
  return null;
}
