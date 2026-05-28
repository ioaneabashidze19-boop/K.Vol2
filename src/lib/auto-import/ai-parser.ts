import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ExtractedService {
  name: string;
  description: string;
  format: string; // "project", "hourly", "retainer"
  price: number;
  tech: string[];
}

export interface ExtractedCaseStudy {
  title: string;
  description: string;
  industry: string;
  clientSize?: string;
}

export interface ExtractedTeamMember {
  name: string;
  role: string;
  experience?: string;
}

export interface ProviderProfile {
  name: string;
  foundedYear?: number;
  description: string;
  employeeCount?: number;
  location: string;
  services: ExtractedService[];
  techStack: string[];
  targetClientIndustries: string[];
  targetClientCompanySizes: string[];
  pricingNotes?: string;
  caseStudies: ExtractedCaseStudy[];
  team: ExtractedTeamMember[];
  certifications: string[];
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
}

export class AIProfileParser {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || "dummy_api_key";
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries <= 0) throw error;
      console.warn(`[AIProfileParser] API invocation failed. Retrying in ${delay}ms...`, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.retryWithBackoff(fn, retries - 1, delay * 2);
    }
  }

  async parseProviderProfile(html: string, cleanText: string): Promise<ProviderProfile> {
    console.log("[AIProfileParser] Submitting profile extraction task to Gemini 2.0 Flash...");

    const prompt = `You are a professional B2B procurement analyst assistant.
Analyze the following HTML and clean extracted text of a service provider's website.
Extract the company details and return a structured JSON response matching the following TypeScript interface:

interface ProviderProfile {
  name: string;
  foundedYear?: number; // integer
  description: string; // 2-3 sentences summarizing the agency
  employeeCount?: number; // integer
  location: string; // main headquarters location
  services: Array<{
    name: string;
    description: string;
    format: string; // "project", "hourly", or "retainer"
    price: number; // estimated starting price, default to 0 if not found
    tech: string[]; // technology stack terms relevant to this service
  }>;
  techStack: string[]; // array of overall tools, platforms, frameworks
  targetClientIndustries: string[]; // list of target client industries (e.g. Fintech, Retail, SaaS)
  targetClientCompanySizes: string[]; // list of target client company sizes (e.g. Startup, SMB, Enterprise)
  pricingNotes?: string;
  caseStudies: Array<{
    title: string;
    description: string;
    industry: string;
    clientSize?: string;
  }>;
  team: Array<{
    name: string;
    role: string;
    experience?: string;
  }>;
  certifications: string[]; // list of certifications, vetting details, awards
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  socialLinks: {
    linkedin?: string;
    twitter?: string;
    github?: string;
  };
}

Only return a valid JSON object matching this schema.

HTML CONTENT:
${html.slice(0, 30000)}

TEXT CONTENT:
${cleanText.slice(0, 15000)}
`;

    const apiCall = async () => {
      // Use gemini-2.0-flash with JSON mode output
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (!text) {
        throw new Error("Empty response received from Gemini API");
      }

      // Log token usage if returned by SDK API metadata
      if (response.usageMetadata) {
        console.log(
          `[AIProfileParser] Tokens Used - Prompt: ${response.usageMetadata.promptTokenCount}, Completion: ${response.usageMetadata.candidatesTokenCount}`
        );
      }

      const parsed: ProviderProfile = JSON.parse(text);
      return parsed;
    };

    try {
      return await this.retryWithBackoff(apiCall);
    } catch (err: any) {
      console.error("[AIProfileParser] Critical failure parsing provider profile:", err.message);
      // Fallback return dummy struct with parsed names if JSON extraction crashes
      return {
        name: "Unknown Provider (AI Extraction Failed)",
        description: "We were unable to parse provider details automatically.",
        location: "Unknown Location",
        services: [],
        techStack: [],
        targetClientIndustries: [],
        targetClientCompanySizes: [],
        caseStudies: [],
        team: [],
        certifications: [],
        socialLinks: {},
      };
    }
  }
}
