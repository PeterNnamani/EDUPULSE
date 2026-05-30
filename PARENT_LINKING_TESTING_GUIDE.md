# Parent-Student Linking System - Testing Guide

## Pre-Testing Setup

### 1. Apply Database Migration
```bash
# Apply the migration to normalize phone numbers and create helper functions
supabase migrations up
```

### 2. Clear Browser Storage (Optional)
For clean testing, clear localStorage:
```javascript
localStorage.clear()
```

## Testing Scenarios

### Scenario 1: Fresh Student Registration with Phone Normalization

**Test Case**: Register a student with phone number that needs normalization

**Steps**:
1. Navigate to Student Registration
2. Enter parent phone: `08062692662` (local format)
3. Fill in other required fields:
   - Student name: "John Doe"
   - Parent name: "Jane Doe"
   - Class: Select a class
4. Submit registration
5. Check browser console for logs:
   - Look for `[STUDENT_CREATION]` logs
   - Should show: "Normalized phone: 08062692662 -> 2348062692662"
6. Verify:
   - Student created successfully
   - Parent record created or reused
   - student_parents relationship created

**Expected Result**: ✅ Student registered, parent linked

---

### Scenario 2: Parent Login with Normalized Phone

**Test Case**: Parent logs in with different phone format

**Steps**:
1. Login as Parent
2. Enter phone in different format: `+2348062692662`
3. Submit login
4. Check browser console for logs:
   - Look for `[PARENT_LOGIN]` logs
   - Should show: "Looking up parent with phone: +2348062692662"
   - Should show: "Normalized phone: 2348062692662"
   - Should show: "Found matching parent"
   - Should show: "Fetching children for parent"
   - Should show: "Parent login successful. Found X children"
5. Verify:
   - Login successful
   - Redirected to parent dashboard
   - Dashboard shows the registered student

**Expected Result**: ✅ Parent logged in, sees their child

---

### Scenario 3: Same Parent, Different Phone Format

**Test Case**: Ensure phone normalization works across formats

**Steps**:
1. Register another student with parent phone: `2348062692662` (country code format)
2. Link it to the SAME parent (different format than first student)
3. Login with format: `08062692662` (local format)
4. Check dashboard:
   - Should show BOTH students
   - Child selector should show both names
5. Select each child and verify:
   - Data loads correctly
   - Attendance, grades, assignments display

**Expected Result**: ✅ Both children show, regardless of phone format used

---

### Scenario 4: Multiple Children with Child Selector

**Test Case**: Parent with multiple children sees selector and can switch

**Steps**:
1. Ensure parent has 2+ children registered
2. Login as parent
3. Dashboard should show:
   - Welcome message mentions "children" (plural)
   - Child selector dropdown in header
   - First child selected by default
4. Click child selector dropdown
5. Verify all children listed
6. Select each child:
   - Dashboard data updates
   - Attendance, grades, assignments change per child
   - Risk level updates

**Expected Result**: ✅ Child selector works, data updates per child

---

### Scenario 5: Empty Dashboard (No Children)

**Test Case**: Parent account with no linked children

**Steps**:
1. Create parent record without students
2. Login with that parent's phone
3. Verify dashboard shows:
   - "No Children Registered Yet" message
   - Parent's phone number displayed
   - User ID for debugging
4. Verify no errors in console

**Expected Result**: ✅ Empty state displays correctly with debug info

---

### Scenario 6: Attendance Data Loading

**Test Case**: Verify attendance data fetches and displays

**Setup**:
1. Add attendance records to database for a student:
```sql
INSERT INTO attendance (student_id, school_id, date, status)
VALUES 
  ('student-id', 'school-id', '2025-01-20', 'present'),
  ('student-id', 'school-id', '2025-01-21', 'present'),
  ('student-id', 'school-id', '2025-01-22', 'absent'),
  ('student-id', 'school-id', '2025-01-23', 'late');
```

**Steps**:
1. Login as parent
2. Dashboard should show:
   - Attendance percentage: ~67% (2 present out of 3 total)
   - Breakdown: "2 present, 1 absent"
   - Visual progress bar

**Expected Result**: ✅ Attendance data fetches and calculates correctly

---

### Scenario 7: Grades Data Loading

**Test Case**: Verify grades average calculates

**Setup**:
1. Add grade records:
```sql
INSERT INTO grades (student_id, school_id, subject_id, academic_term_id, score)
VALUES 
  ('student-id', 'school-id', 'subject-1', 'term-1', 85),
  ('student-id', 'school-id', 'subject-2', 'term-1', 75),
  ('student-id', 'school-id', 'subject-3', 'term-1', 90);
```

**Steps**:
1. Login and view dashboard
2. Average Grade should show: 83 (rounded average of 85, 75, 90)
3. Verify color coding:
   - Green for ≥70
   - Yellow for 50-69
   - Red for <50

**Expected Result**: ✅ Grades calculate and display correctly

---

### Scenario 8: Logging and Debugging

**Test Case**: Verify comprehensive logging for troubleshooting

**Steps**:
1. Open browser DevTools (F12)
2. Go to Console tab
3. Perform login
4. Look for logs with prefixes:
   - `[PARENT_LOGIN]` - Parent login flow
   - `[GET_CHILDREN]` - Children fetching
   - `[STUDENT_CREATION]` - Student registration

**Expected Logs**:
```
[PARENT_LOGIN] Attempting login with phone: 08062692662 (normalized: 2348062692662)
[PARENT_LOGIN] Found matching parent: <parent-id>
[GET_CHILDREN] Looking up parent with phone: 2348062692662 (normalized: 2348062692662)
[GET_CHILDREN] Found matching parent: <parent-id>
[GET_CHILDREN] Found X children for parent
```

**Expected Result**: ✅ Comprehensive logs visible for debugging

---

### Scenario 9: Using Debug Utilities

**Test Case**: Use debugging functions to verify system state

**Steps**:
1. Open browser console
2. Test phone utilities:
```javascript
// Import in console (if exposed)
import { normalizePhone, comparePhones } from '@/utils/phoneUtils';

// Test normalization
console.log(normalizePhone('08062692662')); // Should return: '2348062692662'
console.log(normalizePhone('+2348062692662')); // Should return: '2348062692662'
console.log(normalizePhone('234 806 269 2662')); // Should return: '2348062692662'

// Test comparison
console.log(comparePhones('08062692662', '+2348062692662')); // Should return: true
console.log(comparePhones('08062692662', '07062692662')); // Should return: false
```

3. Test debug report:
```javascript
import { debugParentAccount, formatReportForConsole } from '@/utils/debugUtils';

const report = await debugParentAccount('08062692662', 'school-id');
console.log(formatReportForConsole(report));
```

**Expected Result**: ✅ Debug utilities work correctly

---

### Scenario 10: Migration Testing (Existing Data)

**Test Case**: Verify migration normalizes existing phone numbers

**Steps**:
1. Before migration, insert test data with un-normalized phones:
```sql
INSERT INTO parents (school_id, father_name, father_phone, primary_phone)
VALUES 
  ('school-id', 'John', '08062692662', '+2348062692662'),
  ('school-id', 'Jane', '2348062692662', '234 806 269 2662');
```

2. Apply migration
3. Query to verify normalization:
```sql
SELECT id, father_phone, primary_phone FROM parents 
WHERE school_id = 'school-id';
```

**Expected Result**: 
- All phones normalized to 234XXXXXXXXXX format
- Relationships not broken

---

## Bug Checklist

While testing, watch for:

- [ ] Phone numbers stored in database are normalized
- [ ] Parent login works with any phone format
- [ ] Children appear on dashboard when parent logs in
- [ ] "No Children" message doesn't appear when children exist
- [ ] Child selector dropdown appears for 2+ children
- [ ] Switching children updates all dashboard data
- [ ] Attendance percentage calculates correctly
- [ ] Average grade calculates correctly
- [ ] Risk level displays correctly
- [ ] All console logs appear with proper prefixes
- [ ] No SQL errors in browser console
- [ ] Dashboard doesn't hang on data loading
- [ ] Empty state shows debugging info
- [ ] Multiple phone formats work interchangeably

---

## Performance Checks

- [ ] Dashboard loads in <2 seconds
- [ ] Child selector dropdown responds instantly
- [ ] No unnecessary database queries
- [ ] Switching children doesn't reload entire page

---

## Debugging Commands

### Check all parents in a school:
```javascript
const { data, error } = await supabase
  .from('parents')
  .select('*')
  .eq('school_id', 'school-id');
console.log(data);
```

### Check parent-student relationships:
```javascript
const { data, error } = await supabase
  .from('student_parents')
  .select('*, students(*), parents(*)')
  .eq('parent_id', 'parent-id');
console.log(data);
```

### Check student:
```javascript
const { data, error } = await supabase
  .from('students')
  .select('*')
  .eq('student_id', 'STU000001');
console.log(data);
```

### Test phone normalization function in database:
```sql
SELECT 
  '08062692662' as input,
  normalize_nigerian_phone('08062692662') as output,
  '+2348062692662' as input2,
  normalize_nigerian_phone('+2348062692662') as output2;
```

---

## Success Criteria

✅ All scenarios pass
✅ No errors in console
✅ All logs appear correctly
✅ Phone normalization works across all formats
✅ Dashboard displays real data
✅ Multiple children supported
✅ Migration completes successfully
✅ Performance acceptable
