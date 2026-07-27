import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Lang = "bn" | "en";

const dict = {
  appName: { bn: "শেরা পস", en: "SheraPOS" },
  tagline: {
    bn: "দোকানের বিক্রি, স্টক আর হিসাব — এক জায়গায়",
    en: "Sales, stock and reports for your shop — in one place",
  },
  heroSub: {
    bn: "দ্রুত বিলিং, স্বয়ংক্রিয় স্টক আপডেট আর দৈনিক রিপোর্ট। ব্রাউজার থেকেই চালান, কোনো ইনস্টল লাগবে না।",
    en: "Fast billing, automatic stock updates and daily reports. Runs in the browser, nothing to install.",
  },
  getStarted: { bn: "শুরু করুন", en: "Get started" },
  signIn: { bn: "সাইন ইন", en: "Sign in" },
  signUp: { bn: "রেজিস্টার", en: "Sign up" },
  signOut: { bn: "লগ আউট", en: "Sign out" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  fullName: { bn: "পুরো নাম", en: "Full name" },
  continueGoogle: { bn: "গুগল দিয়ে চালিয়ে যান", en: "Continue with Google" },
  or: { bn: "অথবা", en: "or" },
  haveAccount: { bn: "অ্যাকাউন্ট আছে? সাইন ইন করুন", en: "Already have an account? Sign in" },
  noAccount: { bn: "অ্যাকাউন্ট নেই? রেজিস্টার করুন", en: "No account? Sign up" },
  pos: { bn: "বিক্রয়", en: "POS" },
  products: { bn: "পণ্য ও স্টক", en: "Products & Stock" },
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  sales: { bn: "বিক্রয় তালিকা", en: "Sales" },
  search: { bn: "পণ্য খুঁজুন বা SKU লিখুন", en: "Search product or type SKU" },
  all: { bn: "সব", en: "All" },
  cart: { bn: "কার্ট", en: "Cart" },
  emptyCart: { bn: "কার্ট খালি — পণ্যে ক্লিক করে যোগ করুন", en: "Cart is empty — tap a product to add" },
  subtotal: { bn: "সাবটোটাল", en: "Subtotal" },
  discount: { bn: "ডিসকাউন্ট", en: "Discount" },
  tax: { bn: "ভ্যাট", en: "VAT" },
  total: { bn: "সর্বমোট", en: "Total" },
  paid: { bn: "পরিশোধিত", en: "Paid" },
  due: { bn: "বাকি", en: "Due" },
  change: { bn: "ফেরত", en: "Change" },
  payment: { bn: "পেমেন্ট", en: "Payment" },
  cash: { bn: "নগদ", en: "Cash" },
  card: { bn: "কার্ড", en: "Card" },
  mobile: { bn: "মোবাইল ব্যাংকিং", en: "Mobile banking" },
  customer: { bn: "কাস্টমার নাম", en: "Customer name" },
  phone: { bn: "মোবাইল নম্বর", en: "Phone" },
  checkout: { bn: "বিল সম্পন্ন করুন", en: "Complete sale" },
  clear: { bn: "খালি করুন", en: "Clear" },
  receipt: { bn: "রসিদ", en: "Receipt" },
  print: { bn: "প্রিন্ট", en: "Print" },
  invoice: { bn: "ইনভয়েস", en: "Invoice" },
  newSale: { bn: "নতুন বিক্রয়", en: "New sale" },
  stock: { bn: "স্টক", en: "Stock" },
  price: { bn: "দাম", en: "Price" },
  cost: { bn: "ক্রয়মূল্য", en: "Cost" },
  sku: { bn: "এসকেইউ", en: "SKU" },
  category: { bn: "ক্যাটাগরি", en: "Category" },
  unit: { bn: "একক", en: "Unit" },
  addProduct: { bn: "নতুন পণ্য", en: "Add product" },
  editProduct: { bn: "পণ্য সম্পাদনা", en: "Edit product" },
  save: { bn: "সেভ", en: "Save" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  delete: { bn: "মুছুন", en: "Delete" },
  lowStock: { bn: "স্টক কম", en: "Low stock" },
  outOfStock: { bn: "স্টক শেষ", en: "Out of stock" },
  todaySales: { bn: "আজকের বিক্রি", en: "Today's sales" },
  todayOrders: { bn: "আজকের অর্ডার", en: "Today's orders" },
  totalProducts: { bn: "মোট পণ্য", en: "Total products" },
  lowStockItems: { bn: "কম স্টকের পণ্য", en: "Low stock items" },
  last7days: { bn: "গত ৭ দিনের বিক্রি", en: "Sales last 7 days" },
  topProducts: { bn: "সেরা বিক্রিত পণ্য", en: "Top selling products" },
  recentSales: { bn: "সাম্প্রতিক বিক্রয়", en: "Recent sales" },
  qty: { bn: "পরিমাণ", en: "Qty" },
  items: { bn: "আইটেম", en: "Items" },
  date: { bn: "তারিখ", en: "Date" },
  noData: { bn: "কোনো তথ্য নেই", en: "No data yet" },
  loading: { bn: "লোড হচ্ছে…", en: "Loading…" },
  thanks: { bn: "ধন্যবাদ, আবার আসবেন!", en: "Thank you, come again!" },
  cashier: { bn: "বিক্রেতা", en: "Cashier" },
  low: { bn: "কম", en: "Low" },
  featureBilling: { bn: "টাচ-বান্ধব বিলিং", en: "Touch-friendly billing" },
  featureBillingD: { bn: "গ্রিড থেকে পণ্য ট্যাপ করুন, ডিসকাউন্ট দিন, রসিদ প্রিন্ট করুন।", en: "Tap products from the grid, apply discounts, print receipts." },
  featureStock: { bn: "স্বয়ংক্রিয় স্টক", en: "Automatic stock" },
  featureStockD: { bn: "প্রতিটি বিক্রয়ে স্টক কমে যায়, কম স্টকে সতর্কতা।", en: "Stock drops on every sale, with low-stock alerts." },
  featureReport: { bn: "রিপোর্ট", en: "Reports" },
  featureReportD: { bn: "দৈনিক বিক্রি, সেরা পণ্য আর সাম্প্রতিক ইনভয়েস।", en: "Daily sales, best sellers and recent invoices." },
  contacts: { bn: "কাস্টমার ও সাপ্লায়ার", en: "Contacts" },
  customers: { bn: "কাস্টমার", en: "Customers" },
  suppliers: { bn: "সাপ্লায়ার", en: "Suppliers" },
  supplier: { bn: "সাপ্লায়ার", en: "Supplier" },
  addContact: { bn: "নতুন কন্টাক্ট", en: "Add contact" },
  editContact: { bn: "কন্টাক্ট সম্পাদনা", en: "Edit contact" },
  name: { bn: "নাম", en: "Name" },
  address: { bn: "ঠিকানা", en: "Address" },
  type: { bn: "ধরন", en: "Type" },
  openingBalance: { bn: "প্রারম্ভিক ব্যালেন্স", en: "Opening balance" },
  purchases: { bn: "ক্রয়", en: "Purchases" },
  addPurchase: { bn: "নতুন ক্রয়", en: "New purchase" },
  purchaseNote: { bn: "ক্রয় করলে স্টক স্বয়ংক্রিয়ভাবে বাড়বে", en: "Stock increases automatically on purchase" },
  expenses: { bn: "খরচ", en: "Expenses" },
  addExpense: { bn: "নতুন খরচ", en: "Add expense" },
  amount: { bn: "টাকার পরিমাণ", en: "Amount" },
  title: { bn: "বিবরণ", en: "Title" },
  note: { bn: "নোট", en: "Note" },
  settings: { bn: "সেটিংস", en: "Settings" },
  shopName: { bn: "দোকানের নাম", en: "Shop name" },
  receiptFooter: { bn: "রসিদের নিচের লেখা", en: "Receipt footer" },
  defaultTax: { bn: "ডিফল্ট ভ্যাট (%)", en: "Default VAT (%)" },
  barcode: { bn: "বারকোড", en: "Barcode" },
  brand: { bn: "ব্র্যান্ড", en: "Brand" },
  expiry: { bn: "মেয়াদ", en: "Expiry" },
  returns: { bn: "বিক্রয় ফেরত", en: "Sale returns" },
  returnSale: { bn: "ফেরত নিন", en: "Return" },
  reason: { bn: "কারণ", en: "Reason" },
  status: { bn: "অবস্থা", en: "Status" },
  draft: { bn: "ড্রাফট", en: "Draft" },
  quotation: { bn: "কোটেশন", en: "Quotation" },
  final: { bn: "চূড়ান্ত", en: "Final" },
  holdSale: { bn: "হোল্ড করুন", en: "Hold" },
  saveQuotation: { bn: "কোটেশন সেভ", en: "Save quotation" },
  selectCustomer: { bn: "কাস্টমার বাছুন", en: "Select customer" },
  walkIn: { bn: "সাধারণ কাস্টমার", en: "Walk-in" },
  scanBarcode: { bn: "বারকোড স্ক্যান বা SKU লিখে এন্টার", en: "Scan barcode or type SKU + Enter" },
  reports: { bn: "রিপোর্ট", en: "Reports" },
  profitLoss: { bn: "লাভ-ক্ষতি", en: "Profit & loss" },
  grossProfit: { bn: "গ্রস লাভ", en: "Gross profit" },
  netProfit: { bn: "নিট লাভ", en: "Net profit" },
  totalPurchase: { bn: "মোট ক্রয়", en: "Total purchase" },
  totalExpense: { bn: "মোট খরচ", en: "Total expense" },
  totalSales: { bn: "মোট বিক্রয়", en: "Total sales" },
  totalReturns: { bn: "মোট ফেরত", en: "Total returns" },
  expiringSoon: { bn: "মেয়াদ শেষের পথে", en: "Expiring soon" },
  from: { bn: "শুরু", en: "From" },
  to: { bn: "শেষ", en: "To" },
  view: { bn: "দেখুন", en: "View" },
  balanceDue: { bn: "বাকি", en: "Balance due" },
  usersRoles: { bn: "ইউজার ও রোল", en: "Users & roles" },
  usersRolesHint: {
    bn: "স্টাফ অ্যাকাউন্ট তৈরি করুন এবং রোল নির্ধারণ করুন",
    en: "Create staff accounts and assign their roles",
  },
  addUser: { bn: "নতুন ইউজার", en: "Add user" },
  searchUser: { bn: "ইউজার খুঁজুন", en: "Search user" },
  username: { bn: "ইউজারনেম", en: "Username" },
  usernameOrEmail: { bn: "ইউজারনেম বা ইমেইল", en: "Username or email" },
  role: { bn: "রোল", en: "Role" },
  actions: { bn: "অ্যাকশন", en: "Actions" },
  resetPassword: { bn: "পাসওয়ার্ড পরিবর্তন", en: "Reset password" },
  adminOnly: { bn: "শুধু অ্যাডমিন এই পাতা দেখতে পারবেন", en: "Only admins can view this page" },
  userCreated: { bn: "ইউজার তৈরি হয়েছে", en: "User created" },
  userDeleted: { bn: "ইউজার মুছে ফেলা হয়েছে", en: "User deleted" },
  roleUpdated: { bn: "রোল হালনাগাদ হয়েছে", en: "Role updated" },
  passwordUpdated: { bn: "পাসওয়ার্ড হালনাগাদ হয়েছে", en: "Password updated" },
  roleSuperAdmin: { bn: "সুপার অ্যাডমিন", en: "Super Admin" },
  roleAdmin: { bn: "অ্যাডমিন", en: "Admin" },
  roleManager: { bn: "ম্যানেজার", en: "Manager" },
  roleCashier: { bn: "ক্যাশিয়ার", en: "Cashier" },
  roleStaff: { bn: "স্টাফ", en: "Staff" },
  paymentsLedger: { bn: "বাকি ও পেমেন্ট", en: "Payments & Due" },
  addPayment: { bn: "নতুন পেমেন্ট", en: "Add payment" },
  moneyIn: { bn: "টাকা গ্রহণ", en: "Money received" },
  moneyOut: { bn: "টাকা প্রদান", en: "Money paid" },
  party: { bn: "কাস্টমার/সাপ্লায়ার", en: "Customer / Supplier" },
  balances: { bn: "বকেয়ার হিসাব", en: "Balances" },
  receivable: { bn: "পাওনা", en: "Receivable" },
  payable: { bn: "দেনা", en: "Payable" },
  totalReceived: { bn: "মোট গ্রহণ", en: "Total received" },
  totalPaidOut: { bn: "মোট প্রদান", en: "Total paid" },
  stockAdjust: { bn: "স্টক সমন্বয়", en: "Stock adjustment" },
  addAdjust: { bn: "নতুন সমন্বয়", en: "New adjustment" },
  adjustAdd: { bn: "স্টক বাড়ান", en: "Add stock" },
  adjustRemove: { bn: "স্টক কমান", en: "Remove stock" },
  adjustDamage: { bn: "নষ্ট/ড্যামেজ", en: "Damage" },
  quantity: { bn: "পরিমাণ", en: "Quantity" },
  catalog: { bn: "ক্যাটালগ", en: "Catalog" },
  brands: { bn: "ব্র্যান্ড তালিকা", en: "Brands" },
  units: { bn: "ইউনিট তালিকা", en: "Units" },
  categoriesList: { bn: "ক্যাটাগরি তালিকা", en: "Categories" },
  nameBn: { bn: "নাম (বাংলা)", en: "Name (Bangla)" },
  nameEn: { bn: "নাম (ইংরেজি)", en: "Name (English)" },
  add: { bn: "যোগ করুন", en: "Add" },
  labels: { bn: "বারকোড লেবেল", en: "Barcode labels" },
  labelCount: { bn: "লেবেল সংখ্যা", en: "Label count" },
  printLabels: { bn: "লেবেল প্রিন্ট", en: "Print labels" },
  noBarcode: { bn: "বারকোড নেই", en: "No barcode" },
  selectProduct: { bn: "পণ্য বাছুন", en: "Select product" },
  auditLog: { bn: "অডিট লগ", en: "Audit log" },
  auditLogHint: {
    bn: "লগইন ও গুরুত্বপূর্ণ কাজের রেকর্ড",
    en: "Record of logins and important actions",
  },
  exportCsv: { bn: "CSV এক্সপোর্ট", en: "Export CSV" },
  time: { bn: "সময়", en: "Time" },
  user: { bn: "ইউজার", en: "User" },
  action: { bn: "কাজ", en: "Action" },
  details: { bn: "বিবরণ", en: "Details" },
  noAccess: { bn: "এই পাতা দেখার অনুমতি নেই", en: "You do not have access to this page" },
  actLogin: { bn: "লগইন", en: "Login" },
  actLogout: { bn: "লগ আউট", en: "Logout" },
  actSale: { bn: "বিক্রয়", en: "Sale" },
  actSaleReturn: { bn: "বিক্রয় ফেরত", en: "Sale return" },
  actProductCreate: { bn: "পণ্য যোগ", en: "Product added" },
  actProductUpdate: { bn: "পণ্য সম্পাদনা", en: "Product updated" },
  actProductDelete: { bn: "পণ্য মুছে ফেলা", en: "Product deleted" },
  actUserCreate: { bn: "ইউজার তৈরি", en: "User created" },
  actUserDelete: { bn: "ইউজার মুছে ফেলা", en: "User deleted" },
  actRoleUpdate: { bn: "রোল পরিবর্তন", en: "Role changed" },
  actPasswordReset: { bn: "পাসওয়ার্ড রিসেট", en: "Password reset" },
  actPayment: { bn: "পেমেন্ট", en: "Payment" },
  actStockAdjust: { bn: "স্টক সমন্বয়", en: "Stock adjustment" },
  actPurchase: { bn: "ক্রয়", en: "Purchase" },
  actExpense: { bn: "খরচ", en: "Expense" },
  actSettings: { bn: "সেটিংস পরিবর্তন", en: "Settings updated" },
} as const;




export type TKey = keyof typeof dict;

type Ctx = { lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string };
const I18nContext = createContext<Ctx>({ lang: "bn", setLang: () => {}, t: (k) => dict[k].bn });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");

  useEffect(() => {
    const saved = window.localStorage.getItem("sherapos-lang");
    if (saved === "bn" || saved === "en") setLangState(saved);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    window.localStorage.setItem("sherapos-lang", l);
  }, []);

  const value = useMemo<Ctx>(() => ({ lang, setLang, t: (k) => dict[k][lang] }), [lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}

export function money(v: number, lang: Lang = "en") {
  const n = Number(v || 0).toFixed(2);
  return lang === "bn" ? `৳${toBn(n)}` : `৳${n}`;
}

export function toBn(input: string | number) {
  const map = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(input).replace(/\d/g, (d) => map[Number(d)]);
}

export function num(v: number | string, lang: Lang) {
  return lang === "bn" ? toBn(v) : String(v);
}
