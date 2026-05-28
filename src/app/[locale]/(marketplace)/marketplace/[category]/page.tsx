"use client";

import { ChevronDown, ArrowLeft, ExternalLink, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { use, useState, useEffect } from "react";

import ProviderCard from "@/components/marketplace/ProviderCard";
import { supabase } from "@/lib/supabaseClient";

// Category data mapping
const categoryDetails: Record<
  string,
  {
    name: string;
    description: string;
    icon: string;
    heroGradient: string;
    faqs: Array<{ question: string; answer: string }>;
    related: Array<{ name: string; slug: string }>;
  }
> = {
  saas: {
    name: "SaaS Development",
    description: "Connect with elite development agencies building scalable, multi-tenant software platforms, API integrations, and robust web applications.",
    icon: "🛠️",
    heroGradient: "from-cyan-600/20 via-blue-900/10 to-transparent",
    faqs: [
      {
        question: "What is the typical starting budget for a SaaS MVP?",
        answer: "MVP development usually begins around $5,000 for standard feature scopes, scaling upwards depending on multi-tenant complexity and third-party API requirements.",
      },
      {
        question: "How do you verify the technical capabilities of SaaS providers?",
        answer: "Every listed provider is vetted through reference checks of past deployments, code quality auditing guidelines, and active platform feedback loops.",
      },
      {
        question: "Do these agencies offer post-launch SLA maintenance contracts?",
        answer: "Yes, most providers offer retainer agreements covering uptime monitoring, server optimization, and incremental feature updates.",
      },
    ],
    related: [
      { name: "Cloud Infrastructure", slug: "cloud" },
      { name: "Data & Telemetry", slug: "data" },
    ],
  },
  design: {
    name: "UI/UX & Branding Design",
    description: "Partner with creative design agencies creating high-fidelity digital products, landing pages, interactive prototypes, and cohesive brand systems.",
    icon: "🎨",
    heroGradient: "from-purple-600/20 via-pink-900/10 to-transparent",
    faqs: [
      {
        question: "What design tools do providers typically use?",
        answer: "Our agencies primarily design inside Figma, enabling real-time collaboration, interactive prototyping, and developer handoff assets.",
      },
      {
        question: "What is included in a complete branding package?",
        answer: "A standard brand package includes logo design variants, typography scales, style guidelines, and responsive CSS component styles.",
      },
    ],
    related: [
      { name: "SaaS Development", slug: "saas" },
    ],
  },
  cloud: {
    name: "Cloud Infrastructure & DevOps",
    description: "Vetted systems architects specializing in serverless backends, automated CI/CD pipelines, Kubernetes, and secure multi-cloud environments.",
    icon: "☁️",
    heroGradient: "from-emerald-600/20 via-teal-900/10 to-transparent",
    faqs: [
      {
        question: "Which cloud providers do these agencies specialize in?",
        answer: "Most listed engineers are certified in AWS, Google Cloud Platform (GCP), and Microsoft Azure environments.",
      },
      {
        question: "Do providers set up automated deployment infrastructure?",
        answer: "Yes, providers utilize IaC tools (like Terraform) and CI/CD pipelines (GitHub Actions, GitLab CI) to automate staging and production rollouts.",
      },
    ],
    related: [
      { name: "SaaS Development", slug: "saas" },
      { name: "Data & Telemetry", slug: "data" },
    ],
  },
  data: {
    name: "Data Analytics & Telemetry",
    description: "Data experts capable of structuring clickstream events tracking, audit log streaming, and click attribution analytics databases.",
    icon: "📊",
    heroGradient: "from-amber-600/20 via-orange-950/10 to-transparent",
    faqs: [
      {
        question: "How is telemetry logging data stored?",
        answer: "We support specialized telemetry schemas using high-performance relational databases (like PostgreSQL) or analytical columnar storages (like ClickHouse).",
      },
      {
        question: "Can these systems handle high real-time throughput?",
        answer: "Yes, agencies build microservices leveraging distributed streaming queues (like Kafka or RabbitMQ) to guarantee zero packet losses under peak volumes.",
      },
    ],
    related: [
      { name: "Cloud Infrastructure", slug: "cloud" },
    ],
  },
};

// Fallback providers list for unseeded DBs
const mockProviders = [
  {
    id: "provider-1",
    name: "Apex Software Labs",
    description: "Specialized in high-throughput enterprise SaaS development and robust cloud integrations.",
    category: "saas",
    rating: 4.8,
    reviewCount: 34,
    minPrice: 5000,
    maxPrice: 25000,
    techStack: ["React", "Node.js", "GraphQL", "AWS"],
    available: true,
  },
  {
    id: "provider-2",
    name: "PixelCraft Studios",
    description: "Award-winning UI/UX design agency focused on crafting modern digital products and landing pages.",
    category: "design",
    rating: 4.9,
    reviewCount: 28,
    minPrice: 3000,
    maxPrice: 12000,
    techStack: ["Figma", "Tailwind CSS", "Next.js", "Framer Motion"],
    available: true,
  },
  {
    id: "provider-3",
    name: "Nimbus Architects",
    description: "Architecting serverless backend databases and Kubernetes orchestration layouts.",
    category: "cloud",
    rating: 4.7,
    reviewCount: 19,
    minPrice: 8000,
    maxPrice: 45000,
    techStack: ["Kubernetes", "Docker", "Terraform", "Go"],
    available: false,
  },
  {
    id: "provider-4",
    name: "Vortex Data Analytics",
    description: "Extracting complex data intelligence streams and setting up telemetry pipelines.",
    category: "data",
    rating: 4.6,
    reviewCount: 22,
    minPrice: 6000,
    maxPrice: 30000,
    techStack: ["Python", "Apache Kafka", "PostgreSQL", "ClickHouse"],
    available: true,
  },
];

interface CategoryPageProps {
  params: Promise<{
    category: string;
    locale: string;
  }>;
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const resolvedParams = use(params);
  const currentCategory = resolvedParams.category;
  const currentLocale = resolvedParams.locale;

  const details = categoryDetails[currentCategory] || categoryDetails.saas;

  const [providers, setProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Fetch Supabase data for the category
  const loadCategoryData = async () => {
    setLoading(true);
    try {
      const { data: dbCompanies, error: compError } = await supabase
        .from("companies")
        .select("id, name, description, logo_url, location, status");

      if (compError) throw compError;

      const { data: dbServices, error: servError } = await supabase
        .from("services")
        .select("company_id, category, starting_price, tech_stack")
        .eq("category", currentCategory);

      if (servError) throw servError;

      const { data: dbReviews, error: revError } = await supabase
        .from("reviews")
        .select("rating, engagement_id, engagements (company_id)");

      if (revError) throw revError;

      // Filter companies that have services in this category
      const matchedCompanies = dbCompanies?.filter((company) =>
        dbServices?.some((s) => s.company_id === company.id)
      ) || [];

      if (matchedCompanies.length === 0) {
        // Fallback to local mock data matching category
        const filteredMock = mockProviders.filter((p) => p.category === currentCategory);
        setProviders(filteredMock);
        setLoading(false);
        return;
      }

      const mapped = matchedCompanies.map((company) => {
        const companyServices = dbServices?.filter((s) => s.company_id === company.id) || [];
        const companyReviews = dbReviews?.filter((r: any) => r.engagements?.company_id === company.id) || [];

        const avgRating =
          companyReviews.length > 0
            ? Number((companyReviews.reduce((sum, r) => sum + r.rating, 0) / companyReviews.length).toFixed(1))
            : 5.0;

        const minPrice = companyServices.length > 0 ? Math.min(...companyServices.map((s) => Number(s.starting_price))) : 1500;
        const maxPrice = companyServices.length > 0 ? Math.max(...companyServices.map((s) => Number(s.starting_price))) * 3 : 10000;
        const techStack = Array.from(new Set(companyServices.flatMap((s) => s.tech_stack || [])));

        return {
          id: company.id,
          name: company.name,
          description: company.description || "No description provided.",
          category: currentCategory,
          rating: avgRating,
          reviewCount: companyReviews.length,
          minPrice,
          maxPrice,
          techStack: techStack.length > 0 ? techStack : ["Technical Consultant", "DevOps Engineer"],
          available: company.status === "active",
        };
      });

      setProviders(mapped);
    } catch (err) {
      // Fallback on DB query errors
      const filteredMock = mockProviders.filter((p) => p.category === currentCategory);
      setProviders(filteredMock);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategoryData();
  }, [currentCategory]);

  return (
    <div className="flex-1 flex flex-col bg-slate-950 pb-20">
      {/* Category Hero Block */}
      <div className={`relative bg-gradient-to-b ${details.heroGradient} border-b border-slate-900 py-16 px-6 sm:px-12`}>
        <div className="max-w-5xl mx-auto flex flex-col gap-4 relative z-10">
          <Link
            href={`/${currentLocale}/marketplace`}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-cyan-400 transition w-fit"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Directory
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-3xl bg-slate-900 w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-800 shadow-md">
              {details.icon}
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">{details.name}</h1>
              <p className="text-xs text-text-muted mt-0.5 font-technical uppercase tracking-widest text-cyan-400">
                Category Vertical Profile
              </p>
            </div>
          </div>
          <p className="text-sm sm:text-base text-text-secondary max-w-3xl leading-relaxed mt-2">
            {details.description}
          </p>
        </div>
      </div>

      {/* Main Grid content */}
      <div className="max-w-5xl mx-auto w-full px-6 mt-12 grid lg:grid-cols-3 gap-12">
        {/* Providers List (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-lg font-bold text-text-primary border-b border-slate-900 pb-3 flex items-center justify-between">
            <span>Verified Specialists</span>
            <span className="text-xs bg-slate-900 border border-slate-800 text-text-secondary px-2.5 py-0.5 rounded-full font-technical">
              {providers.length} Available
            </span>
          </h2>

          {loading ? (
            <div className="space-y-6">
              {[1, 2].map((i) => (
                <div key={i} className="bg-slate-900/30 border border-slate-850 h-44 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/20 border border-slate-850 border-dashed rounded-2xl p-8">
              <span className="text-3xl">📭</span>
              <h4 className="text-sm font-bold text-text-primary mt-3">No Providers in this Category</h4>
              <p className="text-xs text-text-muted mt-1">Be the first company to post services under this vertical!</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-6">
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  description={p.description}
                  category={p.category}
                  rating={p.rating}
                  reviewCount={p.reviewCount}
                  minPrice={p.minPrice}
                  maxPrice={p.maxPrice}
                  techStack={p.techStack}
                />
              ))}
            </div>
          )}

          {/* 3. CATEGORY FAQ SECTION */}
          <div className="pt-8 border-t border-slate-900">
            <h3 className="text-base font-bold text-text-primary mb-6 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-400" /> Frequently Asked Questions
            </h3>
            <div className="space-y-3">
              {details.faqs.map((faq, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/40 border border-slate-850 rounded-xl overflow-hidden transition-all"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between p-4 text-left text-xs font-bold text-text-primary hover:bg-slate-900/80"
                  >
                    <span>{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-text-muted transition-transform duration-200 ${
                        openFaq === idx ? "transform rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <div className="px-4 pb-4 text-xs text-text-secondary leading-relaxed border-t border-slate-850/30 pt-3">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Info (Right 1 column) */}
        <div className="space-y-8 h-fit">
          {/* Related Categories */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 backdrop-blur-md">
            <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4 text-cyan-400" /> Related Verticals
            </h3>
            <div className="flex flex-col gap-2">
              {details.related.map((rel) => (
                <Link
                  key={rel.slug}
                  href={`/${currentLocale}/marketplace/${rel.slug}`}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-850 p-3.5 rounded-xl flex items-center justify-between text-xs text-text-secondary hover:text-cyan-400 transition"
                >
                  <span>{rel.name}</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              ))}
            </div>
          </div>

          {/* Quick SLA checklist */}
          <div className="bg-gradient-to-br from-cyan-950/20 to-slate-900/40 border border-slate-850 rounded-2xl p-5">
            <h4 className="text-xs font-bold text-text-primary mb-3">Procurement Safety Rules</h4>
            <ul className="text-[11px] text-text-secondary space-y-2.5 leading-normal">
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">✓</span>
                All payments are held in secure escrow.
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">✓</span>
                SLA contracts define clear monthly retainers.
              </li>
              <li className="flex gap-2">
                <span className="text-cyan-400 font-bold">✓</span>
                Audit logs capture all milestone completions.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
