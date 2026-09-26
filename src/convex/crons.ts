import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Daily at 06:30 IST (01:00 UTC): generate subscription purchases for today.
crons.daily(
  "generate-subscription-purchases",
  { hourUTC: 1, minuteUTC: 0 },
  internal.subscriptions.generateForToday,
);

// Daily at 07:00 IST (01:30 UTC): expire subscriptions past their end date.
crons.daily(
  "expire-subscriptions",
  { hourUTC: 1, minuteUTC: 30 },
  internal.subscriptions.expireSubscriptions,
);

// Monthly on the 1st at 07:30 IST (02:00 UTC): statements for the prior month.
crons.monthly(
  "generate-monthly-bills",
  { day: 1, hourUTC: 2, minuteUTC: 0 },
  internal.lib.billing.generateMonthlyBills,
);

// Daily at 08:00 IST (02:30 UTC): gentle payment reminders (every 3 days).
crons.daily(
  "send-payment-reminders",
  { hourUTC: 2, minuteUTC: 30 },
  internal.lib.billing.sendPaymentReminders,
);

export default crons;
