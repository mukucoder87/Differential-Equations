import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // Initialize Gemini only when needed to avoid startup crash if key missing
  let aiClient: GoogleGenAI | null = null;
  function getAI() {
    if (!aiClient) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("GEMINI_API_KEY environment variable is required");
      aiClient = new GoogleGenAI({ apiKey: key });
    }
    return aiClient;
  }

  // API Routes
  app.post('/api/parse', async (req, res) => {
    try {
      const ai = getAI();
      const { equationInput } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the following differential equation: ${equationInput}. 
        Return a JSON object with:
        - latex: The equation in LaTeX format (e.g., "\\frac{d^2y}{dt^2} + y = 0").
        - allSymbols: Array of ALL unique variable and constant letters/symbols found in the equation (e.g., ["x", "y", "t", "a", "k"]).
        - order: The order of the equation (integer).
        - degree: The degree of the equation (integer).
        - linearity: "Linear" or "Non-linear".`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              latex: { type: Type.STRING },
              allSymbols: { type: Type.ARRAY, items: { type: Type.STRING } },
              order: { type: Type.INTEGER },
              degree: { type: Type.INTEGER },
              linearity: { type: Type.STRING },
            },
            required: ['latex', 'allSymbols', 'order', 'degree', 'linearity'],
          },
        },
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const ai = getAI();
      const { parsedEq, depVar, intermediateVars, selectedConstants } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: `Given the differential equation in LaTeX: ${parsedEq.latex}, where 't' is the independent variable (time), ${depVar} is the dependent variable.
        The following variables depend on 't' and influence ${depVar}: ${intermediateVars.length > 0 ? intermediateVars.join(', ') : 'None'}.
        The following are strictly constants: ${selectedConstants.length > 0 ? selectedConstants.join(', ') : 'None'}.
        Return a JSON object with:
        - theoreticalModels: Array of objects { name: "Model Name", description: "Brief description" } that resemble this equation.
        - derivation: A markdown string containing the step-by-step analytical solution using standard mathematical techniques. Use LaTeX blocks for math.
        - requiredInitialConditions: Array of strings representing the required initial conditions based on the order (e.g., ["${depVar}(0)", "${depVar}'(0)"]).
        - conceptsAndTheories: A markdown string explaining the core concepts of this equation and any physical/mathematical theories concerning it.
        - references: Array of strings containing academic references or topics to study further.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              theoreticalModels: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                  required: ['name', 'description'],
                },
              },
              derivation: { type: Type.STRING },
              requiredInitialConditions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              conceptsAndTheories: { type: Type.STRING },
              references: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: ['theoreticalModels', 'derivation', 'requiredInitialConditions', 'conceptsAndTheories', 'references'],
          },
        },
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/plot', async (req, res) => {
    try {
      const ai = getAI();
      const { parsedEq, depVar, constantValues, initialConditions } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Given the differential equation ${parsedEq.latex}, independent variable 't', dependent variable ${depVar}, constants ${JSON.stringify(constantValues)}, and initial conditions ${JSON.stringify(initialConditions)}.
        Assume any intermediate time-dependent variables are either provided as constants or simplified for this numerical plot.
        Generate numerical data to plot the solution curve for 't' from 0 to 10.
        Return a JSON object with:
        - t: Array of 50 numbers (independent variable values).
        - y: Array of 50 numbers (dependent variable values).
        - dydt: Array of 50 numbers (derivative values, for phase portrait). If it's a 1st order ODE, you can just compute the derivative at each point.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              t: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              y: { type: Type.ARRAY, items: { type: Type.NUMBER } },
              dydt: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            },
            required: ['t', 'y', 'dydt'],
          },
        },
      });
      res.json(JSON.parse(response.text || '{}'));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
