// Centralized UI strings so Hindi/Gujarati can be added later without
// rebuilding components. Use `t("key")` everywhere instead of hard-coded text.

export type Locale = "en";

const en = {
  // App / brand
  appName: "Soft Ledger",
  tagline: "Bookkeeping, without the headache",

  // Common
  save: "Save",
  cancel: "Cancel",
  close: "Close",
  back: "Back",
  loading: "Loading…",
  today: "Today",
  yesterday: "Yesterday",
  paid: "Paid",
  due: "Due",
  total: "Total",
  amount: "Amount",
  date: "Date",
  month: "Month",
  quantity: "Quantity",
  price: "Price",
  rate: "Rate",
  notes: "Notes",
  optional: "Optional",
  search: "Search",
  confirm: "Confirm",
  reject: "Reject",
  dispute: "Dispute",
  verify: "Verify",
  verified: "Verified",
  pending: "Pending",
  confirmed: "Confirmed",
  rejected: "Disputed",
  reversed: "Reversed",
  all: "All",
  active: "Active",
  paused: "Paused",
  ended: "Ended",
  enabled: "Enabled",
  disabled: "Disabled",
  add: "Add",
  edit: "Edit",
  delete: "Delete",
  reversed_lowercase: "reversed",

  // Roles
  vendor: "Vendor",
  customer: "Customer",
  businessOwner: "Business owner",

  // Nav
  navHome: "Home",
  navCustomers: "Customers",
  navActivity: "Activity",
  navMore: "More",

  // Auth
  welcomeBack: "Welcome!",
  authSubtitle: "Drop in your email and we'll get you set up",
  checkInbox: "Check your inbox",
  codeSentTo: "We sent a code to",
  differentEmail: "Use a different email",
  guestButton: "Jump in without an account",

  // Onboarding
  pickRole: "Tell us a bit about yourself so we can set things up.",
  iRunBusiness: "I run a business",
  iRunBusinessDesc: "Track orders, payments, and customers",
  imCustomer: "I'm a customer",
  imCustomerDesc: "See my orders and payments",
  businessNameLabel: "Business name",
  phoneLabel: "Phone (optional)",
  yourName: "Your name",
  usernameLabel: "Username",
  usernameHint: "3-24 letters, numbers or _ — people find you by this",
  usernameTaken: "That username is taken",

  // Vendor home
  greetingMorning: "Good morning",
  greetingAfternoon: "Good afternoon",
  greetingEvening: "Good evening",
  vendorHelloSuffix: "Here's how your business is doing",
  todayAtGlance: "Today at a glance",
  customers: "customers",
  units: "units",
  earnedToday: "earned",
  stillOwed: "Still owed",
  recentOrders: "Recent orders",
  seeAll: "See all",
  noOrdersToday: "No orders yet today",
  noOrdersTodayDesc: "When you start logging orders, they'll show up right here.",
  activeSubs: "Active subscriptions",
  monthBilled: "Billed this month",
  receivedMonth: "Received this month",
  needsVerification: "need your verification",

  // Customer home
  outstandingBalance: "Outstanding balance",
  inCredit: "In credit",
  thisMonth: "this month",
  whatYouGot: "What you got this month",
  nothingRecorded: "Nothing recorded yet",
  nothingRecordedDesc: "Once your business logs orders, they'll pop up here.",
  yourVendor: "Your vendor",
  payNow: "Record a payment",

  // Products
  products: "Products",
  productsDesc: "What you sell and at what price",
  newProduct: "New product",
  productName: "Product name",
  description: "Description",
  unit: "Unit",
  pricePerUnit: "Price per unit",
  noProducts: "No products yet",
  noProductsDesc: "Add your first product to start recording purchases.",
  disableProductTitle: "Disable product?",
  disableProductDesc:
    "It won't be available for new purchases or subscriptions, but all history stays intact.",
  enableProduct: "Enable",
  disableProduct: "Disable",

  // Record purchase
  recordPurchase: "Record purchase",
  recordFor: "Record for",
  recorded: "Recorded ✓",
  product: "Product",
  quickAmounts: "Quick amounts",
  record: "Record",
  recording: "Recording…",

  // Payments
  recordPayment: "Record payment",
  paymentFrom: "Record payment from",
  paymentRecorded: "Payment recorded ✓",
  outstandingDue: "Outstanding due",
  paymentMethod: "Payment method",
  cash: "Cash",
  upi: "UPI",
  bank: "Bank",
  other: "Other",
  verifyPayment: "Verify payment",
  verifyPaymentDesc:
    "Confirm only if you received this money. Disputing keeps your balance unchanged.",
  recordedBy: "Recorded by",
  verifiedBy: "Verified by",
  confirmPayment: "Confirm payment",
  rejectPayment: "Dispute payment",
  paymentsAwaiting: "Payments awaiting verification",
  noPendingPayments: "No payments waiting",
  noPendingPaymentsDesc: "When the other side records a payment, you verify it here.",
  reversePayment: "Reverse payment",
  reversePaymentDesc:
    "Only for confirmed payments recorded by mistake. This keeps an audit trail; history is never silently changed.",
  reason: "Reason",

  // Payment status
  statusPendingVerify: "Awaiting verification",
  statusConfirmed: "Confirmed",
  statusRejected: "Disputed",

  // Subscriptions
  subscriptions: "Subscriptions",
  subscriptionsDesc: "Recurring purchases, generated automatically",
  newSubscription: "New subscription",
  frequency: "Frequency",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  startDate: "Start date",
  noSubs: "No subscriptions yet",
  noSubsDesc: "Set up a recurring delivery and purchases are logged for you.",
  pause: "Pause",
  resume: "Resume",
  end: "End",
  endSubTitle: "End subscription?",
  endSubDesc: "Past purchases stay on the account. This can't be undone.",
  subscriptionPurchase: "Subscription purchase",

  // Customer detail (vendor view)
  customerInfo: "Customer info",
  accountStatement: "Account statement",
  filters: "Filters",
  purchaseType: "Type",
  singlePurchases: "Single",
  subPurchases: "Subscription",
  paymentStatus: "Payment status",
  productFilter: "Product",
  reversePurchase: "Reverse",
  reversePurchaseDesc:
    "Creates a correction entry; the original stays in history.",
  monthBills: "Monthly statements",
  noBills: "No statements yet",
  noBillsDesc: "Statements are generated on the 1st of each month.",
  totalBilled: "Total billed",
  totalPaid: "Total received",
  openingBalance: "Opening balance",
  closingBalance: "Closing balance",
  monthSummary: "Month summary",
  activity: "Activity",
  payments: "Payments",
  remaining: "Remaining",

  // Connect
  findVendor: "Find your vendor",
  findVendorDesc: "Search by their username",
  vendorUsername: "Vendor's username",
  requestConnection: "Request connection",
  requestSent: "Request sent — waiting for them to accept",
  connectedVendors: "Connected vendors",
  noVendor: "No vendor connected",
  noVendorDesc: "Ask your vendor for their username or invite link.",
  connectWith: "Connect with",
  scanToConnect: "Have them scan this to get connected",
  copyInviteLink: "Copy the invite link",
  copied: "Copied to clipboard!",
  inviteCode: "Invite code",
  inviteCustomers: "Invite customers",
  inviteByEmail: "Invite by email (optional)",
  sendInvite: "Generate invite code",
  inviteOffline: "Invite an offline customer",
  pickCustomer: "Pick a customer",
  connectionRequests: "Connection requests",
  accept: "Accept",
  decline: "Decline",
  noRequests: "No pending requests",

  // Notifications
  notifications: "Notifications",
  markAllRead: "Mark all read",
  noNotifications: "You're all caught up",
  noNotificationsDesc: "Reminders, verifications and requests show up here.",
  justNow: "just now",

  // More / profile
  profile: "Profile",
  editProfile: "Edit profile",
  profileSaved: "Profile updated",
  signOut: "Sign out",
  aboutApp: "About Soft Ledger",
  appVersion: "Version 1.0 · Made with ❤️",
  manageCustomers: "Manage customers",
  viewAndEdit: "View and edit customer details",

  // Errors
  errGeneric: "Something went wrong. Please try again.",
  errNotConnected: "You're not connected to a vendor yet.",
} as const;

export type TranslationKey = keyof typeof en;

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en };

let currentLocale: Locale = "en";

export function setLocale(locale: Locale) {
  currentLocale = locale;
}

export function t(key: TranslationKey): string {
  return dictionaries[currentLocale][key] ?? dictionaries.en[key] ?? key;
}
