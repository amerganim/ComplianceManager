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

  // CAP tracker (Phase 6)
  caps:            { en: 'CAP Tracker', bn: 'সিএপি ট্র্যাকার' },
  cap_import:      { en: 'Import CAP Excel', bn: 'সিএপি এক্সেল ইমপোর্ট' },
  cap_none:        { en: 'No CAPs yet. Import an auditor’s Excel to start tracking findings.', bn: 'এখনো কোনো সিএপি নেই। ট্র্যাকিং শুরু করতে অডিটরের এক্সেল ইমপোর্ট করুন।' },
  cap_title:       { en: 'CAP title', bn: 'সিএপি শিরোনাম' },
  cap_auditor:     { en: 'Auditor', bn: 'অডিটর' },
  cap_audit_date:  { en: 'Audit date', bn: 'অডিটের তারিখ' },
  cap_choose_file: { en: 'Choose Excel file (.xlsx)', bn: 'এক্সেল ফাইল বাছুন (.xlsx)' },
  cap_detected:    { en: 'findings detected', bn: 'টি ফাইন্ডিং পাওয়া গেছে' },
  cap_import_now:  { en: 'Import findings', bn: 'ফাইন্ডিং ইমপোর্ট করুন' },
  cap_export:      { en: 'Export status report', bn: 'স্ট্যাটাস রিপোর্ট এক্সপোর্ট' },
  cap_open:        { en: 'Open', bn: 'খোলা' },
  cap_in_progress: { en: 'In progress', bn: 'চলমান' },
  cap_closed:      { en: 'Closed', bn: 'বন্ধ' },
  cap_finding:     { en: 'Finding', bn: 'ফাইন্ডিং' },
  cap_severity:    { en: 'Severity', bn: 'তীব্রতা' },
  cap_action:      { en: 'Corrective action', bn: 'সংশোধনমূলক পদক্ষেপ' },
  cap_deadline:    { en: 'Deadline', bn: 'সময়সীমা' },
  cap_status:      { en: 'Status', bn: 'স্ট্যাটাস' },
  cap_evidence:    { en: 'Evidence (link or note)', bn: 'প্রমাণ (লিংক বা নোট)' },
  cap_all:         { en: 'All', bn: 'সব' },
  cap_no_rows:     { en: 'No findings could be read from that file. Check it has a header row with columns like Finding / Severity / Deadline.', bn: 'ফাইলটি থেকে কোনো ফাইন্ডিং পড়া যায়নি। Finding / Severity / Deadline কলামসহ হেডার সারি আছে কিনা দেখুন।' },
  cap_confirm_del: { en: 'Delete this CAP and all its findings?', bn: 'এই সিএপি ও এর সব ফাইন্ডিং মুছবেন?' },

  // Documents + audit binder (Phase 7)
  docs:            { en: 'Documents', bn: 'ডকুমেন্ট' },
  doc:             { en: 'Doc', bn: 'ডক' },
  doc_none:        { en: 'No document attached.', bn: 'কোনো ডকুমেন্ট সংযুক্ত নেই।' },
  doc_upload:      { en: 'Upload new version', bn: 'নতুন সংস্করণ আপলোড' },
  doc_current:     { en: 'Current', bn: 'বর্তমান' },
  doc_make_current:{ en: 'Make current', bn: 'বর্তমান করুন' },
  doc_view:        { en: 'View', bn: 'দেখুন' },
  doc_version:     { en: 'Version', bn: 'সংস্করণ' },
  doc_uploaded:    { en: 'Uploaded', bn: 'আপলোড হয়েছে' },
  doc_confirm_del: { en: 'Delete this document version?', bn: 'এই ডকুমেন্ট সংস্করণ মুছবেন?' },
  binder:          { en: 'Audit Binder', bn: 'অডিট বাইন্ডার' },
  binder_sub:      { en: 'Every current license & certificate, ready to print and hand over.', bn: 'প্রতিটি বর্তমান লাইসেন্স ও সার্টিফিকেট, প্রিন্ট করে হস্তান্তরের জন্য প্রস্তুত।' },
  binder_print:    { en: 'Print binder', bn: 'বাইন্ডার প্রিন্ট' },
  binder_zip:      { en: 'Download all current docs (.zip)', bn: 'সব বর্তমান ডকুমেন্ট ডাউনলোড (.zip)' },
  binder_have:     { en: 'documented', bn: 'ডকুমেন্ট আছে' },
  binder_missing:  { en: 'Missing document', bn: 'ডকুমেন্ট নেই' },
  binder_complete: { en: 'Complete — every item has a current document.', bn: 'সম্পূর্ণ — প্রতিটি আইটেমে বর্তমান ডকুমেন্ট আছে।' },
  binder_index:    { en: 'Index of documents', bn: 'ডকুমেন্ট সূচি' },
  prepared_on:     { en: 'Prepared', bn: 'প্রস্তুত' },
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
