import { useEffect, useState } from 'react'

const SECTIONS = [
  {
    icon: '🔍',
    en: {
      title: 'Player Search',
      body:  'Search any player by name. Use the Position, Year and Team filters to narrow results - you can filter without typing a name. Click any result to open the full profile.',
    },
    he: {
      title: 'חיפוש שחקנים',
      body:  'חפש כל שחקן לפי שם. השתמש בפילטרי עמדה, שנה וקבוצה לצמצום התוצאות - אפשר לסנן גם בלי להקליד שם. לחץ על תוצאה לפתיחת הפרופיל המלא.',
    },
  },
  {
    icon: '📊',
    en: {
      title: 'Player Profile',
      body:  "Shows season-by-season stats with trend charts, combine measurements, and draft info. FDV (Fourth & Data Value) is our proprietary position-aware career quality metric - higher is better. See /methodology for the full formula.",
    },
    he: {
      title: 'פרופיל שחקן',
      body:  'מציג סטטיסטיקות עונה-עונה עם גרפי מגמה, מדדי קומביין ומידע על הדראפט. FDV (Fourth & Data Value) הוא מדד ערך קריירה קנייני שלנו - גבוה יותר = טוב יותר. ראה /methodology לנוסחה המלאה.',
    },
  },
  {
    icon: '⚖️',
    en: {
      title: 'Player Comparison',
      body:  'Add up to 4 players using the search box. Switch between categories (Passing, Offense, Defense, Kicking, Punting, Returns) - the chart and table update instantly. Remove any player with ×.',
    },
    he: {
      title: 'השוואת שחקנים',
      body:  'הוסף עד 4 שחקנים באמצעות תיבת החיפוש. החלף בין קטגוריות (מסירה, התקפה, הגנה, בעיטות, פאנטינג, ריצות החזרה) - הגרף והטבלה מתעדכנים מיידית. הסר שחקן עם ×.',
    },
  },
  {
    icon: '🎯',
    en: {
      title: 'Draft Analysis',
      body:  '"Steals" are round 4+ picks who overdelivered (FDV ≥ 40). "Busts" are round 1–2 picks who underdelivered (FDV ≤ 20). Rankings use an ML model trained on combine measurements to predict expected career value.',
    },
    he: {
      title: 'ניתוח דראפט',
      body:  '"גנבות" הן בחירות מסיבוב 4+ שעברו ציפיות (FDV ≥ 40). "כישלונות" הן בחירות מסיבוב 1–2 שהאכזבו (FDV ≤ 20). הדירוגים מבוססים על מודל ML שאומן על מדדי קומביין לחיזוי ערך קריירה צפוי.',
    },
  },
  {
    icon: '🤖',
    en: {
      title: 'Smart Search',
      body:  'Ask any question in plain English or Hebrew - the AI translates it to SQL and runs it live. Expand "Generated SQL" to see the exact query. Questions about data not in the database return an honest error.',
    },
    he: {
      title: 'חיפוש חכם',
      body:  'שאל כל שאלה בעברית או אנגלית - ה-AI מתרגם אותה ל-SQL ומריץ אותה ישירות על בסיס הנתונים. פתח את "Generated SQL" לצפייה בשאילתה. שאלות על נתונים שלא קיימים יחזירו הודעת שגיאה ברורה.',
    },
  },
]

export default function HelpModal({ onClose }) {
  const [lang, setLang] = useState(() => localStorage.getItem('helpLang') ?? 'en')
  const isHe = lang === 'he'

  const switchLang = l => { setLang(l); localStorage.setItem('helpLang', l) }

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl"
        style={{ background: 'linear-gradient(160deg, #0f172a 0%, #1e293b 100%)' }}
        dir={isHe ? 'rtl' : 'ltr'}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-700/60 shrink-0">
          <h2 className="text-lg font-black text-white tracking-tight">
            {isHe
              ? <><span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">NFL DATA</span> - מדריך שימוש</>
              : <>How to use <span className="bg-gradient-to-r from-amber-400 to-yellow-200 bg-clip-text text-transparent">NFL DATA</span></>
            }
          </h2>

          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <div className="flex bg-slate-800 border border-slate-700 rounded-lg p-0.5 text-xs font-semibold">
              <button onClick={() => switchLang('en')}
                className={`px-2.5 py-1 rounded-md transition-colors ${!isHe ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                EN
              </button>
              <button onClick={() => switchLang('he')}
                className={`px-2.5 py-1 rounded-md transition-colors ${isHe ? 'bg-slate-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                עב
              </button>
            </div>
            <button onClick={onClose}
              className="text-slate-500 hover:text-white transition-colors text-xl leading-none">×</button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-4">
          {SECTIONS.map(s => {
            const t = isHe ? s.he : s.en
            return (
              <div key={s.icon} className="rounded-xl p-4 border border-slate-700/40"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{s.icon}</span>
                  <h3 className="text-white font-bold">{t.title}</h3>
                </div>
                <p className="text-slate-400 text-sm leading-relaxed">{t.body}</p>
              </div>
            )
          })}

          <p className="text-center text-slate-600 text-xs pt-1 pb-2">
            {isHe
              ? 'מקור נתונים: Pro Football Reference · 1970–2025 · 19,000+ שחקנים'
              : 'Data: Pro Football Reference · 1970–2025 · 19,000+ players'}
          </p>
        </div>
      </div>
    </div>
  )
}
