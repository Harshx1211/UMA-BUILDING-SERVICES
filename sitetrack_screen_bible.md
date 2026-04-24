# 📱 SiteTrack — Complete Screen Bible

## SCREEN 1 — SPLASH SCREEN
- **Route**: `app/(auth)/index.tsx` 
- **Tab Bar**: Hidden 
- **Header**: None

**What you see**:
- Full screen Navy (`#1B2D4F`) background
- Dead center of screen:
  - Large translucent orange glow circle (96x96)
  - Inside it: solid orange circle (72x72)
  - Inside that: "ST" in white bold 28px
- Below circle: "SiteTrack" white 32px bold
- Below that: "Field Service, Simplified" white 60% opacity 14px
- Bottom of screen:
  - Small orange spinning loader
  - "Loading..." white 40% opacity 12px

**What happens**:
- Logo fades in smoothly (600ms)
- App silently checks if you're already logged in
- If logged in → fades directly to Home Dashboard
- If not logged in → slides to Login Screen
- User never sees a blank white screen ever

---

## SCREEN 2 — LOGIN SCREEN
- **Route**: `app/(auth)/login.tsx` 
- **Tab Bar**: Hidden 
- **Header**: None

**What you see**:
- **TOP SECTION** (Navy, 40% of screen height):
  - Curved bottom edge (`borderBottomLeftRadius: 32`, `borderBottomRightRadius: 32`)
  - Small ST logo centered
  - "Welcome back" white bold 24px
  - "Sign in to continue" white 70% 14px
- **FLOATING FORM CARD** (overlaps navy section by 24px, pulled up with negative margin):
  - White card, `borderRadius: 24`, shadow, `padding: 24`
  - Error banner (only shows on error): Red background, ⚠️ icon, error message text (Slides down from top with animation)
  - "Email" label (grey 12px bold) → Email input (height 52, rounded, border)
  - "Password" label → Password input with 👁 show/hide button
  - Row: Remember Me checkbox (left) + Forgot Password? orange link (right)
  - "Sign In" button — full width, orange, height 52, rounded
    - Shows spinner when loading
    - Disabled while loading
  - "Use Fingerprint" / "Use Face ID" ghost button
    - Only shows if device has biometrics AND remember me was checked before

**What happens when you tap**:
- Sign In button → validates email + password → calls Supabase auth → navigates to Dashboard on success
- Forgot Password? → navigates to Forgot Password screen
- Biometric button → shows fingerprint/face prompt → if success → logs in directly
- Show/hide eye → toggles password visibility

---

## SCREEN 3 — FORGOT PASSWORD
- **Route**: `app/(auth)/forgot-password.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- Same Navy curved header as Login
- Back arrow `←` top left
- "Reset Password" title in Navy section
- Floating white form card:
  - Email input
  - "Send Reset Email" Navy button
- **SUCCESS STATE** (replaces form after sending):
  - Large green checkmark circle
  - "Email Sent!" bold
  - "Check your inbox" grey text
  - "Back to Login" orange link

**What happens**:
- Send Reset Email → calls Supabase reset → shows success state
- Back arrow → goes back to Login

---

## SCREEN 4 — HOME DASHBOARD
- **Route**: `app/(app)/index.tsx` 
- **Tab Bar**: Visible (Home tab active, navy dot above icon)

**What you see top to bottom**:
- **NAVY HERO HEADER** (curved bottom):
  - Left side:
    - "Good morning/afternoon/evening" white 60% 13px (time-based)
    - "Harsh 👋" white bold 24px
    - "Friday, 4 April 2026" white 50% 12px
  - Right side:
    - 🔔 Bell icon — tappable, shows orange badge with unread count
    - Small sync dot (green=synced, orange=pending, grey=offline)
- **OFFLINE BANNER** (only when no internet):
  - Amber (`#EAB308`) full-width banner
  - "⚠️ Offline — X changes pending sync"
  - Slides down from top with animation
- **STATS GRID** (overlaps header by 20px — floats over curve):
  - 2x2 grid of white cards with shadows:
    - 📋 Total Jobs (blue icon) — big number + label
    - ✅ Completed (green icon)
    - 🔧 In Progress (orange icon)
    - ⏳ Pending (grey icon)
  - Each card animates in with stagger (50ms apart)
- **NEXT UP HERO CARD** (only if jobs exist today):
  - Large Navy card, orange accents
  - "NEXT JOB" orange pill badge top left
  - Property name white bold 18px
  - "📅 Today at 09:00 AM" white 70%
  - Job type badge
  - Two buttons side by side:
    - "🗺 Navigate" white outline → opens Google Maps
    - "▶ Start" orange fill → starts the job
- **QUICK ACTIONS** (2x2 grid):
  - 🚀 Start Next Job → navigates to Jobs tab (today filter)
  - 📷 Scan Asset QR → opens QR scanner bottom sheet
  - 📆 This Week → shows toast with weekly stats
  - ⚠️ Open Defects → shows toast with defect count
- **TODAY'S JOBS SECTION**:
  - "Today's Jobs" heading + orange count badge
  - List of job cards (see JobCard spec below)
  - **EMPTY STATE**: 🎉 "No jobs today! Enjoy your day"
- **WEEKLY SUMMARY CARD**:
  - Navy card full width
  - "This Week" white bold + "60%" orange right
  - "6 of 10 jobs completed" white 70%
  - Orange progress bar animates on screen entry

**What happens when you tap**:
- Bell 🔔 → navigates to Notifications screen
- Sync dot → triggers manual sync immediately
- Next Up card → navigates to that Job Detail
- Navigate button → opens Google Maps with address
- Start button → starts that job (GPS clock-in)
- Job card → navigates to Job Detail
- Pull down → refreshes dashboard data

---

## SCREEN 5 — JOBS LIST
- **Route**: `app/(app)/jobs/index.tsx` 
- **Tab Bar**: Visible (Jobs tab active)

**What you see**:
- **NAVY CURVED HEADER**:
  - "My Jobs" white bold 22px
  - "🗺 Map" toggle pill top right
- **FILTER TABS** (white pill container, overlaps header):
  - Today (3) | This Week (7) | All Jobs (12)
  - Active tab: Navy fill, white text
  - Inactive: grey text
  - Numbers show live job counts
- **SEARCH BAR**:
  - White card with magnifying glass icon
  - Placeholder: "Search by property or address..."
  - Clear (×) button when text entered
- **JOB CARDS LIST** (FlatList): 
  - Each job card — white, rounded, shadow:
  - Left strip (4px wide, full height, priority colour): 🔴 Urgent | 🟡 High | 🔵 Normal | ⚫ Low
  - Row 1: Property name (bold, truncated) + Status badge (right)
  - Row 2: 📍 Address, Suburb (grey 12px)
  - Row 3: Job type badge + 🕐 Time (if set)
  - Row 4: Notes preview (italic grey, if notes exist)
  - Bottom: Thin divider + compliance dot: 🟢 Compliant | 🔴 Non-Compliant | 🟡 Overdue
- **SWIPE ACTIONS** on job cards:
  - Swipe LEFT → reveals red "Cancel" area
  - Swipe RIGHT → reveals green "Start" area
- **EMPTY STATES**:
  - Today: 🎉 "No jobs today"
  - Week: 📅 "No jobs this week"
  - All: 📋 "No jobs assigned yet"
- **MAP VIEW** (when Map toggle tapped):
  - Full screen react-native-maps
  - Coloured pins for each job (priority colours)
  - Tap pin → card slides up from bottom: Property name, address, time, "Open Job" button → Job Detail

**What happens when you tap**:
- Filter tab → filters list instantly
- Search bar → type to filter by property/address
- Job card → navigates to Job Detail
- Swipe right → Start → starts that job directly
- Swipe left → Cancel → confirmation bottom sheet
- Map toggle → switches between list and map view
- Map pin → shows job info card
- Pull down → refreshes jobs from SQLite

---

## SCREEN 6 — JOB DETAIL
- **Route**: `app/(app)/jobs/[id]/index.tsx` 
- **Tab Bar**: Hidden (full screen)

**What you see**:
- **NAVY HEADER** (straight bottom):
  - `←` Back arrow (white) → back to Jobs List
  - Property name (white bold, truncated)
  - "🗺 Navigate" white pill button (right) → Google Maps
- **ALERT CARDS** (safety critical — always prominent):
  - 🔑 Access Notes card (blue left border, blue background): Shows exactly how to enter the building
  - ⚠️ Hazard Warning card (red left border, red background): Shows any safety hazards on site
  - Both pulse their border ONCE on screen entry to grab attention
- **INFO CHIPS** (horizontal scroll):
  - 📅 Date chip | 🕐 Time chip | Job type chip | Priority chip
- **SITE CONTACT CARD** (if contact exists):
  - 👤 Contact name
  - 📞 Phone number (orange, tappable → opens dialler)
- **TIME TRACKING CARD**:
  - "Time Tracking" heading
  - **STATUS: Scheduled** → Orange "▶ Start Job" button (full width). Glows gently to guide new users. On tap: GPS records location + time → status = In Progress
  - **STATUS: In Progress** → "Started at 09:14 AM" grey text. Two buttons side by side: "⏸ Pause" grey outline, "✅ Complete" green fill. Complete → checks for signature first.
  - **STATUS: Completed** → Green banner: "✅ Job Completed at 11:32 AM"
- **TAB BAR** (4 tabs, sticky):
  - Assets | Defects | Photos | Notes
  - Active: orange underline + orange text
  - Inactive: grey text
- **TAB: ASSETS**:
  - Progress badge: "8/12 inspected"
  - List of assets (white cards): Emoji icon + asset type + location + serial
  - Result badge: ✅ Pass / ❌ Fail / ⬜ Not Tested
  - "Inspect All Assets" orange button at bottom → Inspection Screen
- **TAB: DEFECTS**:
  - Count badge on tab: "3" red dot
  - List of defect cards (coloured left border by severity)
  - Each: severity + description + linked asset + photos
  - "+" FAB button → Add Defect bottom sheet
- **TAB: PHOTOS**:
  - "12 photos" count
  - 3-column photo grid
  - ⏳ orange dot on pending photos
  - Long press photo → View/Caption/Delete options
  - "📷 Take Photo" + "📁 Gallery" buttons at bottom
- **TAB: NOTES**:
  - Job notes text (scrollable)
  - "✏️ Edit" button → editable text area
  - Character counter (max 1000)
  - Save + Cancel buttons when editing
- **BOTTOM FIXED BUTTON**:
  - Scheduled/In Progress: Orange "📄 Generate Report" → Report Screen
  - Completed: Navy "📄 View Report" → Report Screen

**What happens when you tap**:
- `←` Back → Jobs List
- Navigate → Google Maps with address
- Phone number → phone dialler
- Start Job → GPS clock-in → status changes
- Pause → logs clock-out time
- Complete → if no signature: prompts to get signature first
- Inspect All → Inspection Screen
- "+" FAB → Add Defect bottom sheet slides up
- Photo → full screen view
- Long press photo → options sheet
- Generate Report → Report Screen

---

## SCREEN 7 — ASSET INSPECTION
- **Route**: `app/(app)/jobs/[id]/inspect.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY HEADER** (straight):
  - `←` Back → Job Detail
  - "Asset Inspection" white bold
  - "8/12" orange progress indicator (right)
- **PROGRESS BAR** (full width, below header):
  - Grey track, orange fill (Animates smoothly as assets are marked)
  - "8 of 12 assets inspected" text below
- **FILTER PILLS**:
  - All (12) | Passed (5) | Failed (2) | Remaining (5)
- **ASSET CARDS** (FlatList): 
  - Each asset card — white, rounded, shadow
  - **TOP ROW**:
    - Emoji icon in coloured circle: 🔥 Fire Alarm | 💧 Sprinkler | 🧯 Extinguisher | 🚪 Fire Door | 🔋 Emergency Light | 🚿 Hose Reel
    - Asset type (bold) + Location (grey)
    - Serial number (monospace small)
    - Previous result: "Last: ✅ Pass — 15 Jan 2025" (grey small)
  - **RESULT BUTTONS** (3 equal):
    - ✅ PASS — green when selected, green outline when not
    - ❌ FAIL — red when selected, red outline when not
    - ⬜ N/T — grey when selected (Not Tested)
    - Tapping PASS/FAIL: card flashes that colour briefly
  - **DEFECT REASON** (slides down ONLY when FAIL tapped):
    - Smart suggestions shown first based on asset type:
      - Extinguisher → "Pressure Low" suggested
      - Sprinkler → "Obstructed" suggested
      - Fire Door → "Not Closing" suggested
    - Tap reason → highlights orange
    - "Other notes" text input (max 200 chars)
  - **PHOTO ROW**:
    - Small photo thumbnails (if photos taken)
    - "📷 Add Photo" small button → camera opens
  - **QR SCAN**:
    - "📷 Scan QR" small pill → opens camera in scan mode
    - Matches barcode_id in SQLite → highlights correct asset
- **BOTTOM FIXED BAR**:
  - "X of Y inspected" summary (left)
  - "Complete Inspection" orange button (right)
    - Disabled until at least 1 asset inspected
    - On tap: if some not inspected → confirmation sheet "X assets not inspected. Complete anyway?" Yes → back to Job Detail | No → stay
- **COMPLETION ANIMATION**:
  - After completing: green checkmark scales in
  - Brief celebration (subtle particles)
  - Navigates back to Job Detail

**What happens when you tap**:
- `←` Back → Job Detail (inspection progress saved)
- Filter pill → filters asset list
- PASS → marks green, updates progress, saves to SQLite
- FAIL → marks red, slides down defect reasons
- Defect reason → selects reason, auto-creates defect
- N/T → marks grey (not accessible/not tested)
- Add Photo → opens camera, links photo to asset
- Scan QR → camera scanner, finds asset by barcode
- Complete Inspection → confirms + back to Job Detail

---

## SCREEN 8 — DEFECTS SCREEN
- **Route**: `app/(app)/jobs/[id]/defects.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back → Job Detail
  - "Defects" white bold
  - Count badge: "3 defects" orange pill (right)
- **FILTER PILLS**:
  - All | Critical | Major | Minor | Open | Resolved
- **DEFECT CARDS** (sorted Critical → Major → Minor): 
  - Each card — white, rounded, shadow
  - Left border 4px by severity: 🔴 Critical | 🟡 Major | 🔵 Minor
  - Top row: Severity badge (left) + Status badge (right)
    - Status: Open (red) | Monitoring (amber) | Repaired (green)
  - Asset link: Grey pill "🔧 Fire Extinguisher — Level 2"
  - Description: 14px text, readable
  - Photos: Row of thumbnails (tap → full screen)
  - Footer: Date (grey) + "Edit" orange button (right)
- **EMPTY STATE** (no defects — good!):
  - Light green card: 🎉 "No defects found"
  - "All assets passed inspection"
- **FAB BUTTON**:
  - Orange circle bottom-right: "+"
  - On tap → Add Defect bottom sheet slides up
- **ADD DEFECT BOTTOM SHEET**:
  - Slides up from bottom (75% screen height)
  - "Log New Defect" title
  - **SEVERITY SELECTOR** (3 large cards): 🔵 Minor | 🟡 Major | 🔴 Critical (Tap → fills with colour + white text)
  - LINKED ASSET dropdown (optional)
  - DESCRIPTION text area (required, max 500 chars)
  - "📷 Add Photos" orange outline button
  - "Save Defect" orange fill button (disabled until filled)

**What happens when you tap**:
- `←` Back → Job Detail
- Filter pill → filters defect list
- Defect card → expands to show full details
- Edit button → opens edit sheet for that defect
- Photo thumbnail → full screen photo view
- "+" FAB → Add Defect sheet slides up
- Severity card → selects severity
- Save Defect → saves to SQLite + sync queue → list updates

---

## SCREEN 9 — PHOTOS SCREEN
- **Route**: `app/(app)/jobs/[id]/photos.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back → Job Detail
  - "Job Photos" white bold
  - "12 photos" white subtitle
- **STATS ROW** (white card):
  - 📷 12 Total | ✅ 10 Uploaded | ⏳ 2 Pending
- **PHOTO GRID** (3 columns, 2px gaps): 
  - Each photo cell: Square aspect ratio, Photo fills cell, Bottom dark gradient + caption text
  - Orange ⏳ dot (top right) if not yet uploaded
  - Long press → options sheet: "👁 View Full Screen", "✏️ Edit Caption", "🗑 Delete"
- **SECTIONS**:
  - "📍 Site Photos (4)" — general site photos
  - "🔧 Asset Photos (8)" — grouped by asset name
- **BOTTOM FIXED BAR**:
  - "📁 From Gallery" navy outline (left, flex 1)
  - "📷 Take Photo" orange fill (right, flex 1)
- **CAMERA BOTTOM SHEET** (92% height):
  - Full camera view (60% of sheet)
  - Flash toggle ⚡ (off/auto/on)
  - Camera flip 🔄
  - Caption input below camera
  - Link to asset dropdown
  - Large orange circle capture button (72x72)
  - "Done (X photos taken)" top right
- **EMPTY STATE**:
  - 📷 icon + "No photos yet"
  - "Document the site with photos"

**What happens when you tap**:
- `←` Back → Job Detail
- Photo → full screen lightbox view
- Long press → options: view/caption/delete
- From Gallery → phone gallery picker (multi-select)
- Take Photo → camera sheet slides up
- Capture button → takes photo, saves locally, queues upload
- Done → closes camera, back to photo grid

---

## SCREEN 10 — SIGNATURE SCREEN
- **Route**: `app/(app)/jobs/[id]/signature.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY HEADER** (straight):
  - `←` Back → Job Detail
  - "Client Sign-Off" white bold
- **INSTRUCTION CARD** (white, rounded):
  - "Please hand device to client"
  - "Ask them to sign below to confirm the inspection was completed to their satisfaction"
- **CLIENT NAME INPUT**:
  - "Client Name" label
  - Text input (height 52, rounded border)
  - Required — shows error if empty
- **SIGNATURE BOX** (white card, 280px tall):
  - "Sign here" dashed guide text (fades on first stroke)
  - Full canvas for finger signature
  - "Clear" small button below right
- **BOTTOM FIXED BAR**:
  - "🗑 Clear" grey outline (left, flex 1)
  - "✅ Confirm & Save" orange fill (right, flex 1)
  - Confirm disabled until both name + signature present

**What happens when you tap**:
- `←` Back → Job Detail (without saving)
- Signature canvas → draw with finger
- Clear → wipes canvas
- Confirm & Save → exports PNG → saves to SQLite → uploads to Supabase Storage → toast "Signature saved ✓" → back to Job Detail → green "Signature collected" banner shows

---

## SCREEN 11 — REPORT SCREEN
- **Route**: `app/(app)/jobs/[id]/report.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back → Job Detail
  - "Inspection Report" white bold
- **REPORT SUMMARY CARD** (white, rounded):
  - Property name (bold 18px)
  - 📅 Inspection date + 👤 Technician name
  - Stats row: ✅ 12 Passed | ❌ 2 Failed | 📋 3 Defects
  - Overall badge: "✅ COMPLIANT" (green) or "❌ NON-COMPLIANT" (red)
- **PRE-CHECK WARNINGS** (if applicable):
  - Orange card: "⚠️ No signature collected" With "Collect Signature" button → Signature Screen
  - Orange card: "⚠️ Assets not fully inspected"
- **GENERATE BUTTON** (if not yet generated):
  - "📄 Generate Report" orange full width
  - Generation progress shows step by step:
    - "📋 Reading inspection data..." ✓
    - "🔧 Processing defects..." ✓
    - "📸 Embedding photos..." ✓
    - "✍️ Adding signature..." ✓
    - "📄 Building PDF..." ✓
    - "✅ Report Ready!" (green)
- **AFTER GENERATION**:
  - PDF preview card: 📄 large icon + filename + file size
  - "👁 Preview" button → opens PDF viewer
  - Action buttons 2x2 grid:
    - 📧 "Email Report" → native email with PDF attached
    - 📱 "Share" → native share sheet
    - 💾 "Save to Phone" → saves to Downloads
    - 🔄 "Regenerate" → rebuilds PDF

**What happens when you tap**:
- `←` Back → Job Detail
- Collect Signature → Signature Screen
- Generate Report → runs PDF generator with progress
- Preview → opens PDF in device viewer
- Email Report → native email opens, PDF attached. Pre-filled subject: "Fire Safety Inspection Report — [Property]"
- Share → native share sheet
- Save to Phone → saves to Downloads + toast
- Regenerate → rebuilds with latest data

---

## SCREEN 12 — NOTIFICATIONS SCREEN
- **Route**: `app/(app)/notifications/index.tsx` 
- **Tab Bar**: Hidden (accessed from bell icon on dashboard)

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back → Dashboard
  - "Notifications" white bold
  - "Mark all read" orange link (right, only if unread exist)
- **NOTIFICATION LIST**: 
  - Each notification card — white, rounded, shadow
  - UNREAD: warm cream background + 3px orange left border
  - READ: plain white, no border
  - Left: Icon circle (40x40) by type: 💼 New job (blue) | ⚡ Urgent (red) | ✅ Sync complete (green) | ⚠️ Defect (orange) | ℹ️ General (grey)
  - Middle: Title (bold if unread, normal if read), Message (2 lines, grey)
  - Right: Time ago: "2 min" / "1 hr" / "Yesterday". Orange unread dot (8x8) if unread
- **EMPTY STATE**:
  - 🔔 "No notifications yet", "You're all caught up!"
- **FOOTER**:
  - "Clear All" grey text button

**What happens when you tap**:
- `←` Back → Dashboard
- Mark all read → marks all as read, borders disappear
- Notification card → marks as read + navigates to job (if job linked)
- Clear All → deletes all notifications + empty state shows

---

## SCREEN 13 — PROPERTY DETAIL
- **Route**: `app/(app)/properties/[id].tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back
  - Property name (white bold)
- **COMPLIANCE BANNER** (full width):
  - 🟢 "✅ Compliant" green
  - 🔴 "❌ Non-Compliant" red
  - 🔴 "🚨 Overdue — Action Required" dark red
  - ⚪ "⏳ Compliance Pending" grey
- **PROPERTY INFO CARD**:
  - 📍 Full address
  - 👤 Site contact name
  - 📞 Phone (orange, tappable → dialler)
  - 🔑 Access notes (if exists)
  - ⚠️ Hazard notes (if exists)
- **ASSET REGISTER** (section with count badge): 
  - Each asset row (white card): Emoji icon + type + description, Location on site, Last service + Next service dates
  - Red "⚠️ Service Overdue" if date passed
  - Status badge: Active (green) / Decommissioned (grey)
- **RECENT JOBS** (last 5): 
  - Each row: Date + Job type badge + Status badge

**What happens when you tap**:
- `←` Back → previous screen
- Phone number → dialler
- Asset row → Asset Detail screen
- Job row → Job Detail screen

---

## SCREEN 14 — ASSET DETAIL
- **Route**: `app/(app)/assets/[id].tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back
  - Asset type as title
  - Property name as subtitle (white 70%)
- **ASSET INFO CARD**:
  - Large emoji (40px) + asset type bold centered
  - Info rows: 📋 Description, 🔢 Serial number (monospace), 📍 Location on site, 📅 Install date, 🔧 Last service date (green if recent, orange if old), 📆 Next service date (green if future, RED if overdue)
  - Status badge
- **QR CODE SECTION** (if barcode exists):
  - QR code display
  - Barcode ID text (monospace)
  - "Print Label" navy outline button
- **SERVICE HISTORY**:
  - Last 5 inspections: Date + Result badge + Technician notes preview
  - Trend indicator: "3 consecutive passes ✅" (green), "Failed last 2 inspections ⚠️" (red warning)
- **DEFECT HISTORY**:
  - All defects linked to this asset. Each: severity border + date + description + status
  - Empty: "✓ No defects recorded" green

**What happens when you tap**:
- `←` Back → previous screen
- Service history row → (future: job detail)
- Defect row → (future: defect detail)

---

## SCREEN 15 — PROFILE SCREEN
- **Route**: `app/(app)/profile.tsx` 
- **Tab Bar**: Visible (Profile tab active)

**What you see**:
- **NAVY CURVED HEADER** (taller):
  - Large avatar circle (72x72, orange background): Initials in white bold: "H" for Harsh
  - "Harsh Patel" white bold 20px
  - "Technician" orange pill badge
  - Email address white 70% 13px
- **SYNC STATUS CARD** (white, rounded):
  - Online/offline green or red dot + label
  - "3 items pending sync" or "All changes synced"
  - "Last sync: 10:42 AM"
  - "Force Sync Now" navy outline button (Disabled when offline, Shows spinner while syncing)
- **ACCOUNT INFO CARD**:
  - 📧 Email → value
  - 📞 Phone → value (or "Not set")
  - 👤 Role → "Technician" navy pill
- **APP INFO CARD**:
  - 📱 Version → "1.0.0"
  - 🔑 Bundle ID → "com.sitetrack.app"
  - 🌐 Environment → "Production"
- **HELP & SUPPORT ROW**:
  - "❓ Help & Support" → Help Screen
- **SIGN OUT BUTTON**:
  - Red outline, transparent fill
  - "Sign Out" red text
  - On tap → confirmation bottom sheet: "Sign Out?" title, "You'll need to sign in again next time", "Sign Out" red fill button, "Cancel" grey outline button

**What happens when you tap**:
- Force Sync Now → runs sync → shows progress
- Help & Support → Help Screen
- Sign Out → confirmation sheet → if confirmed: clears session → Splash Screen

---

## SCREEN 16 — HELP & SUPPORT
- **Route**: `app/(app)/help.tsx` 
- **Tab Bar**: Hidden

**What you see**:
- **NAVY CURVED HEADER**:
  - `←` Back → Profile
  - "Help & Support" white bold
- **HOW TO USE SITETRACK** (accordion cards): 
  - Each section expands/collapses on tap:
    - "Starting a Job" — step by step guide
    - "Inspecting Assets" — tips + best practices
    - "Logging Defects" — what counts as a defect
    - "Collecting Signatures" — how to guide client
    - "Generating Reports" — steps to create + send PDF
- **FIRST TIME WALKTHROUGH BUTTON**:
  - Navy outline: "▶ Replay App Tour"
  - Replays the 4-step tooltip tour
- **FAQ SECTION** (accordion):
  - Q: What if I have no signal on site? A: SiteTrack works fully offline. Everything syncs when you're back in range.
  - Q: Can I add photos after leaving site? A: Yes — photos stay pending until uploaded.
  - Q: What is a defect? A: Any asset that failed or has an issue needing attention.
  - Q: How do I know a job is complete? A: All assets inspected + signature collected + report generated.
  - Q: Why is my data not syncing? A: Check your internet connection. Use Force Sync in Profile.
- **SEND FEEDBACK BUTTON**:
  - "✉️ Send Feedback" orange outline
  - Opens email: subject "SiteTrack Feedback — v1.0.0"

---

## 🔄 COMPLETE NAVIGATION MAP
```
App Launch
└── Splash Screen
    ├── No session → Login
    │   └── Forgot Password → Login
    └── Has session → Home Dashboard
        ├── Bell 🔔 → Notifications
        ├── Next Up card → Job Detail
        ├── Jobs tab → Jobs List
        │   └── Job card → Job Detail
        │       ├── Inspect All → Inspection Screen
        │       │   └── Back → Job Detail
        │       ├── Defects tab → Defects Screen
        │       │   └── Back → Job Detail
        │       ├── Photos tab → Photos Screen
        │       │   └── Back → Job Detail
        │       ├── Complete → Signature Screen
        │       │   └── Confirm → Job Detail
        │       └── Generate Report → Report Screen
        │           └── Back → Job Detail
        ├── Profile tab → Profile Screen
        │   ├── Help & Support → Help Screen
        │   └── Sign Out → Splash → Login
        └── QR Scan → Asset Detail
            └── Back → Dashboard
```

---

## 📐 GLOBAL RULES (apply to EVERY screen)

**Spacing**:
- Screen horizontal padding: always 16px
- Card internal padding: always 16px
- Between cards: always 12px
- Section gaps: always 24px

**Cards**:
- Background: white
- Border radius: 16px
- Shadow: elevation 3, opacity 0.06
- No flat cards anywhere

**Buttons**:
- Height: 52px (large/primary)
- Height: 44px (secondary/small)
- Border radius: 12px
- Min tap target: 48px

**Typography**:
- Screen titles: 22px bold
- Section headings: 16px semibold
- Card titles: 15px semibold
- Body: 14px regular
- Subtext: 12px regular grey

**Colours**:
- Navy `#1B2D4F` — all headers
- Orange `#F97316` — all CTAs
- Background `#F4F6F9` — all screens
- White `#FFFFFF` — all cards only

**Behaviour**:
- Every button: scale animation on press (0.96)
- Every list: pull to refresh (orange spinner)
- Every screen: loading + empty + error states
- Tab bar: hidden on ALL detail screens
- Tab bar: visible on Home, Jobs, Profile ONLY
