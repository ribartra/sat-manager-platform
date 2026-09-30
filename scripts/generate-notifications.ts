import "dotenv/config";
import { generateDeadlineNotifications } from "../lib/deadline-notifications";

// Manual run of the deadline reminders. In production they run hourly: VM cron →
// POST /api/internal/notifications/generate (see deploy/vm-startup.sh).
generateDeadlineNotifications()
  .then((summary) => {
    console.info(JSON.stringify({ level: "info", event: "notifications.generated", ...summary }));
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
