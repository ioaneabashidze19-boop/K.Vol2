"use client";

import {
  MapPin,
  Users,
  Calendar,
  Share2,
  Award,
  ShieldCheck,
  Star,
  Mail,
  CheckCircle,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { use, useState, useEffect } from "react";

import RatingDisplay from "@/components/marketplace/RatingDisplay";
import { supabase } from "@/lib/supabaseClient";

// Premium detailed mock data matching the pre-seeded cards
const mockProfiles: Record<
  string,
  {
    name: string;
    description: string;
    mission: string;
    category: string;
    rating: number;
    foundedYear: number;
    employeeCount: number;
    location: string;
    email: string;
    website: string;
    services: Array<{
      name: string;
      desc: string;
      format: string;
      price: number;
      tech: string[];
    }>;
    caseStudies: Array<{
      title: string;
      industry: string;
      desc: string;
    }>;
    team: Array<{ name: string; role: string }>;
    certifications: Array<{ name: string; date: string }>;
    reviews: Array<{
      client: string;
      rating: number;
      text: string;
      date: string;
    }>;
  }
> = {
  "provider-1": {
    name: "Apex Software Labs",
    description: "Apex Software Labs is a premium B2B SaaS engineering vendor specializing in high-throughput applications, API gateway structures, and database migrations.",
    mission: "To architect ultra-reliable products that enable businesses to scale without bottlenecks.",
    category: "saas",
    rating: 4.8,
    foundedYear: 2018,
    employeeCount: 45,
    location: "Tbilisi, Georgia",
    email: "partner@apexlabs.ge",
    website: "https://apexlabs.ge",
    services: [
      {
        name: "Enterprise Multi-Tenant SaaS MVP",
        desc: "End-to-end design, database schema optimization, and deployment of cloud-native multi-tenant dashboards.",
        format: "project",
        price: 15000,
        tech: ["React", "Node.js", "PostgreSQL", "Tailwind CSS"],
      },
      {
        name: "GraphQL Gateways & API Tuning",
        desc: "Resolving performance latency issues and designing secure RESTful/GraphQL interfaces.",
        format: "hourly",
        price: 90,
        tech: ["GraphQL", "NestJS", "Redis", "TypeScript"],
      },
    ],
    caseStudies: [
      {
        title: "Scaling LineTech CRM Systems",
        industry: "Real Estate Tech",
        desc: "Migrated a legacy database pipeline to serverless architecture, improving request latency by 60%.",
      },
    ],
    team: [
      { name: "George Kobakhidze", role: "Chief Architect" },
      { name: "Anna Tsintsadze", role: "Lead Frontend Engineer" },
    ],
    certifications: [
      { name: "AWS Certified Advanced Networking", date: "2024" },
      { name: "ISO 27001 Security Standard Compliant", date: "2025" },
    ],
    reviews: [
      {
        client: "LineTech Corporation",
        rating: 5,
        text: "Exceptional engineering capability. Apex Software Labs migrated our legacy workflows without any downtime.",
        date: "2026-04-12",
      },
      {
        client: "Fintech Grid LLC",
        rating: 4.6,
        text: "Competent team. They delivered our compliance API sandbox ahead of schedule. Highly recommended.",
        date: "2026-05-01",
      },
    ],
  },
  "provider-2": {
    name: "PixelCraft Studios",
    description: "PixelCraft Studios is an award-winning creative digital agency designing high-end interactive interfaces and brand systems.",
    mission: "We build digital art systems that leave a lasting impressions on users.",
    category: "design",
    rating: 4.9,
    foundedYear: 2020,
    employeeCount: 15,
    location: "Batumi, Georgia",
    email: "hello@pixelcraft.studio",
    website: "https://pixelcraft.studio",
    services: [
      {
        name: "Premium Landing Page & Branding Layout",
        desc: "Custom graphical styles, layout schemes, typography configurations, and interactive prototypes.",
        format: "project",
        price: 4500,
        tech: ["Figma", "Framer Motion", "Tailwind CSS"],
      },
    ],
    caseStudies: [
      {
        title: "Rebranding Candy Nuts Platform",
        industry: "Retail & Commerce",
        desc: "Crafted a minimalist visual design system that increased user interactions and conversion metrics by 40%.",
      },
    ],
    team: [
      { name: "Sandro Lomidze", role: "Creative Director" },
      { name: "Mariam Kapanadze", role: "Senior UI/UX Specialist" },
    ],
    certifications: [
      { name: "Figma Certified Product Partner", date: "2025" },
    ],
    reviews: [
      {
        client: "Candy Nuts brand",
        rating: 5,
        text: "PixelCraft Studios designed our online store. Aesthetics are absolutely premium. 5 stars!",
        date: "2026-05-20",
      },
    ],
  },
};

interface ProviderDetailPageProps {
  params: Promise<{
    id: string;
    locale: string;
  }>;
}

export default function ProviderDetailPage({ params }: ProviderDetailPageProps) {
  const resolvedParams = use(params);
  const providerId = resolvedParams.id;
  const currentLocale = resolvedParams.locale;

  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);

  // Dynamic fetch with fallback mock
  const fetchProviderDetail = async () => {
    setLoading(true);
    try {
      // 1. Fetch company by ID
      const { data: company, error: compError } = await supabase
        .from("companies")
        .select("id, name, description, logo_url, location, founded_year, employee_count, website, status")
        .eq("id", providerId)
        .single();

      if (compError) throw compError;

      // 2. Fetch services
      const { data: services, error: servError } = await supabase
        .from("services")
        .select("name, description, starting_price, delivery_format, tech_stack")
        .eq("company_id", providerId);

      if (servError) throw servError;

      // 3. Fetch reviews
      const { data: reviews, error: revError } = await supabase
        .from("reviews")
        .select("rating, comment, created_at, reviewer_id, engagements (seeker_id, seekers (company_name))")
        .eq("engagements.company_id", providerId);

      if (revError) throw revError;

      const formattedReviews = reviews?.map((r: any) => ({
        client: r.engagements?.seekers?.company_name || "Verified Client",
        rating: r.rating,
        text: r.comment || "",
        date: r.created_at ? new Date(r.created_at).toISOString().split("T")[0] : "2026-05-28",
      })) || [];

      const avgRating =
        formattedReviews.length > 0
          ? Number((formattedReviews.reduce((sum, r) => sum + r.rating, 0) / formattedReviews.length).toFixed(1))
          : 5.0;

      const formattedServices = services?.map((s) => ({
        name: s.name,
        desc: s.description || "No description provided.",
        format: s.delivery_format || "custom",
        price: Number(s.starting_price),
        tech: s.tech_stack || [],
      })) || [];

      const finalProfile = {
        name: company.name,
        description: company.description || "",
        mission: "Delivering top-tier custom integration service agreements.",
        category: formattedServices[0]?.format || "saas",
        rating: avgRating,
        foundedYear: company.founded_year || 2021,
        employeeCount: company.employee_count || 10,
        location: company.location || "Tbilisi, Georgia",
        email: "contact@" + company.name.toLowerCase().replace(/[^a-z]/g, "") + ".com",
        website: company.website || "",
        services: formattedServices,
        caseStudies: [
          {
            title: "Platform Automation Integration",
            industry: "B2B Technology",
            desc: "Designed customized dashboard metrics panel syncing billing audit log items.",
          },
        ],
        team: [{ name: "Lead Partner", role: "Technical Delivery" }],
        certifications: [{ name: "Verified B2B Vendor Partner", date: "2026" }],
        reviews: formattedReviews,
      };

      setProfile(finalProfile);
    } catch (err) {
      // Fallback on missing DB record or connection failure
      const fallback = mockProfiles[providerId] || mockProfiles["provider-1"];
      setProfile(fallback);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderDetail();
  }, [providerId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-32 bg-slate-950 text-slate-100 animate-pulse">
        <div className="h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-4" />
        <span className="text-xs text-text-muted">Resolving Provider profile...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex flex-col justify-center items-center py-32 bg-slate-950 text-slate-100 text-center">
        <span className="text-4xl mb-4">⚠️</span>
        <h2 className="text-xl font-bold">Profile Not Found</h2>
        <p className="text-xs text-text-muted mt-1">We couldn't resolve details for this specific provider ID.</p>
        <Link href={`/${currentLocale}/marketplace`} className="mt-6 text-xs text-cyan-400 font-bold">&larr; Back to Directory</Link>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 pb-24">
      {/* 1. HEADER SECTION */}
      <div className="relative border-b border-slate-900 bg-slate-900/10 py-12 px-6 sm:px-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-6 relative z-10">
          <Link
            href={`/${currentLocale}/marketplace`}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-cyan-400 transition w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Directory
          </Link>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mt-2">
            <div className="flex items-center gap-4">
              <span className="text-4xl bg-slate-900 border border-slate-800 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg font-bold text-cyan-400">
                {profile.name[0]}
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">{profile.name}</h1>
                  <span className="bg-emerald-950 border border-emerald-500/35 text-[10px] font-bold text-brand-success px-2 py-0.5 rounded">
                    Active
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-secondary mt-1.5">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-text-muted" /> {profile.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-text-muted" /> {profile.employeeCount} Employees
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5 text-text-muted" /> Est. {profile.foundedYear}
                  </div>
                </div>
              </div>
            </div>

            {/* Rating summary & Social Share */}
            <div className="flex flex-wrap items-center gap-4 self-stretch md:self-auto justify-between border-t border-slate-900 pt-4 md:border-none md:pt-0">
              <div className="text-left md:text-right">
                <div className="flex items-center md:justify-end gap-1.5">
                  <RatingDisplay rating={profile.rating} count={profile.reviews.length} size="sm" />
                </div>
                <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider block mt-1">
                  Verified Vendor Scale
                </span>
              </div>

              {/* Share triggers */}
              <div className="relative">
                <button
                  onClick={() => setShareOpen(!shareOpen)}
                  className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-850 rounded-xl transition text-text-secondary"
                  title="Share profile"
                >
                  <Share2 className="h-4 w-4" />
                </button>
                {shareOpen && (
                  <div className="absolute right-0 mt-2 bg-slate-900 border border-slate-800 rounded-xl p-2 flex flex-col gap-1 shadow-2xl z-20 w-32">
                    <a
                      href="https://linkedin.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-text-secondary hover:text-cyan-400 p-2 rounded hover:bg-slate-950"
                    >
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg> LinkedIn
                    </a>
                    <a
                      href="https://twitter.com"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 text-xs text-text-secondary hover:text-cyan-400 p-2 rounded hover:bg-slate-950"
                    >
                      <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg> Twitter
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BODY CONTENT LAYOUT */}
      <div className="max-w-6xl mx-auto px-6 mt-12 grid lg:grid-cols-3 gap-12">
        {/* Left Column (About, Services, Testimonials) */}
        <div className="lg:col-span-2 space-y-12">
          {/* About Section */}
          <section className="space-y-4">
            <h2 className="text-lg font-bold text-text-primary border-b border-slate-900 pb-2">About Agency</h2>
            <p className="text-sm text-text-secondary leading-relaxed">{profile.description}</p>
            <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl">
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider">Mission Statement</span>
              <p className="text-xs text-text-secondary italic mt-1 leading-normal">&ldquo;{profile.mission}&rdquo;</p>
            </div>
          </section>

          {/* Services Section */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-text-primary border-b border-slate-900 pb-2">Service Catalog</h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {profile.services.map((serv: any, idx: number) => (
                <div key={idx} className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded capitalize">
                      {serv.format} format
                    </span>
                    <h3 className="text-sm font-bold text-text-primary mt-3 mb-1.5">{serv.name}</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{serv.desc}</p>
                  </div>
                  <div className="mt-6 pt-4 border-t border-slate-850/40 flex items-center justify-between">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-text-muted tracking-wider block">Est. Starting Price</span>
                      <span className="text-sm font-extrabold text-cyan-400">${serv.price.toLocaleString()}{serv.format === "hourly" && "/hr"}</span>
                    </div>
                    <div className="flex gap-1">
                      {serv.tech.slice(0, 2).map((t: string) => (
                        <span key={t} className="bg-slate-950 text-[9px] font-bold text-text-muted px-1.5 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Case Studies */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-text-primary border-b border-slate-900 pb-2">Case Studies</h2>
            <div className="space-y-4">
              {profile.caseStudies.map((caseStudy: any, idx: number) => (
                <div key={idx} className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl flex flex-col md:flex-row justify-between gap-4">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold text-cyan-400 font-technical">{caseStudy.industry}</span>
                    <h3 className="text-sm font-bold text-text-primary">{caseStudy.title}</h3>
                    <p className="text-xs text-text-secondary leading-relaxed">{caseStudy.desc}</p>
                  </div>
                  <button className="flex items-center gap-1 text-xs font-semibold text-brand-accent hover:text-cyan-300 self-end md:self-center">
                    Read Report <CheckCircle className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Testimonials and Reviews */}
          <section className="space-y-6">
            <h2 className="text-lg font-bold text-text-primary border-b border-slate-900 pb-2">Client Reviews</h2>
            {profile.reviews.length === 0 ? (
              <div className="text-center py-10 bg-slate-900/20 border border-dashed border-slate-850 rounded-2xl">
                <p className="text-xs text-text-muted">No client reviews submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {profile.reviews.map((rev: any, idx: number) => (
                  <div key={idx} className="bg-slate-900/30 border border-slate-850 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-xs font-bold text-text-primary">{rev.client}</h4>
                        <span className="text-[10px] text-text-muted">{rev.date}</span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-400 text-xs">
                        {Array.from({ length: Math.round(rev.rating) }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-yellow-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed italic">&ldquo;{rev.text}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column (CTA, Team, Certifications) */}
        <div className="space-y-8">
          {/* Booking CTA Panel */}
          <div className="bg-gradient-to-br from-cyan-950/20 to-slate-900/40 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest block font-technical">Onboarding Request</span>
              <h3 className="text-base font-bold text-text-primary mt-1">Hire {profile.name}</h3>
              <p className="text-xs text-text-secondary mt-1 leading-normal">
                Submit your procurement specs to request direct contact with this partner.
              </p>
            </div>

            <div className="space-y-3">
              <a
                href={`mailto:${profile.email}`}
                className="w-full bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:from-cyan-400 hover:to-emerald-400 transition"
              >
                <Mail className="h-4 w-4" /> Request Services
              </a>
              <button className="w-full bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-text-primary py-3 rounded-xl flex items-center justify-center gap-2 transition">
                <MessageSquare className="h-4 w-4 text-text-muted" /> Send Message
              </button>
            </div>

            {/* Discount info */}
            <div className="border-t border-slate-850/60 pt-4 text-center">
              <span className="text-[10px] text-text-muted">KavShare Platform Code</span>
              <div className="bg-slate-950 border border-slate-850 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-cyan-400 mt-1 select-all cursor-pointer">
                KAVSHARE-VNDR-10
              </div>
              <span className="text-[9px] text-brand-success font-medium mt-1.5 block">10% Platform Commission Discount Applied</span>
            </div>
          </div>

          {/* Team Members */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-400" /> Key Personnel
            </h3>
            <div className="flex flex-col gap-3">
              {profile.team.map((member: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl">
                  <div className="h-8 w-8 bg-slate-800 rounded-full flex items-center justify-center font-bold text-[10px] text-cyan-400 uppercase">
                    {member.name[0]}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-text-primary">{member.name}</h4>
                    <p className="text-[10px] text-text-muted">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Certifications and Compliance */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-cyan-400" /> Vetting & Badges
            </h3>
            <div className="flex flex-col gap-3">
              {profile.certifications.map((cert: any, idx: number) => (
                <div key={idx} className="flex gap-2.5 items-start">
                  <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-text-primary leading-tight">{cert.name}</h4>
                    <span className="text-[9px] text-text-muted block mt-0.5">Verified in {cert.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
