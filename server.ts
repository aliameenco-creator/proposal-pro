import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API routes
  app.post("/api/generate", async (req, res) => {
    try {
      const { clientName, projectDetails, brandKit } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        Generate a highly concise, professional business proposal for client: ${clientName}.
        Project Details: ${projectDetails}
        
        CRITICAL INSTRUCTIONS:
        1. Focus strictly on deliverables, value proposition, and clear outcomes. Be to-the-point.
        2. Format the output in clean semantic HTML suitable for a rich text editor. Do NOT use inline CSS for text elements. Rely on semantic HTML tags like <h1>, <h2>, <h3>, <h4>, <p>, <strong>, <em>, <ul>, <li>.
        3. Include sections: Executive Summary, Scope of Work, Deliverables, Timeline, Pricing, and Terms. Use headings for sections.
        4. Use bullet points and bold text for readability. Emphasize key outcomes.
        5. MUST INCLUDE VISUALS: Inject clean, modern inline SVG diagrams (e.g., a timeline, process flow, or architecture diagram) to make it visually appealing.
           - CRITICAL: Every <svg> tag MUST include xmlns="http://www.w3.org/2000/svg", a valid viewBox, AND explicit width and height attributes (e.g., width="100%" height="300").
           - CRITICAL: Do NOT use CSS classes or currentColor. Use explicit hex codes for fill and stroke (e.g., fill="${brandKit.primary}").
           - Make the SVGs responsive.
           - SVG Colors to use: Primary ${brandKit.primary}, Secondary ${brandKit.secondary}, Accent ${brandKit.accent}, Background ${brandKit.background}.
        6. PRICING SECTION: Make the Pricing section highly prominent and visually highlighted. Use a semantic HTML <table> or a styled <div> using inline CSS with the brand colors to create a "Pricing Card" effect. Ensure the total price is large and bold.
        7. Do NOT wrap the output in markdown code blocks, just return raw HTML.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error(error);
      const isInvalidKey = error.message?.includes('API key not valid');
      res.status(500).json({ error: isInvalidKey ? "Invalid Gemini API key. Please check your AI Studio Settings." : (error.message || "Failed to generate content") });
    }
  });

  app.post("/api/edit-diagram", async (req, res) => {
    try {
      const { decodedSvg, diagramPrompt, brandKit } = req.body;
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const prompt = `
        You are an expert SVG designer. 
        Here is an existing SVG diagram:
        ${decodedSvg}
        
        The user wants to make the following changes:
        "${diagramPrompt}"
        
        CRITICAL INSTRUCTIONS:
        1. Return ONLY the raw updated <svg> code. Do not include any markdown formatting or explanations.
        2. Ensure the <svg> tag includes xmlns="http://www.w3.org/2000/svg", a viewBox, and explicit width/height.
        3. Use explicit hex colors matching the brand: Primary ${brandKit.primary}, Secondary ${brandKit.secondary}, Accent ${brandKit.accent}.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error(error);
      const isInvalidKey = error.message?.includes('API key not valid');
      res.status(500).json({ error: isInvalidKey ? "Invalid Gemini API key. Please check your AI Studio Settings." : (error.message || "Failed to edit diagram") });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
