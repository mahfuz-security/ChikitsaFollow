import { mkdirSync, writeFileSync } from "node:fs";
import { defaultDictionary } from "../src/lib/i18n/dictionary";
import { bengaliDictionary, germanDictionary } from "../src/lib/i18n/locales";

mkdirSync("blocks/localization", { recursive: true });
for (const [language, dictionary] of Object.entries({ "en-US": defaultDictionary, "bn-BD": bengaliDictionary, "de-DE": germanDictionary })) {
  const keys = Object.fromEntries(Object.entries(dictionary).map(([key, value]) => [key.replace(/^common\./, ""), value]));
  writeFileSync(`blocks/localization/common.${language}.json`, JSON.stringify(keys, null, 2) + "\n");
  console.info(`${language}: ${Object.keys(dictionary).length} translated keys`);
}
