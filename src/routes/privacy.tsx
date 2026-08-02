import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/LegalPage";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Bazar Bari" },
      {
        name: "description",
        content:
          "How Bazar Bari collects, processes, stores and protects merchant and customer data, including your rights under GDPR-aligned practices.",
      },
      { property: "og:title", content: "Privacy Policy — Bazar Bari" },
      {
        property: "og:description",
        content: "Data collection, processing, retention, security and your privacy rights at Bazar Bari.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const sections = bn
    ? [
        {
          heading: "পরিচিতি ও পরিধি",
          body: [
            "এই প্রাইভেসি পলিসি ব্যাখ্যা করে Bazar Bari (“আমরা”) কীভাবে আমাদের পয়েন্ট-অফ-সেল ও ব্যবসা ব্যবস্থাপনা প্ল্যাটফর্ম ব্যবহারের সময় তথ্য সংগ্রহ, ব্যবহার, সংরক্ষণ ও প্রকাশ করে। প্ল্যাটফর্ম ব্যবহার করলে আপনি এই নীতিমালায় সম্মত হচ্ছেন।",
          ],
        },
        {
          heading: "আমরা যেসব তথ্য সংগ্রহ করি",
          body: ["আমরা কেবল সেবা প্রদানের জন্য প্রয়োজনীয় তথ্যই সংগ্রহ করি।"],
          list: [
            "অ্যাকাউন্ট তথ্য: নাম, ইউজারনেম, ইমেইল, রোল ও ব্রাঞ্চ।",
            "ব্যবসায়িক ডেটা: পণ্য, স্টক, বিক্রয়, ক্রয়, খরচ, পেমেন্ট ও হিসাবের এন্ট্রি।",
            "কাস্টমার ও সরবরাহকারী তথ্য: আপনি যে নাম, ফোন বা ঠিকানা যুক্ত করেন।",
            "টেকনিক্যাল লগ: লগইন সময়, ডিভাইস/ব্রাউজার তথ্য ও অডিট ট্রেইল।",
          ],
        },
        {
          heading: "তথ্য ব্যবহারের উদ্দেশ্য",
          body: [
            "আমরা তথ্য ব্যবহার করি সেবা পরিচালনা, বিলিং, নিরাপত্তা নিশ্চিতকরণ, প্রতারণা প্রতিরোধ, গ্রাহক সহায়তা ও আইনগত বাধ্যবাধকতা পালনের জন্য।",
            "আপনার ব্যবসায়িক ডেটা আমরা কখনোই বিক্রি করি না এবং বিজ্ঞাপনের জন্য ব্যবহার করি না।",
          ],
        },
        {
          heading: "আইনগত ভিত্তি",
          body: [
            "প্রযোজ্য ক্ষেত্রে আমরা চুক্তি সম্পাদন, বৈধ ব্যবসায়িক স্বার্থ, আইনগত বাধ্যবাধকতা অথবা আপনার সম্মতির ভিত্তিতে ডেটা প্রক্রিয়া করি।",
          ],
        },
        {
          heading: "সাব-প্রসেসর ও তৃতীয় পক্ষ",
          body: [
            "আমরা হোস্টিং, ডেটাবেজ, ইমেইল ও পেমেন্ট প্রক্রিয়াকরণের জন্য নির্বাচিত সেবাদাতা ব্যবহার করি। প্রত্যেক সাব-প্রসেসর চুক্তিবদ্ধভাবে গোপনীয়তা ও নিরাপত্তা রক্ষায় বাধ্য।",
          ],
        },
        {
          heading: "ডেটা সংরক্ষণ ও অবস্থান",
          body: [
            "অ্যাকাউন্ট সক্রিয় থাকা পর্যন্ত এবং আইনগত/হিসাবরক্ষণজনিত প্রয়োজনে অতিরিক্ত সময় পর্যন্ত ডেটা সংরক্ষণ করা হয়। অনুরোধে অ্যাকাউন্ট বন্ধের পর ডেটা মুছে ফেলা হয়।",
          ],
        },
        {
          heading: "নিরাপত্তা ব্যবস্থা",
          body: [
            "ট্রান্সপোর্ট এনক্রিপশন (HTTPS), রোল-ভিত্তিক অ্যাক্সেস কন্ট্রোল, রো-লেভেল ডেটা আইসোলেশন এবং গুরুত্বপূর্ণ কাজের অডিট লগ ব্যবহার করা হয়। কোনো ব্যবস্থাই শতভাগ নিরাপদ নয়, তাই আমরা ধারাবাহিকভাবে উন্নয়ন করি।",
          ],
        },
        {
          heading: "আপনার অধিকার",
          body: ["প্রযোজ্য আইনের অধীনে আপনি নিচের অধিকারগুলো প্রয়োগ করতে পারেন।"],
          list: [
            "ডেটা দেখা ও অনুলিপি নেওয়া (CSV এক্সপোর্টসহ)।",
            "ভুল তথ্য সংশোধন করা।",
            "ডেটা মুছে ফেলার অনুরোধ।",
            "প্রক্রিয়াকরণে আপত্তি বা সীমাবদ্ধতা আরোপ।",
          ],
        },
        {
          heading: "কুকি ও অ্যানালিটিক্স",
          body: [
            "সেশন বজায় রাখা ও ভাষা পছন্দ মনে রাখার জন্য প্রয়োজনীয় কুকি/লোকাল স্টোরেজ ব্যবহার করা হয়।",
          ],
        },
        {
          heading: "নীতিমালার পরিবর্তন ও যোগাযোগ",
          body: [
            "এই নীতিমালা হালনাগাদ হলে এই পৃষ্ঠায় প্রকাশ করা হবে। প্রশ্ন বা অনুরোধের জন্য অ্যাপের সাপোর্ট চ্যানেলে যোগাযোগ করুন।",
          ],
        },
      ]
    : [
        {
          heading: "Introduction and scope",
          body: [
            "This Privacy Policy explains how Bazar Bari (“we”, “us”) collects, uses, stores and discloses information when you access our point-of-sale and business management platform. By using the platform you agree to the practices described here.",
          ],
        },
        {
          heading: "Information we collect",
          body: ["We collect only the information required to deliver and secure the service."],
          list: [
            "Account data: name, username, email address, assigned role and branch.",
            "Business records: products, stock, sales, purchases, expenses, payments and accounting entries you create.",
            "Contact records: customer and supplier names, phone numbers and addresses you enter.",
            "Technical data: sign-in timestamps, device and browser metadata, and audit-trail events.",
          ],
        },
        {
          heading: "How we use information",
          body: [
            "We process information to operate and improve the platform, authenticate users, provide support, handle billing, prevent fraud and abuse, and comply with legal obligations.",
            "We do not sell your business data, and we do not use it for advertising or profiling.",
          ],
        },
        {
          heading: "Legal bases for processing",
          body: [
            "Where applicable law requires a legal basis, we rely on performance of our contract with you, our legitimate interests in operating a secure service, compliance with legal obligations, and your consent where specifically requested.",
          ],
        },
        {
          heading: "Sub-processors and third parties",
          body: [
            "We use vetted service providers for hosting, database, email delivery and payment processing. Each sub-processor is bound by contractual confidentiality and security obligations and may only process data on our documented instructions.",
          ],
        },
        {
          heading: "Data retention and location",
          body: [
            "We retain data for as long as your account remains active and thereafter only as required for accounting, tax, dispute-resolution or other legal purposes. On verified request, account data is deleted after termination, subject to those retention requirements.",
          ],
        },
        {
          heading: "Security measures",
          body: [
            "We apply transport encryption (HTTPS), role-based access control, row-level data isolation between accounts, least-privilege service credentials and audit logging of sensitive actions. No system is completely secure, so we review and improve controls on an ongoing basis.",
          ],
        },
        {
          heading: "Your rights",
          body: ["Depending on your jurisdiction, you may exercise the following rights."],
          list: [
            "Access and obtain a copy of your data, including CSV export from within the application.",
            "Rectify inaccurate or incomplete information.",
            "Request erasure of data we no longer need to retain.",
            "Object to or request restriction of certain processing activities.",
          ],
        },
        {
          heading: "Cookies and local storage",
          body: [
            "We use strictly necessary cookies and browser local storage to maintain your authenticated session and remember interface preferences such as language. We do not use advertising cookies.",
          ],
        },
        {
          heading: "Changes and contact",
          body: [
            "Material changes to this policy will be published on this page with a revised effective date. For privacy questions or to exercise your rights, contact us through the support channel listed in your account.",
          ],
        },
      ];

  return (
    <LegalPage
      eyebrow={bn ? "আইনগত" : "Legal"}
      title={bn ? "প্রাইভেসি পলিসি" : "Privacy Policy"}
      updated={
        bn
          ? "সর্বশেষ হালনাগাদ: ১ জানুয়ারি ২০২৬"
          : "Last updated: 1 January 2026 · Effective immediately"
      }
      intro={
        bn
          ? "আপনার ব্যবসায়িক ও গ্রাহক তথ্যের গোপনীয়তা আমাদের কাছে গুরুত্বপূর্ণ। নিচে আমাদের ডেটা সংক্রান্ত নীতিমালা বিস্তারিতভাবে দেওয়া হলো।"
          : "Protecting merchant and customer information is fundamental to how we build Bazar Bari. This policy sets out, in plain language, what we collect, why we collect it and the controls we maintain."
      }
      sections={sections}
      footnote={
        bn
          ? "এই নথিটি সাধারণ তথ্যের জন্য এবং আইনগত পরামর্শ নয়। আপনার এখতিয়ারে নির্দিষ্ট বাধ্যবাধকতার জন্য আইনজীবীর পরামর্শ নিন।"
          : "This document is provided for general information and does not constitute legal advice. Consult qualified counsel for obligations specific to your jurisdiction."
      }
    />
  );
}
