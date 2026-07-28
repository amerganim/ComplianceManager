// =====================================================================
// Dead-simple bilingual layer (English / বাংলা). The compliance
// manager's English may be shaky — every label ships in both.
// Usage: const { t, lang, toggle } = useLang()
// =====================================================================
import { createContext, useContext, useState, useCallback } from 'react'

const STRINGS = {
  app_name:        { en: 'Compliance Manager', bn: 'কমপ্লায়েন্স ম্যানেজার' },
  tagline:         { en: 'Never let a license expire.', bn: 'কোনো লাইসেন্স যেন কখনো মেয়াদোত্তীর্ণ না হয়।' },

  // auth
  sign_in:         { en: 'Sign in', bn: 'সাইন ইন' },
  sign_up:         { en: 'Create factory account', bn: 'ফ্যাক্টরি অ্যাকাউন্ট তৈরি করুন' },
  sign_out:        { en: 'Sign out', bn: 'সাইন আউট' },
  email:           { en: 'Email', bn: 'ইমেইল' },
  password:        { en: 'Password', bn: 'পাসওয়ার্ড' },
  factory_name:    { en: 'Factory name', bn: 'ফ্যাক্টরির নাম' },
  your_name:       { en: 'Your name', bn: 'আপনার নাম' },
  have_account:    { en: 'Already have an account? Sign in', bn: 'অ্যাকাউন্ট আছে? সাইন ইন করুন' },
  need_account:    { en: 'New factory? Create an account', bn: 'নতুন ফ্যাক্টরি? অ্যাকাউন্ট তৈরি করুন' },

  // nav
  dashboard:       { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  items:           { en: 'Compliance Items', bn: 'কমপ্লায়েন্স আইটেম' },

  // dashboard
  valid:           { en: 'Valid', bn: 'বৈধ' },
  expiring:        { en: 'Expiring', bn: 'মেয়াদ শেষ হচ্ছে' },
  expired:         { en: 'Expired / Urgent', bn: 'মেয়াদোত্তীর্ণ / জরুরি' },
  readiness:       { en: 'Audit readiness', bn: 'অডিট প্রস্তুতি' },
  expiring_next:   { en: "What's expiring next", bn: 'পরবর্তীতে যা শেষ হচ্ছে' },
  nothing_soon:    { en: 'Nothing expiring soon. 🎉', bn: 'শীঘ্রই কিছু শেষ হচ্ছে না। 🎉' },

  // items
  add_item:        { en: 'Add item', bn: 'আইটেম যোগ করুন' },
  edit:            { en: 'Edit', bn: 'সম্পাদনা' },
  delete:          { en: 'Delete', bn: 'মুছুন' },
  save:            { en: 'Save', bn: 'সংরক্ষণ' },
  cancel:          { en: 'Cancel', bn: 'বাতিল' },
  mark_done:       { en: 'Mark done', bn: 'সম্পন্ন চিহ্নিত করুন' },
  name:            { en: 'Name', bn: 'নাম' },
  category:        { en: 'Category', bn: 'শ্রেণী' },
  authority:       { en: 'Issuing authority', bn: 'ইস্যুকারী কর্তৃপক্ষ' },
  issue_date:      { en: 'Issue date', bn: 'ইস্যুর তারিখ' },
  expiry_date:     { en: 'Expiry / next-due date', bn: 'মেয়াদ / পরবর্তী তারিখ' },
  recurrence:      { en: 'Repeat every (days)', bn: 'প্রতি (দিন) পুনরাবৃত্তি' },
  notes:           { en: 'Notes', bn: 'নোট' },
  days_left:       { en: 'days left', bn: 'দিন বাকি' },
  days_overdue:    { en: 'days overdue', bn: 'দিন অতিবাহিত' },
  no_items:        { en: 'No items yet. Add your first license or certificate.', bn: 'এখনো কোনো আইটেম নেই। আপনার প্রথম লাইসেন্স যোগ করুন।' },
  confirm_delete:  { en: 'Delete this item? This cannot be undone.', bn: 'এই আইটেমটি মুছবেন? এটি ফেরানো যাবে না।' },

  // categories
  license:         { en: 'License', bn: 'লাইসেন্স' },
  certificate:    { en: 'Certificate', bn: 'সার্টিফিকেট' },
  recurring_task:  { en: 'Recurring task', bn: 'পুনরাবৃত্ত কাজ' },
}

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('lang') || 'en')
  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === 'en' ? 'bn' : 'en'
      localStorage.setItem('lang', next)
      return next
    })
  }, [])
  const t = useCallback(
    (key) => STRINGS[key]?.[lang] ?? STRINGS[key]?.en ?? key,
    [lang]
  )
  return (
    <LangContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used within LangProvider')
  return ctx
}

// Category options shared by the form + labels.
export const CATEGORIES = ['license', 'certificate', 'recurring_task']
