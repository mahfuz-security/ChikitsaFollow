import { createAssistantApi } from "./assistant";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { refundRoutes } from "./refunds";
import { PrivateStore } from "./privateStore";
import { privateConfig } from "./privateConfig";
import { serviceClient } from "./blocksRuntime";
import { startNotificationWorker } from "./notificationWorker";

const localEnv = fileURLToPath(new URL(".env", import.meta.url));
if (existsSync(localEnv)) loadEnvFile(localEnv);

const port = Number(process.env.API_PORT || 8787);
const origins = (process.env.APP_ORIGINS || "").split(",").filter(Boolean);
const app = createAssistantApi({
  apiKey: process.env.GROQ_API_KEY,
  model: process.env.GROQ_MODEL,
  enabled: process.env.AI_ENABLED === "true",
  allowedOrigins: origins
});
const config = privateConfig();
const store = new PrivateStore(config.path, config.key);
const service = serviceClient();
app.use("/api/private", refundRoutes({ store, allowedOrigins: origins, workerEnabled: Boolean(service), service }));
if (service) startNotificationWorker(store, service, Number(process.env.DEADLINE_WARNING_HOURS || 24));
else console.info("Automatic notifications are disabled until Blocks service credentials are configured.");
app.listen(port, process.env.API_HOST || "127.0.0.1", () => console.info(`ChikitsaFollow API listening on port ${port}`));
