import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const research = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/research" }),
  schema: z.object({
    title: z.string().min(8).max(120),
    description: z.string().min(20).max(240),
    question: z.string().min(20).max(220),
    disposition: z.string().min(4).max(100),
    scope: z.string().min(10).max(160),
    takeaway: z.string().min(20).max(220),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    status: z.enum(["concept", "ongoing", "exploratory", "completed", "post-study-evidence"]),
    study: z.string().min(2).max(80),
    version: z.string().min(1).max(40),
    demo: z.boolean(),
    visual: z.enum(["authority-field", "theater-map", "none"]),
    route: z.string().startsWith("/").optional(),
    featured: z.boolean().default(false),
    readingMinutes: z.number().int().positive().max(120)
  })
});

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string().min(3).max(120),
    description: z.string().min(20).max(240),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    status: z.enum(["ongoing", "completed", "archived"]),
    category: z.string().min(2).max(80),
    github: z.url().optional(),
    route: z.string().startsWith("/").optional(),
    visual: z.enum(["station562-pcb", "none"]).default("none"),
    featured: z.boolean().default(false),
    readingMinutes: z.number().int().positive().max(120)
  })
});

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string().min(3).max(120),
    description: z.string().min(20).max(240),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    tags: z.array(z.string().min(1).max(40)).max(8).default([]),
    readingMinutes: z.number().int().positive().max(120),
    draft: z.boolean().default(false)
  })
});

const daa = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/daa" }),
  schema: z.object({
    title: z.string().min(3).max(120),
    kind: z.enum(["article", "references"])
  })
});

export const collections = { research, projects, blog, daa };
