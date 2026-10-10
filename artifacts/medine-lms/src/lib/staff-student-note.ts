/** «İstifadəçi rolları» bölməsində tələbə profili olan hesaba işçi rolu veriləndə göstərilən qısa qeyd. */
export type StudentRecordInfo = { clerkUserId: string; profileId: number; studentNumber: number; groupCount: number };
export type RoleValue = 'none' | 'teacher' | 'supervisor' | 'owner_assistant' | 'admin' | 'owner';

const roleNames: Record<Exclude<RoleValue, 'none'>, string> = {
  teacher: 'Müəllim',
  admin: 'Müəllim',
  supervisor: 'Nəzarətçi',
  owner_assistant: 'İdarə heyəti',
  owner: 'Sistem sahibi',
};

export function formatStudentNumber(value: number) {
  return `T${String(value).padStart(4, '0')}`;
}

export type StaffNoteLabels = {
  groupClause?: string;
  promote?: string;
  hidden?: string;
  roles?: Partial<Record<Exclude<RoleValue, 'none'>, string>>;
};

/**
 * currentRole — hesabın indiki rolu, selectedRole — seçilmiş (hələ yadda saxlanmamış ola bilər) rol.
 * Tələbə profili yoxdursa və ya hesab tələbə olaraq qalırsa, qeyd göstərilmir.
 * labels defaultları indiki Azərbaycan mətnidir (testlər eyni sətri görür).
 */
export function staffStudentNote(record: StudentRecordInfo | undefined, currentRole: RoleValue, selectedRole: RoleValue, labels?: StaffNoteLabels) {
  if (!record || selectedRole === 'none') return null;
  const number = formatStudentNumber(record.studentNumber);
  const role = labels?.roles?.[selectedRole] ?? roleNames[selectedRole];
  const groups = record.groupCount > 0
    ? (labels?.groupClause ?? ' və {n} müəllim qrupunda tələbə kimi qeydiyyatdadır').replace('{n}', String(record.groupCount))
    : '';
  if (currentRole === 'none') {
    return (labels?.promote ?? 'Bu hesab {number} nömrəli tələbədir{groups}. {role} rolu verildikdən sonra tələbə siyahılarında və saylarda görünməyəcək. Qiymət, davamiyyət və qrup məlumatları silinmir; hesab yenidən «Adi istifadəçi» edilsə, tələbə kimi geri qayıdır.')
      .replace('{number}', number)
      .replace('{groups}', groups)
      .replace('{role}', role);
  }
  return (labels?.hidden ?? 'Bu hesabın {number} nömrəli tələbə qeydi var{groups}. İşçi rolunda olduğu üçün tələbə siyahılarında göstərilmir; «Adi istifadəçi» edilsə, yenidən görünəcək.')
    .replace('{number}', number)
    .replace('{groups}', groups);
}
