export const GUIDE_TOPICS = ["complaint", "status", "billing", "account", "privacy", "language", "medical", "unknown"] as const;
export type GuideTopic = typeof GUIDE_TOPICS[number];
export type GuideLocale = "en" | "bn" | "de";
export function guideLocale(language: string): GuideLocale {
  return language.startsWith("bn") ? "bn" : language.startsWith("de") ? "de" : "en";
}

// Only a topic identifier leaves the browser. Free-text questions and case
// records are never forwarded to a model or retained by the guidance API.
export function classifyGuideQuestion(text: string): GuideTopic {
  if (/diagnos|medicine|symptom|pain|result.*mean|prescri|emergency|রোগ|ওষুধ|ব্যথা|চিকিৎসা|জরুরি|symptom|schmerz|notfall|medikament/i.test(text)) return "medical";
  if (/refund|bill|payment|বিল|টাকা|ফেরত|rechnung|erstattung/i.test(text)) return "billing";
  if (/status|track|reference|স্ট্যাটাস|অবস্থা|খোঁজ|verfolgen/i.test(text)) return "status";
  if (/password|login|sign.?in|sign.?up|account|profile|নিবন্ধন|পাসওয়ার্ড|প্রোফাইল|অ্যাকাউন্ট|konto|anmeld/i.test(text)) return "account";
  if (/privacy|data|private|গোপন|তথ্য|datenschutz/i.test(text)) return "privacy";
  if (/language|english|bangla|bengali|ভাষা|বাংলা|sprache/i.test(text)) return "language";
  if (/complain|concern|report|delay|follow.?up|অভিযোগ|রিপোর্ট|বিলম্ব|beschwer|bericht/i.test(text)) return "complaint";
  return "unknown";
}

export const GUIDE_ANSWERS: Record<GuideLocale, Record<GuideTopic, string>> = {
  en: {
    complaint: "Tell your clinic's front desk what happened and what was promised. Ask them to record a service case and give you its reference. Include the delay, billing issue, or missed follow-up, but leave out diagnoses and test results.",
    status: "Contact your clinic's front desk with your case reference. Ask for the current status and next promised update. This assistant cannot access case records or confirm that a concern has been resolved.",
    billing: "Ask the front desk to record your billing concern. A branch manager must review any refund or fee waiver. Keep your receipt for the clinic; do not share payment details here. A request is not a guarantee of approval.",
    account: "Create an account with your first name, last name, email, and hospital. Check your email for the activation link. Sign in through Blocks IAM. You can update your name in Profile; use the hosted sign-in page for password recovery.",
    privacy: "ChikitsaFollow records service concerns, not medical records. Do not share diagnoses, test values, prescriptions, patient names, contact details, or payment information in this chat. Questions stay in this browser session; AI mode receives only the help topic and selected language.",
    language: "Use the language menu to choose English, Bangla, or German. Your choice is remembered on this device. The language setting changes interface text, not the original wording of case records.",
    medical: "I cannot provide medical advice, interpret results, or assess symptoms. Contact a qualified clinician for medical questions. If you believe there is an emergency, contact local emergency services or the nearest emergency department. This chat is not monitored for emergencies.",
    unknown: "I can help with recording a service concern, following up on a case, billing requests, account access, privacy, and language settings. What would you like help with?"
  },
  bn: {
    complaint: "কী ঘটেছে এবং কী প্রতিশ্রুতি দেওয়া হয়েছিল তা ক্লিনিকের ফ্রন্ট ডেস্ককে জানান। একটি সেবা-অভিযোগ নথিভুক্ত করে রেফারেন্স নম্বর চাইুন। বিলম্ব, বিলের সমস্যা বা ফলো-আপের কথা বলুন; রোগনির্ণয় বা পরীক্ষার ফল দেবেন না।",
    status: "আপনার কেস রেফারেন্স দিয়ে ক্লিনিকের ফ্রন্ট ডেস্কে যোগাযোগ করুন। বর্তমান অবস্থা ও পরবর্তী আপডেটের সময় জানতে চান। এই সহায়ক কেসের নথি দেখতে বা সমাধান নিশ্চিত করতে পারে না।",
    billing: "বিলের সমস্যা ফ্রন্ট ডেস্কে নথিভুক্ত করুন। টাকা ফেরত বা ফি মওকুফের জন্য শাখা ব্যবস্থাপকের অনুমোদন প্রয়োজন। ক্লিনিকের জন্য রসিদ রাখুন; এখানে পেমেন্টের তথ্য দেবেন না। আবেদন করলেই অনুমোদন নিশ্চিত নয়।",
    account: "নাম, ইমেইল ও হাসপাতাল দিয়ে অ্যাকাউন্ট খুলুন। ইমেইলে পাঠানো লিংক দিয়ে সক্রিয় করুন এবং Blocks IAM দিয়ে সাইন ইন করুন। প্রোফাইলে নাম পরিবর্তন করতে পারবেন। পাসওয়ার্ড পুনরুদ্ধারে সাইন-ইন পৃষ্ঠাটি ব্যবহার করুন।",
    privacy: "ChikitsaFollow সেবা-অভিযোগ রাখে, চিকিৎসার নথি নয়। এই চ্যাটে রোগনির্ণয়, পরীক্ষার মান, প্রেসক্রিপশন, রোগীর নাম, যোগাযোগ বা পেমেন্টের তথ্য দেবেন না। প্রশ্ন এই ব্রাউজার সেশনেই থাকে; AI শুধু সহায়তার বিষয় ও নির্বাচিত ভাষা পায়।",
    language: "ভাষার মেনু থেকে English, বাংলা বা Deutsch বেছে নিন। এই ডিভাইসে আপনার পছন্দ মনে রাখা হবে। ভাষা বদলালে ইন্টারফেসের লেখা বদলাবে, কেসের মূল লেখা নয়।",
    medical: "আমি চিকিৎসা পরামর্শ, পরীক্ষার ফলের ব্যাখ্যা বা উপসর্গ মূল্যায়ন করতে পারি না। চিকিৎসার প্রশ্নে যোগ্য চিকিৎসকের সঙ্গে যোগাযোগ করুন। জরুরি অবস্থা মনে হলে স্থানীয় জরুরি সেবা বা নিকটস্থ জরুরি বিভাগে যোগাযোগ করুন। এই চ্যাট জরুরি সহায়তার জন্য পর্যবেক্ষণ করা হয় না।",
    unknown: "সেবা-অভিযোগ, কেসের ফলো-আপ, বিল, অ্যাকাউন্ট, গোপনীয়তা ও ভাষা নিয়ে সাহায্য করতে পারি। কোন বিষয়ে সাহায্য চান?"
  },
  de: {
    complaint: "Schildern Sie am Empfang Ihrer Klinik, was passiert ist und was zugesagt wurde. Bitten Sie um einen Servicefall mit Referenznummer. Beschreiben Sie Verzögerungen, Rechnungsprobleme oder ausgebliebene Rückrufe, aber keine Diagnosen oder Testergebnisse.",
    status: "Wenden Sie sich mit Ihrer Fallreferenz an den Empfang. Fragen Sie nach dem aktuellen Stand und dem nächsten zugesagten Update. Dieser Assistent kann keine Fallakten einsehen oder eine Lösung bestätigen.",
    billing: "Lassen Sie Ihr Rechnungsanliegen am Empfang erfassen. Eine Erstattung oder ein Gebührenerlass erfordert die Prüfung durch die Filialleitung. Bewahren Sie den Beleg für die Klinik auf; teilen Sie hier keine Zahlungsdaten. Eine Anfrage garantiert keine Genehmigung.",
    account: "Erstellen Sie Ihr Konto mit Vorname, Nachname, E-Mail und Krankenhaus. Aktivieren Sie es über den Link in Ihrer E-Mail. Melden Sie sich über Blocks IAM an. Ihren Namen können Sie im Profil ändern; die Passwortwiederherstellung erfolgt auf der Anmeldeseite.",
    privacy: "ChikitsaFollow erfasst Serviceanliegen, keine Krankenakten. Teilen Sie hier keine Diagnosen, Laborwerte, Rezepte, Namen, Kontakt- oder Zahlungsdaten. Fragen bleiben in dieser Browsersitzung; im KI-Modus werden nur Hilfethema und Sprache übertragen.",
    language: "Wählen Sie im Sprachmenü English, বাংলা oder Deutsch. Ihre Auswahl wird auf diesem Gerät gespeichert. Die Spracheinstellung ändert die Oberfläche, nicht den ursprünglichen Text von Fallakten.",
    medical: "Ich kann keine medizinische Beratung, Befundinterpretation oder Symptombewertung anbieten. Wenden Sie sich an medizinisches Fachpersonal. Bei einem vermuteten Notfall kontaktieren Sie den örtlichen Rettungsdienst oder die nächste Notaufnahme. Dieser Chat wird nicht für Notfälle überwacht.",
    unknown: "Ich helfe bei Serviceanliegen, Fallnachverfolgung, Rechnungsfragen, Kontozugang, Datenschutz und Spracheinstellungen. Wobei benötigen Sie Hilfe?"
  }
};
