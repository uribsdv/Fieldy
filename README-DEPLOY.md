# פריסת שלב 3 — התראות אמיתיות לטלפון

הקוד נבדק מקומית (`npm run test:worker` מריץ את ה-Worker עם D1 מקומי מול שרת
Push מדומה, כולל אימות חתימת VAPID ופענוח ההצפנה). מה שנשאר הוא לפרוס
בחשבון ה-Cloudflare שלך. **סדר חשוב: קודם השרת, אחר כך האפליקציה.**

זמן משוער: 10 דקות. אין צורך לשלוח שום סוד בצ'אט.

---

## 1. ליצור מפתחות VAPID (פעם אחת, במחשב שלך)

```bash
npx web-push generate-vapid-keys
```

מודפסים שני מפתחות: **Public Key** ו-**Private Key**. תשמור אותם במקום בטוח
(מנהל סיסמאות). הציבורי לא סודי, הפרטי כן.

## 2. להוסיף את שתי הטבלאות ל-D1 (פעם אחת)

**דרך הלוח:** Cloudflare Dashboard ← Storage & Databases ← D1 ← מסד הנתונים של
Fieldy ← לשונית **Console** ← להדביק את התוכן של `schema.sql` ← Execute.
כל הפקודות הן `CREATE TABLE IF NOT EXISTS`, אז הטבלאות הקיימות לא נוגעות.

**או דרך wrangler:**
```bash
npx wrangler d1 execute <שם-מסד-הנתונים> --remote --file schema.sql
```

## 3. להגדיר שלושה secrets ב-Worker

**דרך הלוח:** Workers & Pages ← ה-Worker של Fieldy ← Settings ← Variables and
Secrets ← Add:

| שם | ערך | סוג |
|---|---|---|
| `VAPID_PUBLIC_KEY` | ה-Public Key משלב 1 | Text |
| `VAPID_PRIVATE_KEY` | ה-Private Key משלב 1 | **Secret** |
| `VAPID_SUBJECT` | `mailto:הכתובת-שלך@gmail.com` | Text |

**או דרך wrangler** (מבקש את הערך אינטראקטיבית, לא נשאר בהיסטוריה):
```bash
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

## 4. לפרוס את `worker.js`

**דרך הלוח:** ה-Worker ← **Edit code** ← למחוק הכל ולהדביק את התוכן של
`worker.js` מהענף ← **Deploy**.

**או דרך wrangler:** למלא ב-`wrangler.toml` את שלושת הערכים המסומנים ב-←
(שם ה-Worker, שם ה-D1, ה-Database ID), ואז:
```bash
npx wrangler login
npx wrangler deploy
```
שים לב: `wrangler deploy` מחליף את ה-Cron Triggers במה שכתוב ב-`wrangler.toml`
(יומי ב-03:00 UTC + כל 5 דקות). אם פרסת דרך הלוח, המשך לשלב 5.

## 5. להוסיף Cron Trigger כל 5 דקות (רק אם פרסת דרך הלוח)

ה-Worker ← Settings ← **Trigger events** ← Add ← Cron Trigger ← `*/5 * * * *`.
את הטריגר היומי הקיים (תובנות) להשאיר. הקוד מבדיל ביניהם לבד.

## 6. לבדוק שהשרת מוכן (מהמחשב)

```bash
# 1 = מוכן. אם false — אחד ה-secrets משלב 3 חסר.
curl -s -H "Authorization: Bearer <הסיסמה>" https://<ה-worker>.workers.dev/api/push/status
# מה היה נשלח ברגע זה (בלי לשלוח)
curl -s -H "Authorization: Bearer <הסיסמה>" https://<ה-worker>.workers.dev/api/push/preview
```

## 7. לפרוס את האפליקציה

למזג את הענף `claude/fieldy-upgrade-step-0-tdnpmy` ל-`main`. GitHub Pages
מעלה את `index.html` ו-`sw.js` לבד. בטלפון: הגדרות ← "רענן עכשיו" אם הגרסה
לא מציגה `2026.09.10-3`.

## 8. להפעיל בטלפון

הגדרות ← **🔔 התראות לטלפון** ← "הפעל התראות" ← לאשר בחלון של כרום ←
"שלח בדיקה". אמורה להגיע התראה תוך כמה שניות.

- **אנדרואיד / כרום**: עובד ישירות.
- **אייפון**: רק מאפליקציה שנוספה למסך הבית (iOS 16.4 ומעלה). לפתוח משם ואז
  להפעיל.
- אם "שלח בדיקה" מחזיר שגיאת VAPID: שלב 3 לא הושלם.
- אם ההרשאה נחסמה בטעות: הגדרות האתר בכרום ← התראות ← אפשר.

## מה השרת שולח, ומתי

| תזכורת | מתי | מקור |
|---|---|---|
| אירוע בלוח | לפי ה"התראה" שנבחרה באירוע (10/30/60 דק', יום לפני…) | `state.events` |
| אתרים תקועים 5+ ימים | פעם ביום, בשעה שנבחרה (ברירת מחדל 08:00) | `state.sites` |
| רפלקציית מנהיגות | פעם ביום בערב (ברירת מחדל 20:00), **רק אם לא נכתבה רשומה היום** | `state.leadershipLog` |

השעות הן לפי אזור הזמן של הטלפון שהפעיל את ההתראות (נשמר בהעדפות).
כל תזכורת נשלחת פעם אחת (טבלת `push_sent`). הניסוח הוא עובדתי ולא מאשים,
לפי הברייף. את ההעדפות משנים באותו כרטיס בהגדרות.

## אם משהו לא עובד

- `POST /api/push/run` (עם ה-Authorization) מריץ את הבדיקה המתוזמנת עכשיו
  ומחזיר מה נשלח ומה דולג.
- `GET /api/push/status` מציג את המכשירים הרשומים, מתי הצליחה השליחה
  האחרונה לכל אחד, וכמה כשלונות רצופים.
- מכשיר שהפסיק להתקיים (סטטוס 404/410 משירות ה-Push) נמחק אוטומטית.
