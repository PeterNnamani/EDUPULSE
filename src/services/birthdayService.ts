import { supabase } from '@/lib/supabase';
import { notificationService } from '@/services/notificationService';
import { getParentIdsForStudent } from '@/services/notificationDispatchService';

/**
 * BIRTHDAY AUTOMATION ENGINE
 *
 * Detects birthdays for students, parents, teachers and staff, schedules
 * automatic greetings (in-app + email stub), and dedupes via
 * `birthday_greetings_log`. Powers the admin birthday dashboard widget.
 */

export type PersonType = 'student' | 'parent' | 'teacher' | 'staff';

export interface BirthdayPerson {
  personType: PersonType;
  personId: string;
  name: string;
  dateOfBirth: string;
  /** Days until next birthday (0 = today). */
  daysUntil: number;
  age?: number;
}

export interface BirthdayBuckets {
  today: BirthdayPerson[];
  upcoming: BirthdayPerson[];
  recent: BirthdayPerson[];
}

function parseDob(dob: string): { month: number; day: number; year: number } | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return { month: d.getMonth(), day: d.getDate(), year: d.getFullYear() };
}

/** Signed day distance from today to this year's birthday (negative = passed). */
function dayDistance(dob: string): number | null {
  const parsed = parseDob(dob);
  if (!parsed) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const thisYear = new Date(now.getFullYear(), parsed.month, parsed.day);
  const diff = Math.round((thisYear.getTime() - now.getTime()) / 86400000);
  return diff;
}

function computeAge(dob: string): number | undefined {
  const parsed = parseDob(dob);
  if (!parsed) return undefined;
  return new Date().getFullYear() - parsed.year;
}

export const birthdayService = {
  /**
   * Gather all people with a date of birth for a school.
   */
  async getAllPeople(schoolId: string): Promise<BirthdayPerson[]> {
    const [{ data: students }, { data: staff }, { data: parents }] = await Promise.all([
      supabase
        .from('students')
        .select('id, first_name, last_name, date_of_birth')
        .eq('school_id', schoolId)
        .eq('status', 'active')
        .not('date_of_birth', 'is', null),
      supabase
        .from('staff')
        .select('id, full_name, role, date_of_birth')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null),
      supabase
        .from('parents')
        .select('id, father_name, mother_name, guardian_name, date_of_birth')
        .eq('school_id', schoolId)
        .eq('is_active', true)
        .not('date_of_birth', 'is', null),
    ]);

    const people: BirthdayPerson[] = [];

    for (const s of students ?? []) {
      const dist = dayDistance(s.date_of_birth);
      if (dist === null) continue;
      people.push({
        personType: 'student',
        personId: s.id,
        name: `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim(),
        dateOfBirth: s.date_of_birth,
        daysUntil: dist,
        age: computeAge(s.date_of_birth),
      });
    }

    for (const st of staff ?? []) {
      const dist = dayDistance(st.date_of_birth);
      if (dist === null) continue;
      people.push({
        personType: st.role === 'teacher' ? 'teacher' : 'staff',
        personId: st.id,
        name: st.full_name ?? 'Staff',
        dateOfBirth: st.date_of_birth,
        daysUntil: dist,
        age: computeAge(st.date_of_birth),
      });
    }

    for (const p of parents ?? []) {
      const dist = dayDistance(p.date_of_birth);
      if (dist === null) continue;
      const name = p.father_name || p.mother_name || p.guardian_name || 'Parent';
      people.push({
        personType: 'parent',
        personId: p.id,
        name,
        dateOfBirth: p.date_of_birth,
        daysUntil: dist,
      });
    }

    return people;
  },

  /**
   * Today / upcoming (next 14 days) / recent (past 7 days) birthday buckets.
   */
  async getBirthdays(schoolId: string): Promise<BirthdayBuckets> {
    const people = await this.getAllPeople(schoolId);
    return {
      today: people.filter((p) => p.daysUntil === 0).sort((a, b) => a.name.localeCompare(b.name)),
      upcoming: people
        .filter((p) => p.daysUntil > 0 && p.daysUntil <= 14)
        .sort((a, b) => a.daysUntil - b.daysUntil),
      recent: people
        .filter((p) => p.daysUntil < 0 && p.daysUntil >= -7)
        .sort((a, b) => b.daysUntil - a.daysUntil),
    };
  },

  /**
   * Send greetings to everyone with a birthday today (deduped per day).
   * Runs on admin login.
   */
  async runBirthdayGreetings(schoolId: string): Promise<{ sent: number }> {
    try {
      const { today } = await this.getBirthdays(schoolId);
      if (today.length === 0) return { sent: 0 };

      const greetingDate = new Date().toISOString().slice(0, 10);

      // Already-greeted set for today.
      const { data: existing } = await supabase
        .from('birthday_greetings_log')
        .select('person_type, person_id')
        .eq('school_id', schoolId)
        .eq('greeting_date', greetingDate);

      const greeted = new Set((existing ?? []).map((e) => `${e.person_type}:${e.person_id}`));

      let sent = 0;
      for (const person of today) {
        const key = `${person.personType}:${person.personId}`;
        if (greeted.has(key)) continue;

        await this.greetPerson(schoolId, person);

        await supabase.from('birthday_greetings_log').insert([
          {
            school_id: schoolId,
            person_type: person.personType,
            person_id: person.personId,
            person_name: person.name,
            greeting_date: greetingDate,
            channel: 'in_app',
          },
        ]);
        sent += 1;
      }

      return { sent };
    } catch (err) {
      console.warn('[BIRTHDAY] runBirthdayGreetings failed:', err);
      return { sent: 0 };
    }
  },

  async greetPerson(schoolId: string, person: BirthdayPerson): Promise<void> {
    const firstName = person.name.split(' ')[0] || person.name;

    if (person.personType === 'student') {
      // Greet the student's parents on the child's behalf.
      const parentIds = await getParentIdsForStudent(person.personId);
      for (const parentId of parentIds) {
        await notificationService.sendNotification({
          schoolId,
          recipientId: parentId,
          recipientRole: 'parent',
          notificationType: 'birthday_greeting',
          title: '🎂 Happy Birthday!',
          message: `EduPulse wishes your child ${firstName} a very happy birthday!`,
          priority: 'low',
          relatedStudentId: person.personId,
          deliveryChannels: ['in_app', 'email'],
        });
      }
      return;
    }

    if (person.personType === 'parent') {
      await notificationService.sendNotification({
        schoolId,
        recipientId: person.personId,
        recipientRole: 'parent',
        notificationType: 'birthday_greeting',
        title: '🎂 Happy Birthday!',
        message: `Happy Birthday ${firstName}! Warm wishes from all of us at EduPulse.`,
        priority: 'low',
        deliveryChannels: ['in_app', 'email'],
      });
      return;
    }

    // teacher / staff
    await notificationService.sendNotification({
      schoolId,
      recipientId: person.personId,
      recipientRole: person.personType === 'teacher' ? 'teacher' : 'admin',
      notificationType: 'birthday_greeting',
      title: '🎂 Happy Birthday!',
      message: `Thank you for impacting lives, ${firstName}. Happy Birthday!`,
      priority: 'low',
      deliveryChannels: ['in_app', 'email'],
    });
  },
};
