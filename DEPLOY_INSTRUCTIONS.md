# הוראות העלאה ל-GitHub Pages

## שלב 1 — צור repository ב-GitHub
1. פתח https://github.com/new
2. שם: `uri-field-app`
3. Public ✓
4. לחץ "Create repository"

## שלב 2 — העלה את הקוד
פתח Terminal (Command Prompt) במחשב ורוץ:

```bash
cd uri-field-app
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/Uribsdv-debug/uri-field-app.git
git push -u origin main
```

## שלב 3 — הפעל GitHub Pages
1. לך ל: https://github.com/Uribsdv-debug/uri-field-app/settings/pages
2. Source: "GitHub Actions"
3. לחץ Save

## שלב 4 — הגדר GitHub Actions
צור קובץ: `.github/workflows/deploy.yml`
(הקובץ כבר בתוך הפרויקט)

## שלב 5 — גש לאפליקציה
https://uribsdv-debug.github.io/uri-field-app/

## הוספה למסך הבית (Pixel 8)
1. פתח את הכתובת בChrome
2. תפריט ⋮ → "הוסף למסך הבית"
3. זהו — נפתח כאפליקציה!
