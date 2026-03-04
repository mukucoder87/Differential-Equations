/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import Plot from 'react-plotly.js';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, MathRun } from 'docx';
import { saveAs } from 'file-saver';
import { Calculator, ChevronRight, Download, LineChart, BookOpen, Settings2, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type ParsedEquation = {
  latex: string;
  allSymbols: string[];
  order: number;
  degree: number;
  linearity: string;
};

type TheoreticalModel = {
  name: string;
  description: string;
};

type AnalysisResult = {
  theoreticalModels: TheoreticalModel[];
  derivation: string;
  requiredInitialConditions: string[];
  conceptsAndTheories: string;
  references: string[];
};

type PlotData = {
  t: number[];
  y: number[];
  dydt: number[];
};

export default function App() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 State
  const [equationInput, setEquationInput] = useState('');
  const [parsedEq, setParsedEq] = useState<ParsedEquation | null>(null);

  // Step 2 State
  const [indVar, setIndVar] = useState<string>('t');
  const [depVar, setDepVar] = useState<string>('');
  const [intermediateVars, setIntermediateVars] = useState<string[]>([]);
  const [selectedConstants, setSelectedConstants] = useState<string[]>([]);

  // Step 3 State
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [initialConditions, setInitialConditions] = useState<Record<string, string>>({});
  const [constantValues, setConstantValues] = useState<Record<string, string>>({});

  // Step 4 State
  const [plotData, setPlotData] = useState<PlotData | null>(null);
  const [plotType, setPlotType] = useState<'solution' | 'phase'>('solution');

  // --- Handlers ---

  const handleParseEquation = async () => {
    if (!equationInput.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equationInput })
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to parse equation');
      }

      const data = await response.json() as ParsedEquation;
      setParsedEq(data);
      
      // Auto-select defaults if possible
      setIndVar('t'); // t is always independent
      
      if (data.allSymbols.includes('y')) setDepVar('y');
      else if (data.allSymbols.filter(s => s !== 't').length > 0) setDepVar(data.allSymbols.filter(s => s !== 't')[0]);
      
      setSelectedConstants([]);
      setIntermediateVars([]);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Failed to parse equation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!parsedEq || !depVar) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedEq, depVar, intermediateVars, selectedConstants })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to analyze equation');
      }

      const data = await response.json() as AnalysisResult;
      setAnalysis(data);
      
      // Initialize state for inputs
      const initialConds: Record<string, string> = {};
      data.requiredInitialConditions.forEach(c => initialConds[c] = '0');
      setInitialConditions(initialConds);
      
      const constVals: Record<string, string> = {};
      selectedConstants.forEach(c => constVals[c] = '1');
      setConstantValues(constVals);

      setStep(3);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze equation.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePlot = async () => {
    if (!parsedEq || !analysis) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/plot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parsedEq, depVar, constantValues, initialConditions })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to generate plot data');
      }

      const data = await response.json() as PlotData;
      setPlotData(data);
      setStep(4);
    } catch (err: any) {
      setError(err.message || 'Failed to generate plot data.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportDocx = async () => {
    if (!parsedEq || !analysis) return;
    
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({ text: "Differential Equation Analysis Report", heading: HeadingLevel.HEADING_1 }),
            new Paragraph({ text: `Equation: ${parsedEq.latex}` }),
            new Paragraph({ text: `Order: ${parsedEq.order}, Degree: ${parsedEq.degree}, Linearity: ${parsedEq.linearity}` }),
            
            new Paragraph({ text: "Theoretical Models", heading: HeadingLevel.HEADING_2 }),
            ...analysis.theoreticalModels.map(m => new Paragraph({ text: `• ${m.name}: ${m.description}` })),
            
            new Paragraph({ text: "Analytical Solution", heading: HeadingLevel.HEADING_2 }),
            new Paragraph({ text: "See the web interface for the full LaTeX derivation." }),
            new Paragraph({ text: analysis.derivation.substring(0, 500) + "..." }), // Simplified for docx export
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, "DE_Analysis_Report.docx");
  };

  // --- UI Components ---

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Calculator className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">DE Master</h1>
          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
            <span className={cn(step >= 1 ? "text-indigo-600" : "")}>1. Input</span>
            <ChevronRight className="w-4 h-4" />
            <span className={cn(step >= 2 ? "text-indigo-600" : "")}>2. Variables</span>
            <ChevronRight className="w-4 h-4" />
            <span className={cn(step >= 3 ? "text-indigo-600" : "")}>3. Analysis</span>
            <ChevronRight className="w-4 h-4" />
            <span className={cn(step >= 4 ? "text-indigo-600" : "")}>4. Visualize</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-8 space-y-8">
        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Input */}
        <section className={cn("bg-white p-6 rounded-2xl shadow-sm border border-slate-200 transition-opacity", step < 1 && "opacity-50 pointer-events-none")}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">1</div>
            Equation Intake
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Type your differential equation</label>
              <input
                type="text"
                value={equationInput}
                onChange={(e) => setEquationInput(e.target.value)}
                placeholder="e.g., d^2y/dt^2 + 2*y = sin(t)"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono"
                disabled={isLoading && step === 1}
              />
            </div>
            <button
              onClick={handleParseEquation}
              disabled={!equationInput.trim() || (isLoading && step === 1)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && step === 1 ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Parse Equation'}
            </button>
          </div>

          {parsedEq && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-sm text-slate-500 mb-2 font-medium uppercase tracking-wider">Parsed LaTeX</p>
              <div className="text-xl text-center py-4 overflow-x-auto">
                <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {`$$${parsedEq.latex}$$`}
                </ReactMarkdown>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium">Order: {parsedEq.order}</span>
                <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium">Degree: {parsedEq.degree}</span>
                <span className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium">{parsedEq.linearity}</span>
              </div>
            </div>
          )}
        </section>

        {/* Step 2: Variables */}
        {step >= 2 && parsedEq && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">2</div>
              Clarify Variables
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Independent Variable</label>
                <input type="text" value="t (Time)" disabled className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dependent Variable</label>
                <select
                  value={depVar}
                  onChange={(e) => setDepVar(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="">Select...</option>
                  {parsedEq.allSymbols.filter(v => v !== 't').map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Time-Dependent Variables (Influence {depVar || 'y'}, but depend on t)</label>
                <div className="flex flex-wrap gap-2">
                  {parsedEq.allSymbols.filter(v => v !== 't' && v !== depVar).length === 0 ? (
                    <span className="text-sm text-slate-500">No other variables available.</span>
                  ) : (
                    parsedEq.allSymbols.filter(v => v !== 't' && v !== depVar).map(v => (
                      <label key={`int-${v}`} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={intermediateVars.includes(v)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setIntermediateVars([...intermediateVars, v]);
                              setSelectedConstants(selectedConstants.filter(c => c !== v));
                            } else {
                              setIntermediateVars(intermediateVars.filter(x => x !== v));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-mono text-sm">{v}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Constants</label>
                <div className="flex flex-wrap gap-2">
                  {parsedEq.allSymbols.filter(v => v !== 't' && v !== depVar).length === 0 ? (
                    <span className="text-sm text-slate-500">No other variables available.</span>
                  ) : (
                    parsedEq.allSymbols.filter(v => v !== 't' && v !== depVar).map(c => (
                      <label key={`const-${c}`} className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100">
                        <input
                          type="checkbox"
                          checked={selectedConstants.includes(c)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedConstants([...selectedConstants, c]);
                              setIntermediateVars(intermediateVars.filter(v => v !== c));
                            } else {
                              setSelectedConstants(selectedConstants.filter(x => x !== c));
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-mono text-sm">{c}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!depVar || (isLoading && step === 2)}
              className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading && step === 2 ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Analyze & Solve'}
            </button>
          </section>
        )}

        {/* Step 3: Analysis & Derivation */}
        {step >= 3 && analysis && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">3</div>
              Theoretical Models & Solution
            </h2>
            
            <div className="space-y-6">
              {/* Models */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Matching Models
                </h3>
                <div className="grid gap-3">
                  {analysis.theoreticalModels.map((model, idx) => (
                    <div key={idx} className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
                      <h4 className="font-semibold text-indigo-900">{model.name}</h4>
                      <p className="text-sm text-indigo-700/80 mt-1">{model.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Derivation */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Step-by-Step Derivation
                </h3>
                <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 prose prose-sm max-w-none prose-p:leading-relaxed overflow-x-auto">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {analysis.derivation}
                  </ReactMarkdown>
                </div>
              </div>

              {/* Concepts and Theories */}
              <div>
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4" /> Concepts & Theories
                </h3>
                <div className="p-5 rounded-xl border border-slate-200 bg-white prose prose-sm max-w-none prose-p:leading-relaxed text-slate-700">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {analysis.conceptsAndTheories}
                  </ReactMarkdown>
                </div>
              </div>

              {/* References */}
              {analysis.references && analysis.references.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" /> References to Study
                  </h3>
                  <ul className="list-disc list-inside space-y-2 text-sm text-slate-700 p-5 rounded-xl border border-slate-200 bg-slate-50">
                    {analysis.references.map((ref, idx) => (
                      <li key={idx}>{ref}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Setup for Graphing */}
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Settings2 className="w-4 h-4" /> Graphing Parameters
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Initial Conditions */}
                  {analysis.requiredInitialConditions.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-700">Initial Conditions</h4>
                      {analysis.requiredInitialConditions.map(cond => (
                        <div key={cond} className="flex items-center gap-3">
                          <label className="w-16 text-sm font-mono text-slate-600">{cond} =</label>
                          <input
                            type="number"
                            value={initialConditions[cond] || ''}
                            onChange={(e) => setInitialConditions({...initialConditions, [cond]: e.target.value})}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Constants */}
                  {selectedConstants.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium text-slate-700">Constant Values</h4>
                      {selectedConstants.map(c => (
                        <div key={c} className="flex items-center gap-3">
                          <label className="w-16 text-sm font-mono text-slate-600">{c} =</label>
                          <input
                            type="number"
                            value={constantValues[c] || ''}
                            onChange={(e) => setConstantValues({...constantValues, [c]: e.target.value})}
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <button
                  onClick={handleGeneratePlot}
                  disabled={isLoading && step === 3}
                  className="mt-6 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isLoading && step === 3 ? <Loader2 className="w-5 h-5 animate-spin" /> : <><LineChart className="w-5 h-5" /> Generate Interactive Graph</>}
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Step 4: Visualization */}
        {step >= 4 && plotData && (
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">4</div>
                Visualization
              </h2>
              <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => setPlotType('solution')}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", plotType === 'solution' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  Solution Curve
                </button>
                <button
                  onClick={() => setPlotType('phase')}
                  className={cn("px-3 py-1.5 text-sm font-medium rounded-md transition-colors", plotType === 'phase' ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700")}
                >
                  Phase Portrait
                </button>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <Plot
                data={[
                  plotType === 'solution' 
                    ? {
                        x: plotData.t,
                        y: plotData.y,
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: '#4f46e5', width: 2 },
                        name: `${depVar}('t')`,
                      }
                    : {
                        x: plotData.y,
                        y: plotData.dydt,
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: '#ec4899', width: 2 },
                        name: `Phase Portrait`,
                      }
                ]}
                layout={{
                  autosize: true,
                  margin: { l: 50, r: 20, t: 20, b: 40 },
                  xaxis: { title: { text: plotType === 'solution' ? 't' : depVar } },
                  yaxis: { title: { text: plotType === 'solution' ? depVar : `d${depVar}/dt` } },
                  hovermode: 'closest',
                  paper_bgcolor: 'transparent',
                  plot_bgcolor: 'transparent',
                }}
                useResizeHandler={true}
                style={{ width: '100%', height: '400px' }}
                config={{ responsive: true, displayModeBar: false }}
              />
            </div>

            <div className="mt-8 pt-6 border-t border-slate-200 flex justify-center">
              <button
                onClick={handleExportDocx}
                className="bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download Complete Report (.docx)
              </button>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-12 mb-8 text-center">
        <p className="text-sm text-slate-500 font-medium">
          Concept and Design by <a href="https://www.linkedin.com/in/dr-mukunda-upadhyay-692351279/?originalSubdomain=in" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline font-semibold">Dr. Mukunda Upadhyay</a>
        </p>
      </footer>
    </div>
  );
}

