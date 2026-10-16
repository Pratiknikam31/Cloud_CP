import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BrainCircuit, 
  Stethoscope, 
  Sparkles, 
  ArrowRight, 
  Calendar,
  AlertTriangle,
  ShieldAlert,
  Info
} from 'lucide-react';
import { aiApi } from '../../api/hospitalApi';

export const SymptomChecker: React.FC = () => {
  const navigate = useNavigate();
  const [symptoms, setSymptoms] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const QUICK_SYMPTOMS = [
    'Chest tightness and shortness of breath after exertion',
    'Severe throbbing headache with vision blur and dizziness',
    'Chronic knee joint stiffness and swelling when walking',
    'Persistent dry cough with high evening fever',
    'Acute lower abdominal pain with nausea',
    'Skin rash with red itchy inflamed patches'
  ];

  const handleAnalyze = async (textToAnalyze?: string) => {
    const query = textToAnalyze || symptoms;
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await aiApi.checkSymptoms(query);
      if (res.success && res.data) {
        const { recommendation, matchedDepartment, recommendedDoctors } = res.data;
        setResult({
          primaryDepartment: recommendation.departmentName,
          departmentCode: recommendation.departmentCode,
          confidenceScore: Math.round((recommendation.confidenceScore || 0.85) * 100),
          urgencyLevel: recommendation.suggestedUrgency || 'medium',
          explanation: recommendation.explanation,
          disclaimer: recommendation.disclaimer,
          matchedDepartment,
          suggestedDoctors: recommendedDoctors || []
        });
      }
    } catch (err) {
      console.error('Error analyzing symptoms:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Hero Card */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 text-white shadow-2xl border border-slate-800 space-y-4 relative overflow-hidden">
        <div className="absolute -right-16 -bottom-16 w-64 h-64 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase">
          <BrainCircuit className="w-4 h-4" />
          <span>AI Clinical Decision Assistant</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Smart Department Recommendation</h1>
        <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
          Describe your symptoms in natural language. Our clinical rule matrix and triage model matches symptom clusters to hospital departments and assigns active on-duty specialists immediately.
        </p>
      </div>

      {/* Input Form Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Describe How You Feel
          </label>
          <textarea
            rows={4}
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="e.g. I have been experiencing sharp chest pain during morning walks, accompanied by mild dizziness and shortness of breath..."
            className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-sm bg-slate-50 focus:bg-white transition-all font-medium"
          />
        </div>

        {/* Quick Suggestion Chips */}
        <div>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">Or select common clinical presentations:</span>
          <div className="flex flex-wrap gap-2">
            {QUICK_SYMPTOMS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setSymptoms(q);
                  handleAnalyze(q);
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-200 border border-slate-200 text-xs font-semibold text-slate-700 transition text-left"
              >
                + {q}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => handleAnalyze()}
          disabled={loading || !symptoms.trim()}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-brand-600 to-medical-teal text-white font-extrabold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Analyzing Symptoms via Clinical AI...</span>
            </div>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Get AI Recommendation & Matched Doctors</span>
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </div>

      {/* Results Display */}
      {result && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-lg space-y-6 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <Stethoscope className="w-6 h-6" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase">Recommended Specialty Wing</span>
                <h3 className="text-2xl font-extrabold text-slate-900">{result.primaryDepartment}</h3>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1.5 rounded-full font-bold text-xs uppercase ${
                result.urgencyLevel === 'emergency'
                  ? 'bg-rose-100 text-rose-800 border border-rose-300'
                  : result.urgencyLevel === 'high'
                  ? 'bg-amber-100 text-amber-800 border border-amber-300'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              }`}>
                {result.urgencyLevel} Urgency
              </span>

              <span className="px-3.5 py-1.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200 font-extrabold text-xs">
                {result.confidenceScore}% AI Confidence
              </span>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
            <span className="font-bold text-slate-900 block mb-1">Clinical Diagnostic Assessment:</span>
            {result.explanation}
          </div>

          {result.disclaimer && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{result.disclaimer}</span>
            </div>
          )}

          <div>
            <h4 className="font-bold text-slate-900 text-sm mb-3">Available Specialists in {result.primaryDepartment}:</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {result.suggestedDoctors?.length === 0 ? (
                <div className="col-span-2 p-6 rounded-2xl bg-slate-50 text-center text-slate-500 text-xs">
                  No active specialists currently in this wing. Proceed to booking for general reception assignment.
                </div>
              ) : (
                result.suggestedDoctors.map((doc: any) => (
                  <div key={doc._id} className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between bg-slate-50/50 hover:bg-white transition shadow-2xs">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-full bg-brand-600 text-white font-bold flex items-center justify-center shrink-0">
                        {doc.name.charAt(4) || 'D'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-sm">{doc.name}</p>
                        <span className="text-xs text-slate-500">{doc.specialization} • Room {doc.roomNumber}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/patient/book-appointment?doctorId=${doc._id}&deptId=${result.matchedDepartment?._id || ''}`)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-brand-600 text-white font-bold text-xs transition flex items-center space-x-1.5 shadow-xs"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Book</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
