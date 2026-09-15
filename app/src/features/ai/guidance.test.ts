import { expect, it } from "vitest";
import { classifyGuideQuestion, GUIDE_ANSWERS, GUIDE_TOPICS } from "./guidance";
it("recognizes English, Bangla and German service questions", () => {
  expect(classifyGuideQuestion("My bill is wrong")).toBe("billing");
  expect(classifyGuideQuestion("আমার রিপোর্ট দেরি হয়েছে")).toBe("complaint");
  expect(classifyGuideQuestion("Mein Passwort und Konto")).toBe("account");
});
it("prioritizes medical boundaries over service keywords", () => {
  expect(classifyGuideQuestion("I have pain and a billing question")).toBe("medical");
  expect(classifyGuideQuestion("ওষুধের তথ্য চাই")).toBe("medical");
});
it("has reviewed help for every topic in all supported languages", () => {
  for (const dictionary of Object.values(GUIDE_ANSWERS)) for (const topic of GUIDE_TOPICS) expect(dictionary[topic].length).toBeGreaterThan(30);
});
