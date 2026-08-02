import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Bazar Bari" },
      {
        name: "description",
        content:
          "The agreement governing use of the Bazar Bari platform: subscriptions, billing, acceptable use, data ownership, warranties and liability.",
      },
      { property: "og:title", content: "Terms of Service — Bazar Bari" },
      {
        property: "og:description",
        content: "Subscription terms, acceptable use, data ownership and liability for Bazar Bari customers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const sections = bn
    ? [
        {
          heading: "চুক্তি গ্রহণ",
          body: [
            "Bazar Bari প্ল্যাটফর্মে অ্যাকাউন্ট খোলা বা ব্যবহারের মাধ্যমে আপনি (“গ্রাহক”) এই শর্তাবলিতে সম্মত হচ্ছেন। প্রতিষ্ঠানের পক্ষে সম্মত হলে আপনি নিশ্চিত করছেন যে আপনার সেই কর্তৃত্ব রয়েছে।",
          ],
        },
        {
          heading: "সেবার বিবরণ",
          body: [
            "Bazar Bari একটি সাবস্ক্রিপশনভিত্তিক ক্লাউড সফটওয়্যার যা বিলিং, ইনভেন্টরি, মাল্টি-ব্রাঞ্চ ব্যবস্থাপনা, হিসাব ও রিপোর্টিং সুবিধা দেয়। আমরা সময়ে সময়ে ফিচার যোগ, পরিবর্তন বা অপসারণ করতে পারি।",
          ],
        },
        {
          heading: "অ্যাকাউন্ট ও নিরাপত্তা",
          body: [
            "আপনার লগইন তথ্যের গোপনীয়তা রক্ষা এবং আপনার অ্যাকাউন্টে সম্পাদিত সকল কার্যক্রমের দায়িত্ব আপনার। রোল ও অনুমতি সঠিকভাবে নির্ধারণ করা গ্রাহকের দায়িত্ব।",
          ],
        },
        {
          heading: "সাবস্ক্রিপশন, বিলিং ও নবায়ন",
          body: [
            "সাবস্ক্রিপশন পূর্বপরিশোধিত এবং নির্বাচিত চক্র অনুযায়ী স্বয়ংক্রিয়ভাবে নবায়ন হয়, যদি না নবায়নের তারিখের আগে বাতিল করা হয়। প্রযোজ্য কর ও ফি গ্রাহকের বহনযোগ্য।",
            "পেমেন্ট ব্যর্থ হলে সেবা সীমিত বা স্থগিত করা হতে পারে।",
          ],
        },
        {
          heading: "বাতিল ও রিফান্ড",
          body: [
            "আপনি যেকোনো সময় বাতিল করতে পারেন; বাতিল চলতি বিলিং চক্রের শেষে কার্যকর হয়। আইনগতভাবে বাধ্যতামূলক না হলে আংশিক সময়ের জন্য রিফান্ড প্রযোজ্য নয়।",
          ],
        },
        {
          heading: "গ্রহণযোগ্য ব্যবহার",
          body: ["নিম্নলিখিত কাজগুলো নিষিদ্ধ।"],
          list: [
            "বেআইনি, প্রতারণামূলক বা অন্যের অধিকার লঙ্ঘনকারী কার্যক্রম।",
            "সিস্টেমে অননুমোদিত প্রবেশ, রিভার্স ইঞ্জিনিয়ারিং বা নিরাপত্তা ব্যবস্থা অতিক্রমের চেষ্টা।",
            "প্ল্যাটফর্মের স্থিতিশীলতা ক্ষতিগ্রস্ত করে এমন অতিরিক্ত বা স্বয়ংক্রিয় লোড তৈরি।",
          ],
        },
        {
          heading: "গ্রাহক ডেটার মালিকানা",
          body: [
            "আপনার ব্যবসায়িক ডেটার মালিকানা সম্পূর্ণ আপনার। সেবা প্রদানের সীমিত উদ্দেশ্যে আমরা তা প্রক্রিয়া করার লাইসেন্স পাই। যেকোনো সময় CSV আকারে ডেটা এক্সপোর্ট করা যাবে।",
          ],
        },
        {
          heading: "সেবা প্রাপ্যতা ও সাপোর্ট",
          body: [
            "আমরা উচ্চ প্রাপ্যতার লক্ষ্যে কাজ করি, তবে রক্ষণাবেক্ষণ বা তৃতীয় পক্ষের কারণে সাময়িক বিঘ্ন ঘটতে পারে। পরিকল্পিত রক্ষণাবেক্ষণের আগাম নোটিশ দেওয়ার চেষ্টা করা হয়।",
          ],
        },
        {
          heading: "ওয়ারেন্টি অস্বীকৃতি ও দায়সীমা",
          body: [
            "আইনের সর্বোচ্চ সীমা পর্যন্ত সেবা “যেমন আছে” ভিত্তিতে প্রদান করা হয়। পরোক্ষ, আনুষঙ্গিক বা পরিণামজনিত ক্ষতির জন্য আমরা দায়ী নই; মোট দায় গত ১২ মাসে পরিশোধিত ফি-এর বেশি হবে না।",
          ],
        },
        {
          heading: "সমাপ্তি, প্রযোজ্য আইন ও পরিবর্তন",
          body: [
            "শর্ত লঙ্ঘনে আমরা অ্যাকাউন্ট স্থগিত বা বাতিল করতে পারি। এই শর্তাবলি বাংলাদেশের প্রচলিত আইনে পরিচালিত। উল্লেখযোগ্য পরিবর্তন এই পৃষ্ঠায় প্রকাশ করা হবে।",
          ],
        },
      ]
    : [
        {
          heading: "Acceptance of terms",
          body: [
            "By creating an account or otherwise using the Bazar Bari platform, you (“Customer”) enter into a binding agreement with us on these terms. If you accept on behalf of an organisation, you represent that you are authorised to bind that organisation.",
          ],
        },
        {
          heading: "Description of the service",
          body: [
            "Bazar Bari is a subscription-based cloud application providing billing, inventory, multi-branch operations, accounting and reporting functionality. We may add, modify or discontinue features, and will avoid materially degrading core functionality during a paid term.",
          ],
        },
        {
          heading: "Accounts and security",
          body: [
            "You are responsible for maintaining the confidentiality of credentials, for correctly assigning roles and permissions, and for all activity occurring under your account. Notify us promptly of any suspected unauthorised access.",
          ],
        },
        {
          heading: "Subscriptions, billing and renewal",
          body: [
            "Subscriptions are billed in advance and renew automatically for successive terms unless cancelled before the renewal date. Fees exclude applicable taxes, duties and payment-processing charges, which are the Customer's responsibility.",
            "If a payment fails, we may restrict or suspend access after reasonable notice until the balance is settled.",
          ],
        },
        {
          heading: "Cancellation and refunds",
          body: [
            "You may cancel at any time; cancellation takes effect at the end of the current billing period and access continues until then. Except where required by law, fees already paid are non-refundable and partial periods are not pro-rated.",
          ],
        },
        {
          heading: "Acceptable use",
          body: ["You agree not to use the platform for any of the following."],
          list: [
            "Unlawful, fraudulent or rights-infringing activity, including sale of prohibited goods.",
            "Attempting unauthorised access, reverse engineering, or circumventing security or usage controls.",
            "Generating excessive automated load that degrades platform stability for other customers.",
            "Uploading malicious code or using the service to store data you have no lawful right to process.",
          ],
        },
        {
          heading: "Customer data and ownership",
          body: [
            "You retain all rights, title and interest in your business data. You grant us a limited licence to host and process that data solely to provide, secure and support the service. You may export your data as CSV at any time from within the application.",
          ],
        },
        {
          heading: "Availability and support",
          body: [
            "We target high availability but do not warrant uninterrupted operation. Planned maintenance is announced where practicable; unplanned interruptions may result from third-party infrastructure, network conditions or force majeure events.",
          ],
        },
        {
          heading: "Warranty disclaimer and limitation of liability",
          body: [
            "To the maximum extent permitted by law, the service is provided “as is” without warranties of any kind, express or implied, including merchantability and fitness for a particular purpose.",
            "We are not liable for indirect, incidental, special or consequential damages, or loss of profits or data. Our aggregate liability shall not exceed the fees paid by you in the twelve months preceding the claim.",
          ],
        },
        {
          heading: "Termination, governing law and changes",
          body: [
            "We may suspend or terminate accounts that materially breach these terms. On termination, you may export your data for a reasonable period before deletion. These terms are governed by the laws of the People's Republic of Bangladesh, without regard to conflict-of-law rules. Material changes will be posted on this page with a revised effective date.",
          ],
        },
      ];

  return (
    <LegalPage
      eyebrow={bn ? "আইনগত" : "Legal"}
      title={bn ? "সেবার শর্তাবলি" : "Terms of Service"}
      updated={
        bn ? "সর্বশেষ হালনাগাদ: ১ জানুয়ারি ২০২৬" : "Last updated: 1 January 2026 · Effective immediately"
      }
      intro={
        bn
          ? "এই শর্তাবলি Bazar Bari প্ল্যাটফর্ম ব্যবহারের নিয়ম, সাবস্ক্রিপশন, ডেটা মালিকানা ও দায়সীমা নির্ধারণ করে।"
          : "These terms govern access to and use of the Bazar Bari platform, including subscription commitments, acceptable use, data ownership and the allocation of risk between us."
      }
      sections={sections}
      footnote={
        bn
          ? "এই নথিটি সাধারণ তথ্যের জন্য এবং আইনগত পরামর্শ নয়।"
          : "This document is provided for general information and does not constitute legal advice."
      }
    />
  );
}
