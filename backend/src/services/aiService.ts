/**
 * Smart Symptom-Based AI Department Recommendation Service
 * Evaluates patient symptoms against clinical keyword matrices & returns target department recommendation.
 * Structured so external LLM API (OpenAI/Gemini/Ollama) can be seamlessly swapped.
 */

export interface AIRecommendationResult {
  departmentCode: string;
  departmentName: string;
  confidenceScore: number;
  explanation: string;
  suggestedUrgency: 'low' | 'medium' | 'high' | 'emergency';
  disclaimer: string;
}

const DEPARTMENT_SYMPTOM_MAP: Record<string, { code: string; name: string; keywords: string[] }> = {
  Cardiology: {
    code: 'CARD',
    name: 'Cardiology',
    keywords: ['chest pain', 'heart', 'palpitations', 'shortness of breath', 'high blood pressure', 'cardiac', 'angina', 'chest tightness']
  },
  Neurology: {
    code: 'NEUR',
    name: 'Neurology',
    keywords: ['headache', 'migraine', 'dizziness', 'seizure', 'numbness', 'memory loss', 'paralysis', 'tremor', 'fainting', 'stroke']
  },
  Orthopedics: {
    code: 'ORTH',
    name: 'Orthopedics',
    keywords: ['bone', 'joint', 'fracture', 'knee pain', 'back pain', 'sprain', 'arthritis', 'shoulder', 'spine', 'swollen joint']
  },
  Pediatrics: {
    code: 'PED',
    name: 'Pediatrics',
    keywords: ['child', 'infant', 'baby', 'toddler', 'pediatric', 'vaccination', 'growth', 'childhood fever']
  },
  Dermatology: {
    code: 'DERM',
    name: 'Dermatology',
    keywords: ['rash', 'skin', 'itching', 'acne', 'eczema', 'psoriasis', 'mole', 'skin lesion', 'allergy']
  },
  Gynecology: {
    code: 'OBGYN',
    name: 'Gynecology',
    keywords: ['pregnancy', 'menstrual', 'pelvic pain', 'ovarian', 'uterus', 'pcos', 'maternity', 'period pain']
  },
  ENT: {
    code: 'ENT',
    name: 'Ear, Nose & Throat (ENT)',
    keywords: ['earache', 'sinus', 'throat', 'tonsil', 'hearing loss', 'nasal congestion', 'tinnitus', 'voice loss']
  },
  Ophthalmology: {
    code: 'OPHTH',
    name: 'Ophthalmology',
    keywords: ['eye', 'vision', 'cataract', 'blurriness', 'red eye', 'glaucoma', 'double vision']
  },
  Emergency: {
    code: 'EMERG',
    name: 'Emergency Medicine',
    keywords: ['bleeding', 'unconscious', 'severe trauma', 'burns', 'anaphylaxis', 'poisoning', 'collapse']
  }
};

export const recommendDepartment = (symptoms: string): AIRecommendationResult => {
  const normalized = symptoms.toLowerCase();
  
  let bestMatch = {
    code: 'GEN',
    name: 'General Medicine',
    score: 0,
    matchedKeywords: [] as string[]
  };

  // Check emergency keywords first
  const emergencyKeywords = DEPARTMENT_SYMPTOM_MAP.Emergency.keywords;
  if (emergencyKeywords.some(kw => normalized.includes(kw))) {
    return {
      departmentCode: 'EMERG',
      departmentName: 'Emergency Medicine',
      confidenceScore: 0.95,
      explanation: 'Critical emergency keywords detected. Immediate emergency medical evaluation recommended.',
      suggestedUrgency: 'emergency',
      disclaimer: 'AI-assisted department recommendation — for informational purposes only. Seek immediate emergency care for life-threatening symptoms.'
    };
  }

  for (const [dept, info] of Object.entries(DEPARTMENT_SYMPTOM_MAP)) {
    if (dept === 'Emergency') continue;
    let score = 0;
    const matched: string[] = [];

    info.keywords.forEach(kw => {
      if (normalized.includes(kw)) {
        score += 1;
        matched.push(kw);
      }
    });

    if (score > bestMatch.score) {
      bestMatch = {
        code: info.code,
        name: info.name,
        score,
        matchedKeywords: matched
      };
    }
  }

  const confidenceScore = Math.min(0.92, 0.60 + bestMatch.score * 0.15);
  const urgency = bestMatch.score >= 2 ? 'medium' : 'low';

  return {
    departmentCode: bestMatch.code,
    departmentName: bestMatch.name,
    confidenceScore: bestMatch.score > 0 ? confidenceScore : 0.50,
    explanation: bestMatch.score > 0
      ? `Matched symptoms (${bestMatch.matchedKeywords.join(', ')}) to ${bestMatch.name}.`
      : 'No specific specialty keywords detected; routed to General Medicine for comprehensive evaluation.',
    suggestedUrgency: urgency,
    disclaimer: 'AI-assisted department recommendation — for informational purposes only. Consult a licensed physician for diagnosis.'
  };
};
