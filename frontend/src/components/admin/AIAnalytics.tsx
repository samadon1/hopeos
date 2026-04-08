"use client"

import { useState, useRef } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  BarChart3,
  Table,
  Code,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import apiService, { AIAnalyticsResponse } from '../../services/api.service';

const CHART_COLORS = ['#4a5d4e', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#14b8a6', '#ef4444', '#84cc16'];

const EXAMPLE_QUESTIONS = [
  "How many patients do we have?",
  "Show patient visits by gender",
  "Top 10 diagnoses this year",
  "Lab orders by status",
  "Patients registered per month",
  "Active prescriptions count",
];

export default function AIAnalytics() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AIAnalyticsResponse | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [showExamples, setShowExamples] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setError(null);
    setShowExamples(false);

    try {
      const response = await apiService.aiAnalyticsQuery(question);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'Failed to execute query');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (exampleQuestion: string) => {
    setQuestion(exampleQuestion);
    setShowExamples(false);
    setTimeout(() => {
      inputRef.current?.form?.requestSubmit();
    }, 100);
  };

  const renderChart = () => {
    if (!result?.data || result.data.length === 0 || !result.chart) {
      return null;
    }

    const { chart, data } = result;

    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-900">{label}</p>
            {payload.map((entry: any, index: number) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-gray-600">{entry.name || entry.dataKey}:</span>
                <span className="font-medium">{entry.value?.toLocaleString()}</span>
              </div>
            ))}
          </div>
        );
      }
      return null;
    };

    switch (chart.type) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey={chart.yKey} radius={[4, 4, 0, 0]}>
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey={chart.yKey} stroke="#4a5d4e" strokeWidth={2} dot={{ fill: '#4a5d4e', strokeWidth: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4a5d4e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#4a5d4e" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey={chart.yKey} stroke="#4a5d4e" fill="url(#colorArea)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey={chart.valueKey}
                nameKey={chart.nameKey}
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                labelLine={false}
              >
                {data.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  const renderTable = () => {
    if (!result?.data || result.data.length === 0) return null;

    const columns = Object.keys(result.data[0]);

    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {col.replace(/_/g, ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {result.data.slice(0, 50).map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-sm text-gray-900 whitespace-nowrap">
                    {typeof row[col] === 'number' ? row[col].toLocaleString() : String(row[col] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {result.data.length > 50 && (
          <p className="text-xs text-gray-500 mt-2 px-3">Showing 50 of {result.row_count} rows</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-[400px]">
      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Example Questions - show when no result */}
        {showExamples && !result && !error && (
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <HelpCircle className="h-4 w-4 text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700">Try asking</h3>
            </div>
            <div className="space-y-2">
              {EXAMPLE_QUESTIONS.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-olive-50 hover:text-olive-700 rounded-xl transition-colors border border-gray-100 hover:border-olive-200 bg-white"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-red-800 text-sm">Error</h4>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-olive-500 mx-auto mb-3" />
              <p className="text-sm text-gray-500">Analyzing your question...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Explanation */}
            {result.explanation && (
              <div className="bg-olive-50 border border-olive-100 rounded-xl p-4">
                <p className="text-sm text-olive-800">
                  <span className="font-medium">Result:</span> {result.explanation}
                </p>
                <p className="text-xs text-olive-600 mt-2">
                  {result.row_count} {result.row_count === 1 ? 'row' : 'rows'} returned
                </p>
              </div>
            )}

            {/* Chart */}
            {result.chart && result.chart.type !== 'table' && (
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center space-x-2 mb-3">
                  <BarChart3 className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">{result.chart.title}</h3>
                </div>
                {renderChart()}
              </div>
            )}

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center space-x-2">
                  <Table className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">Data</h3>
                </div>
              </div>
              {renderTable()}
            </div>

            {/* SQL Query (collapsible) */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <button
                onClick={() => setShowSql(!showSql)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <Code className="h-4 w-4 text-gray-400" />
                  <h3 className="text-sm font-medium text-gray-900">Generated SQL</h3>
                </div>
                {showSql ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>
              {showSql && (
                <div className="px-4 pb-4">
                  <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg text-xs overflow-x-auto">
                    <code>{result.sql}</code>
                  </pre>
                </div>
              )}
            </div>

            {/* New Query Button */}
            <button
              onClick={() => {
                setResult(null);
                setQuestion('');
                setShowExamples(true);
              }}
              className="w-full flex items-center justify-center space-x-2 py-2.5 text-sm text-olive-600 hover:text-olive-700 hover:bg-olive-50 rounded-xl transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Ask another question</span>
            </button>
          </div>
        )}
      </div>

      {/* Input Form - Fixed at bottom */}
      <div className="flex-shrink-0 pt-4 border-t border-gray-200">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-olive-500/20 focus-within:border-olive-500">
            <input
              ref={inputRef}
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 border-0 focus:outline-none focus:ring-0"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="m-1.5 px-4 py-2 bg-olive-500 hover:bg-olive-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center space-x-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
