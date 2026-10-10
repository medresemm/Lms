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

/**
 * currentRole — hesabın indiki rolu, selectedRole — seçilmiş (hələ yadda saxlanmamış ola bilər) rol.
 * Tələbə profili yoxdursa və ya hesab tələbə olaraq qalırsa, qeyd göstərilmir.
 */
export function staffStudentNote(record: StudentRecordInfo | undefined, currentRole: RoleValue, selectedRole: RoleValue) {
  if (!record || selectedRole === 'none') return null;
  const number = formatStudentNumber(record.studentNumber);
  const groups = record.groupCount > 0 ? ` və ${record.groupCount} müəllim qrupunda tələbə kimi qeydiyyatdadır` : '';
  if (currentRole === 'none') {
    return `Bu hesab ${number} nömrəli tələbədir${groups}. ${roleNames[selectedRole]} rolu verildikdən sonra tələbə siyahılarında və saylarda görünməyəcək. Qiymət, davamiyyət və qrup məlumatları silinmir; hesab yenidən «Adi istifadəçi» edilsə, tələbə kimi geri qayıdır.`;
  }
  return `Bu hesabın ${number} nömrəli tələbə qeydi var${groups}. İşçi rolunda olduğu üçün tələbə siyahılarında göstərilmir; «Adi istifadəçi» edilsə, yenidən görünəcək.`;
}
