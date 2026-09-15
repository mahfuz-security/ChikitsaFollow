import { guideLocale } from "./guidance";
export const DRAFT_CATEGORIES = ["report_delay", "instructions", "missed_follow_up", "wait_time", "billing", "staff_behavior", "facility", "communication", "other"] as const;
export function draftTemplate(language: string) {
  switch (guideLocale(language)) {
    case "bn": return "আপনার সেবা-সংক্রান্ত উদ্বেগ জানানোর জন্য ধন্যবাদ। এই অভিজ্ঞতার জন্য আমরা দুঃখিত। বিষয়টি পর্যালোচনার জন্য নথিভুক্ত হয়েছে। পরবর্তী আপডেটের সময় ঠিক করতে আপনার কেস রেফারেন্স দিয়ে ফ্রন্ট ডেস্কে যোগাযোগ করুন।";
    case "de": return "Vielen Dank, dass Sie uns auf Ihr Serviceanliegen aufmerksam gemacht haben. Es tut uns leid, dass Ihre Erfahrung nicht Ihren Erwartungen entsprach. Ihr Anliegen wurde zur Prüfung erfasst. Bitte vereinbaren Sie mit dem Empfang unter Angabe Ihrer Fallreferenz den nächsten Rückmeldetermin.";
    default: return "Thank you for telling us about your service concern. We are sorry that your experience did not meet expectations. Your concern has been recorded for review. Please contact the front desk with your case reference to agree on the next update.";
  }
}
