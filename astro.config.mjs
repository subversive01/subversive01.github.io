import { defineConfig } from "astro/config";
import daaCitationLinks from "./src/lib/daa-citation-links.mjs";

const daaCitationIntegration = {
  name: "sbhc:daa-citation-links",
  hooks: {
    "astro:config:setup"({ config }) {
      const processor = config.markdown.processor;
      if (processor.name !== "satteri" || !Array.isArray(processor.options.mdastPlugins)) {
        throw new Error("DAA citation links require Astro's Satteri Markdown processor");
      }
      processor.options.mdastPlugins.push(daaCitationLinks);
    }
  }
};

export default defineConfig({
  site: "https://sbhcsecurity.com",
  output: "static",
  integrations: [daaCitationIntegration],
  build: {
    inlineStylesheets: "never"
  },
  vite: {
    build: {
      assetsInlineLimit: 0,
      sourcemap: false
    }
  }
});
