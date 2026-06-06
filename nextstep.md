# MASTER EDUPULSE IMPLEMENTATION PROMPT

Implement the following features into EduPulse while maintaining a clean, scalable, multi-tenant architecture. Every feature must be school-isolated, role-based, auditable, and integrated into the existing notification engine, finance engine, parent portal, counselor module, and academic management system.

---

# 1. KINDERGARTEN & PRESCHOOL ASSESSMENT SYSTEM

Traditional numerical grading should not be used for Preschool and Kindergarten classes.

Supported Classes:

* Creche
* Playgroup
* Nursery 1
* Nursery 2
* Nursery 3
* Kindergarten

Implement a competency-based assessment system.

Assessment ratings:

* Outstanding
* Excellent
* Very Good
* Good
* Developing
* Needs Attention

Assessment categories:

* Literacy Skills
* Numeracy Skills
* Communication Skills
* Social Development
* Emotional Development
* Motor Skills
* Creativity
* Participation
* Personal Hygiene
* Class Behaviour

Teachers should select ratings instead of entering scores.

Generate:

* Progress summaries
* Teacher comments
* Parent-friendly reports
* Growth trend tracking

Parents should see visual progress indicators instead of percentages.

Risk detection should work differently for preschool learners and be based on repeated low ratings rather than exam scores.

---

# 2. TEACHER-ON-DUTY ATTENDANCE SYSTEM

Keep existing classroom attendance unchanged.

Add a second attendance layer called:

Teacher-On-Duty Attendance

Administrators can assign weekly duty teachers.

Duty teachers can access all students regardless of class.

Daily workflow:

Morning:

* Record student arrival
* Record arrival time
* Mark late arrivals
* Record visitor notes

Closing:

* Record departure time
* Record pickup status
* Record authorized pickup person
* Record transportation method

Attendance dashboard should display:

* Students present
* Late arrivals
* Early departures
* Missing pickup records
* Attendance trends

Parents receive arrival and departure notifications.

Example:

"Peter arrived at school at 7:42 AM."

"Peter departed school at 2:15 PM."

Do not create duplicate student attendance records.

Use a dedicated duty-attendance table.

---

# 3. TEACHER ACTIVITY MONITORING

Create a complete teacher activity feed.

Track:

* Attendance submitted
* Results uploaded
* Assignments created
* Behaviour records entered
* Student interventions created
* Parent communication initiated
* Login activity
* Logout activity

Create:

Teacher Activity Log

Store:

* Teacher
* Timestamp
* Action
* Student affected
* Class affected
* Details

Administrators and principals can view:

* Daily activities
* Weekly summaries
* Most active teachers
* Missing tasks
* Inactive teachers

Notifications:

Example:

"Mr. John uploaded Mathematics results for JSS2A."

"Mrs. Grace marked attendance for Primary 5."

---

# 4. BIRTHDAY AUTOMATION ENGINE

Automatically detect birthdays.

Supported users:

* Students
* Parents
* Teachers
* Staff

Schedule automatic greetings.

Channels:

* In-app notifications
* Email

Templates:

Student:

"Happy Birthday Peter! Wishing you a wonderful year ahead."

Parent:

"EduPulse wishes your child a happy birthday."

Teacher:

"Thank you for impacting lives. Happy Birthday."

Admin dashboard should show:

Today's birthdays

Upcoming birthdays

Birthday history

---

# 5. ADVANCED FINANCE AUTOMATION

Enhance existing finance module.

Implement:

Automatic fee assignment based on class.

When a student:

* Is registered
* Is promoted
* Changes class

Automatically:

* Apply class fee structure
* Generate invoices
* Create payment schedule
* Calculate balances

Support:

* Tuition
* Development Levy
* PTA
* Exam Fees
* Transport
* Hostel
* Other Fees

Maintain full history.

---

# 6. VIRTUAL ACCOUNT PAYMENT SYSTEM

Integrate Monnify virtual accounts.

Each school connects their own Monnify account.

Administrators should enter:

* API Key
* Secret Key
* Contract Code

inside School Settings.

No developer intervention should ever be required.

When a student is registered:

Automatically generate:

* Dedicated virtual account
* Account name
* Bank name
* Account number

Display account details in:

* Student Profile
* Parent Portal
* Finance Dashboard

Payment workflow:

Parent transfers money.

Monnify sends webhook.

System automatically:

* Identifies student
* Confirms payment
* Updates invoice
* Updates balance
* Generates receipt
* Sends parent notification
* Sends finance notification

No manual receipt upload required.

No manual approval required.

Maintain audit logs.

---

# 7. PAYMENT RECONCILIATION ENGINE

Implement automatic reconciliation.

Track:

* Expected payments
* Received payments
* Overpayments
* Partial payments
* Outstanding balances

Generate:

* Daily finance summaries
* Collection reports
* Outstanding reports

Alert finance officers when anomalies occur.

---

# 8. NOTIFICATION EXPANSION

Extend existing notification engine.

Support:

* Attendance notifications
* Arrival notifications
* Departure notifications
* Fee payment confirmations
* Outstanding fee reminders
* Birthday greetings
* Behaviour alerts
* Assignment alerts
* Risk alerts
* Intervention updates
* Teacher activity notifications

Role routing:

Parent

Teacher

Counselor

Principal

Finance Officer

Administrator

Notifications must support:

* In-app


---

# 9. AUDIT & COMPLIANCE

Create centralized audit logging.

Track:

* User
* Action
* Timestamp
* IP
* School
* Record affected

Every critical action must be logged.

Examples:

* Fee changes
* Promotions
* Payments
* Attendance edits
* Result uploads
* Student transfers

---

# 10. SUBSCRIPTION PLAN IMPLEMENTATION

Implement the following plans:

Starter – ₦15,000/month

* Up to 300 students
* Core school management
* Parent portal
* Attendance
* Behaviour
* Assignments
* Birthday automation

Growth – ₦35,000/month

Everything in Starter plus:

* Risk detection
* Counselor module
* Intervention tracking
* Parent alerts
* Teacher-on-duty attendance
* Teacher activity feed
* Advanced analytics

Enterprise – ₦75,000/month

Everything in Growth plus:

* Unlimited students
* Advanced finance automation
* Virtual accounts
* Payment reconciliation
* Multi-campus support
* Audit logs
* Principal oversight dashboard

Enterprise Plus – ₦150,000/month

Everything in Enterprise plus:

* Payroll management
* Expense tracking
* Staff performance analytics
* Custom integrations
* White-label option
* Dedicated account manager

Annual billing discounts:

* Starter ₦150,000/year
* Growth ₦350,000/year
* Enterprise ₦750,000/year
* Enterprise Plus ₦1,500,000/year

---

# IMPLEMENTATION REQUIREMENTS

* Maintain existing EduPulse architecture.
* Preserve all existing data.
* Follow Supabase RLS policies.
* Support real-time updates.
* Optimize for schools with 100–10,000 students.
* Ensure mobile responsiveness.
* Ensure multi-tenant isolation.
* Generate migrations where needed.
* Add indexes for performance.
* Add role-based permissions.
* Add audit trails for all critical operations.
* Integrate every feature into dashboards, analytics, notifications, and reports automatically.

Goal: Make EduPulse a complete student monitoring, intervention, attendance, finance, and parent-engagement platform while keeping the system simple for schools to operate.
