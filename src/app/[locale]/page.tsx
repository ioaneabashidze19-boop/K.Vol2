"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState, useEffect } from "react";

import RatingDisplay from "@/components/marketplace/RatingDisplay";
import ServiceBadge from "@/components/marketplace/ServiceBadge";
import { useLocale } from "@/i18n/hooks";
import {
  slideUpVariants,
  staggerContainerVariants,
} from "@/lib/animations";

// Feature list definitions
const features = [
  {
    title: "Verified Providers",
    desc: "Rigorous background checks and performance ratings for every agency.",
    icon: "🛡️",
  },
  {
    title: "Smart Matching",
    desc: "Matchmaking algorithms pairing your tech stack with provider credentials.",
    icon: "🧠",
  },
  {
    title: "Instant Access",
    desc: "Initiate secure chats, sign digital agreements, and sync payments instantly.",
    icon: "⚡",
  },
  {
    title: "Transparent Pricing",
    desc: "Zero hidden fees. Clear commissions and milestones tracking dashboards.",
    icon: "💰",
  },
];

// Testimonials data
const testimonials = [
  {
    quote: "KavShare cut our procurement cycle in half. The smart matching matched us with the perfect React development team in under 24 hours.",
    author: "Elena Robakidze",
    role: "VP of Product, LineTech",
    rating: 5,
  },
  {
    quote: "As a development agency, finding trusted clients used to be a challenge. KavShare handles billing, contracts, and leads seamlessly.",
    author: "David Lominadze",
    role: "CEO, DevFlow Studio",
    rating: 5,
  },
  {
    quote: "The contract automation and transparent milestone billing gave both parties extreme peace of mind throughout our project lifecycle.",
    author: "Sophie Henderson",
    role: "Operations Director, NexaSoft",
    rating: 5,
  },
];

// Service categories
const categories = [
  { name: "SaaS Development", count: "124 Providers", slug: "saas" },
  { name: "UI/UX & Branding", count: "89 Providers", slug: "design" },
  { name: "Cloud Infrastructure", count: "56 Providers", slug: "cloud" },
  { name: "Data & Telemetry", count: "42 Providers", slug: "data" },
];

export default function HomePage() {
  const locale = useLocale();
  const [activeTestimonial, setActiveTestimonial] = useState(0);

  // Auto-rotate testimonials
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* Glow background mesh */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* 1. HERO SECTION */}
      <section className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-32 md:pb-36 flex flex-col items-center text-center">
        <motion.div
          variants={staggerContainerVariants}
          initial="initial"
          animate="animate"
          className="max-w-4xl space-y-8"
        >
          {/* Tech badge highlight */}
          <motion.div
            variants={slideUpVariants}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-500/35 bg-cyan-950/40 px-4 py-1.5 text-xs font-semibold text-brand-accent backdrop-blur-sm"
          >
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>Next-Gen Procurement Ecosystem</span>
          </motion.div>

          {/* Main Title */}
          <motion.h1
            variants={slideUpVariants}
            className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-text-primary via-slate-200 to-slate-400 bg-clip-text text-transparent leading-none"
          >
            Streamline B2B Procurement <br />
            <span className="bg-gradient-to-r from-brand-accent to-brand-success bg-clip-text text-transparent">
              With Absolute Trust
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={slideUpVariants}
            className="text-base sm:text-xl text-text-secondary max-w-2xl mx-auto leading-relaxed"
          >
            Connect seekers with verified dev agencies, automate SLA contract generation, log milestone reviews, and manage commissions on a single premium dashboard.
          </motion.p>

          {/* Action CTAs */}
          <motion.div
            variants={slideUpVariants}
            className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4"
          >
            <Link
              href={`/${locale}/sign-up`}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all text-center transform hover:-translate-y-0.5"
            >
              Sign Up as Seeker
            </Link>
            <Link
              href={`/${locale}/sign-up`}
              className="w-full sm:w-auto px-8 py-4 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-text-primary font-semibold rounded-xl transition-all text-center"
            >
              Join as Provider
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* 2. HOW IT WORKS SECTION */}
      <section className="relative z-10 bg-slate-900/40 border-y border-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold font-display text-text-primary">
              How KavShare Connects the Nodes
            </h2>
            <p className="text-sm text-text-secondary mt-2">
              A transparent, end-to-end flow from procurement definition to contract execution.
            </p>
          </div>

          {/* Flowchart grid */}
          <div className="grid md:grid-cols-4 gap-8 relative">
            {/* Step 1 */}
            <div className="flex flex-col items-center text-center p-6 bg-slate-950/50 border border-slate-850 rounded-2xl relative">
              <span className="absolute top-4 left-4 text-xs font-bold text-brand-accent">STEP 01</span>
              <div className="text-3xl mb-4 bg-slate-900 w-14 h-14 flex items-center justify-center rounded-2xl text-cyan-400">
                📝
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Seeker Posts Project</h3>
              <p className="text-xs text-text-muted">Buyers detail project scope, target budget boundaries, and technical stack parameters.</p>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center text-center p-6 bg-slate-950/50 border border-slate-850 rounded-2xl relative">
              <span className="absolute top-4 left-4 text-xs font-bold text-brand-accent">STEP 02</span>
              <div className="text-3xl mb-4 bg-slate-900 w-14 h-14 flex items-center justify-center rounded-2xl text-emerald-400">
                🤝
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Smart Matching</h3>
              <p className="text-xs text-text-muted">Our matching query checks technical compatibility and triggers verified connection alerts.</p>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center text-center p-6 bg-slate-950/50 border border-slate-850 rounded-2xl relative">
              <span className="absolute top-4 left-4 text-xs font-bold text-brand-accent">STEP 03</span>
              <div className="text-3xl mb-4 bg-slate-900 w-14 h-14 flex items-center justify-center rounded-2xl text-amber-400">
                📄
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Secure Agreement</h3>
              <p className="text-xs text-text-muted">Parties execute contracts, setting monthly retainers, commission schedules, and timelines.</p>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center text-center p-6 bg-slate-950/50 border border-slate-850 rounded-2xl relative">
              <span className="absolute top-4 left-4 text-xs font-bold text-brand-accent">STEP 04</span>
              <div className="text-3xl mb-4 bg-slate-900 w-14 h-14 flex items-center justify-center rounded-2xl text-purple-400">
                💳
              </div>
              <h3 className="text-base font-bold text-text-primary mb-1">Billing & Commission</h3>
              <p className="text-xs text-text-muted">Secure payment tracking runs automatically, processing service dues and commission logs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. KEY FEATURES SECTION */}
      <section className="relative z-10 py-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold font-display text-text-primary">
            Engineered for Modern Enterprise
          </h2>
          <p className="text-sm text-text-secondary mt-2">
            Why companies choose KavShare to manage their vendor network.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, idx) => (
            <div
              key={idx}
              className="p-6 bg-slate-900/40 border border-slate-850 rounded-2xl hover:border-slate-800 transition-all hover:bg-slate-900/60 group"
            >
              <div className="text-3xl mb-4 bg-slate-950 w-12 h-12 flex items-center justify-center rounded-xl group-hover:scale-105 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-2 group-hover:text-cyan-400 transition-colors">
                {feature.title}
              </h3>
              <p className="text-xs text-text-secondary leading-relaxed">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. TRUST & SOCIAL PROOF */}
      <section className="relative z-10 bg-slate-900/20 border-t border-slate-900 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center mb-20 bg-slate-950/60 border border-slate-850 p-8 rounded-3xl">
            <div>
              <span className="block text-3xl md:text-4xl font-extrabold font-display text-brand-accent">1,200+</span>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider mt-1 block">Verified Providers</span>
            </div>
            <div>
              <span className="block text-3xl md:text-4xl font-extrabold font-display text-brand-accent">$42M+</span>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider mt-1 block">Procured Projects</span>
            </div>
            <div>
              <span className="block text-3xl md:text-4xl font-extrabold font-display text-brand-accent">99.4%</span>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider mt-1 block">Satisfaction Rate</span>
            </div>
            <div>
              <span className="block text-3xl md:text-4xl font-extrabold font-display text-brand-accent">&lt;24h</span>
              <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider mt-1 block">Average Match Time</span>
            </div>
          </div>

          {/* Testimonial carousel */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold font-display text-center text-text-primary mb-10">
              Trusted by Leading Tech Teams
            </h3>

            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 md:p-12 relative shadow-2xl overflow-hidden min-h-[220px] flex flex-col justify-between">
              {/* Quotes icon backdrop */}
              <div className="absolute top-4 right-8 text-8xl text-slate-800/10 font-serif select-none pointer-events-none">
                “
              </div>

              <p className="text-base md:text-lg text-text-primary italic leading-relaxed z-10">
                &ldquo;{testimonials[activeTestimonial].quote}&rdquo;
              </p>

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-850 z-10">
                <div>
                  <h4 className="text-sm font-bold text-text-primary">{testimonials[activeTestimonial].author}</h4>
                  <p className="text-xs text-text-secondary">{testimonials[activeTestimonial].role}</p>
                </div>
                <RatingDisplay
                  rating={testimonials[activeTestimonial].rating}
                  count={5}
                  size="sm"
                />
              </div>
            </div>

            {/* Testimonial pagination indicators */}
            <div className="flex justify-center gap-2 mt-6">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveTestimonial(idx)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    activeTestimonial === idx ? "w-8 bg-brand-accent" : "w-2 bg-slate-800 hover:bg-slate-700"
                  }`}
                  aria-label={`Go to testimonial ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 5. CATEGORY PREVIEW */}
      <section className="relative z-10 py-20 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold font-display text-text-primary">
            Explore Key Verticals
          </h2>
          <p className="text-sm text-text-secondary mt-2">
            Procure agencies specializing in leading technical integrations.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat, idx) => (
            <Link
              key={idx}
              href={`/${locale}/marketplace?category=${cat.slug}`}
              className="bg-slate-900/30 border border-slate-850 p-6 rounded-2xl flex flex-col justify-between hover:border-brand-accent/50 hover:bg-slate-900/60 transition-all hover:translate-y-[-2px]"
            >
              <div>
                <ServiceBadge category={cat.slug} />
                <h4 className="text-base font-bold text-text-primary mt-4 mb-1">{cat.name}</h4>
              </div>
              <span className="text-xs text-text-muted block mt-4 font-technical">{cat.count} &rarr;</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 6. CALL TO ACTION SECTION */}
      <section className="relative z-10 bg-slate-900/20 border-t border-slate-900 py-24 text-center">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 space-y-6">
          <h2 className="text-3xl sm:text-4xl font-bold font-display text-text-primary">
            Ready to Accelerate Your Procurement?
          </h2>
          <p className="text-sm text-text-secondary max-w-lg mx-auto">
            Create your account today, verify your organization profile, and connect with top-rated partners.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
            <Link
              href={`/${locale}/sign-up`}
              className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold rounded-xl transition-transform hover:-translate-y-0.5 shadow-lg shadow-cyan-500/25"
            >
              Get Started Now
            </Link>
            <Link
              href={`/${locale}/sign-in`}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-text-primary font-semibold rounded-xl transition-all"
            >
              Sign In to Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
