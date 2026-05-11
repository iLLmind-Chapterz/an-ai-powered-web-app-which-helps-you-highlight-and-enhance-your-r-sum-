import React, { useState, useRef, useEffect } from 'react';
import { FileText, Briefcase, ChevronRight, AlertCircle, CheckCircle2, RotateCcw, Loader2, UploadCloud, FileUp, Download, Sparkles, Wand2, History, X, Clock, Plus, Upload, Trophy, Zap, Target, Award, Star, LogIn, LogOut, User, Mail, Apple, Facebook, Phone, UserPlus, ArrowUpRight, ArrowDownRight, Minus, Split } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from '@google/genai';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar as RadarChartJS } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  setDoc, 
  doc, 
  getDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { auth, db, googleProvider, facebookProvider, appleProvider, signInWithPopup, signOut, handleFirestoreError, OperationType } from '../lib/firebase';
import { PrintableReport } from './PrintableReport';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);
import { AnalysisResult } from '../types';

// Initialize Gemini API client
// Note: process.env.GEMINI_API_KEY is automatically injected by the environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function GapAnalyzer() {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSignUpMenu, setShowSignUpMenu] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [editingSkill, setEditingSkill] = useState<{ name: string; type: string } | null>(null);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [comparisonTarget, setComparisonTarget] = useState<any | null>(null);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const XP_PER_LEVEL = 1000;
  
  const addXp = async (amount: number) => {
    if (!user) {
      setXp(prev => {
        const newXp = prev + amount;
        localStorage.setItem('resume_xp', newXp.toString());
        const newLevel = Math.floor(newXp / XP_PER_LEVEL) + 1;
        if (newLevel > level) {
          setLevel(newLevel);
          localStorage.setItem('resume_level', newLevel.toString());
          setShowLevelUp(true);
          setTimeout(() => setShowLevelUp(false), 5000);
        }
        return newXp;
      });
      return;
    }

    try {
      const newXpValue = xp + amount;
      const newLevelValue = Math.floor(newXpValue / XP_PER_LEVEL) + 1;
      
      await setDoc(doc(db, 'users', user.uid), {
        xp: newXpValue,
        level: newLevelValue,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setXp(newXpValue);
      if (newLevelValue > level) {
        setLevel(newLevelValue);
        setShowLevelUp(true);
        setTimeout(() => setShowLevelUp(false), 5000);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const getLevelName = (lvl: number) => {
    if (lvl >= 10) return 'Career Deity';
    if (lvl >= 8) return 'Industry Titan';
    if (lvl >= 6) return 'Hiring Specialist';
    if (lvl >= 4) return 'Offer Magnet';
    if (lvl >= 2) return 'Career Climber';
    return 'Resume Novice';
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchUserProfile(currentUser.uid);
        fetchHistory(currentUser.uid);
      } else {
        setXp(Number(localStorage.getItem('resume_xp') || 0));
        setLevel(Number(localStorage.getItem('resume_level') || 1));
        setHistory([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setXp(data.xp || 0);
        setLevel(data.level || 1);
      } else {
        const initialXp = Number(localStorage.getItem('resume_xp') || 0);
        const initialLevel = Number(localStorage.getItem('resume_level') || 1);
        await setDoc(docRef, {
          xp: initialXp,
          level: initialLevel,
          updatedAt: serverTimestamp()
        });
        setXp(initialXp);
        setLevel(initialLevel);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${uid}`);
    }
  };

  // Real-time updates when resume or job description changes (debounced)
  useEffect(() => {
    if (result && resume.trim().length > 50 && jobDescription.trim().length > 50 && !isAnalyzing) {
      const timer = setTimeout(() => {
        handleAnalyze();
      }, 1500); // 1.5s delay as requested
      return () => clearTimeout(timer);
    }
  }, [resume, jobDescription]);

  const fetchHistory = async (uid?: string) => {
    const activeUid = uid || user?.uid;
    if (!activeUid) return;

    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'analyses'),
        where('userId', '==', activeUid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const historyData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: (doc.data().createdAt as Timestamp).toDate().toISOString()
      }));
      setHistory(historyData);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'analyses');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const saveToHistory = async (analysisResult: AnalysisResult) => {
    if (!user) return; // Only save for logged in users

    try {
      const jobTitleMatch = jobDescription.match(/^([^\n]+)/);
      const jobTitle = jobTitleMatch ? jobTitleMatch[1].slice(0, 50) : 'Untitled Analysis';

      const data = {
        userId: user.uid,
        jobTitle,
        resumeText: resume,
        jdText: jobDescription,
        result: analysisResult,
        updatedAt: serverTimestamp()
      };

      if (currentDocId) {
        await setDoc(doc(db, 'analyses', currentDocId), data, { merge: true });
      } else {
        const docRef = await addDoc(collection(db, 'analyses'), {
          ...data,
          createdAt: serverTimestamp()
        });
        setCurrentDocId(docRef.id);
      }
      fetchHistory(user.uid);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'analyses');
    }
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // Silently handle if user closes the popup
        return;
      }
      console.error('Login Error:', err);
    }
  };

  const handleProviderSignUp = async (providerName: string) => {
    try {
      let provider;
      if (providerName === 'google') provider = googleProvider;
      else if (providerName === 'facebook') provider = facebookProvider;
      else if (providerName === 'apple') provider = appleProvider;
      
      if (provider) {
        await signInWithPopup(auth, provider);
        setShowSignUpMenu(false);
      } else if (providerName === 'email') {
        alert("Email registration requires enabling 'Email/Password' in Firebase Console and implementing a form.");
      } else if (providerName === 'phone') {
        alert("Phone authentication requires enabling 'Phone' in Firebase Console and setting up Recaptcha.");
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        alert(`${providerName} authentication is not enabled. Please enable it in the Firebase Console under Authentication > Sign-in method.`);
        return;
      }
      if (err.code === 'auth/popup-closed-by-user') {
        return;
      }
      console.error(`${providerName} Sign Up Error:`, err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout Error:', err);
    }
  };

  const loadHistoryItem = (item: any) => {
    setResume(item.resumeText || item.resume_text);
    setJobDescription(item.jdText || item.jd_text);
    setResult(item.result || item.analysis_result);
    setCurrentDocId(item.id);
    setShowHistory(false);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current || !result) return;
    
    setIsDownloading(true);
    try {
      const canvas = await (html2canvas as any)(printRef.current, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
      pdf.save(`Gap_Analysis_Report_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      setError('Failed to generate professional PDF report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('File extraction failed');

      const data = await response.json();
      setResume(data.text);
    } catch (err) {
      setError('Failed to extract text from file. Please ensure it is a valid PDF or text file.');
    } finally {
      setIsExtracting(false);
      // Reset input
      e.target.value = '';
    }
  };

  const cleanInputText = (text: string) => {
    // Removes hidden characters and normalizes the text (equivalent to Python's NFKD normalization)
    return text.normalize('NFKD').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
  };

  const handleAnalyze = async () => {
    const cleanResume = cleanInputText(resume);
    const cleanJD = cleanInputText(jobDescription);

    if (!cleanResume || !cleanJD) {
      setError('Please provide both a resume and a job description.');
      return;
    }

    // Client-side length check (UX reinforcement)
    if (cleanResume.length < 50 || cleanJD.length < 50) {
      setError('Inputs are too short. Please provide more detail (at least 50 characters each).');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    if (!result) setResult(null);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `RESUME:\n${cleanResume.slice(0, 15000)}\n\nJOB DESCRIPTION:\n${cleanJD.slice(0, 15000)}`,
        config: {
          systemInstruction: "You are a data-only API. You compare resumes to job descriptions. CRITICAL RULE: Output ONLY raw JSON. NO markdown backticks (```json). NO introductory text like \"Here is the analysis.\" NO closing remarks. If you fail to analyze, return: {\"error\": \"Reason for failure\"}",
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              match_score: { type: Type.NUMBER, description: 'Score between 0-100' },
              radar_metrics: {
                type: Type.OBJECT,
                properties: {
                  technical: { type: Type.NUMBER, description: 'Score 1-10' },
                  leadership: { type: Type.NUMBER, description: 'Score 1-10' },
                  experience: { type: Type.NUMBER, description: 'Score 1-10' },
                  domain: { type: Type.NUMBER, description: 'Score 1-10' }
                },
                required: ['technical', 'leadership', 'experience', 'domain']
              },
              analysis: {
                type: Type.OBJECT,
                properties: {
                  hard_skills_match: { type: Type.ARRAY, items: { type: Type.STRING } },
                  soft_skills_match: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missing_skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                  experience_gap: { type: Type.STRING }
                },
                required: ['hard_skills_match', 'soft_skills_match', 'missing_skills', 'experience_gap']
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 3 specific, actionable strings'
              },
              improvement_plan: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Exactly 3 strings'
              }
            },
            required: ['match_score', 'radar_metrics', 'analysis', 'recommendations', 'improvement_plan']
          }
        }
      });

      let resultText = response.text || '{}';
      
      // FIX: Clean the response in case the AI added ```json blocks
      resultText = resultText.replace(/^```json|```$/gm, '').trim();

      const rawData = JSON.parse(resultText);
      const data: AnalysisResult = {
        ...rawData,
        skill_context: result?.skill_context || {}, // Keep existing context if re-analyzing
        // Map radar_metrics to radarData for compatibility with Chart.js
        radarData: [
          { subject: 'Technical', score: rawData.radar_metrics.technical },
          { subject: 'Leadership', score: rawData.radar_metrics.leadership },
          { subject: 'Experience', score: rawData.radar_metrics.experience },
          { subject: 'Domain', score: rawData.radar_metrics.domain },
        ]
      };
      
      // XP Logic
      if (!result) {
        addXp(250); // Initial analysis XP
      } else if (data.match_score > result.match_score) {
        addXp(150); // Improvement XP
      } else {
        addXp(50); // Minor iteration XP
      }

      setResult(data);
      saveToHistory(data);
    } catch (err) {
      console.error('Deep Analysis Error:', err);
      // This ensures the frontend gets a valid JSON even if the AI fails
      const fallbackData: AnalysisResult = {
        match_score: 0,
        radar_metrics: { technical: 0, leadership: 0, experience: 0, domain: 0 },
        analysis: { 
          hard_skills_match: [], 
          soft_skills_match: [], 
          missing_skills: ["Analysis Error"], 
          experience_gap: "Check API Logs" 
        },
        recommendations: ["Ensure API Key is active and quota is not exceeded."],
        improvement_plan: ["Retry analysis in a few moments", "Check network connection", "Verify valid API key"],
        skill_context: {},
        radarData: [
          { subject: 'Technical', score: 0 },
          { subject: 'Leadership', score: 0 },
          { subject: 'Experience', score: 0 },
          { subject: 'Domain', score: 0 },
        ]
      };
      setResult(fallbackData);
      setError('Semantic analysis failed. Providing diagnostic feedback instead.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setResume('');
    setJobDescription('');
    setResult(null);
    setError(null);
    setEditingSkill(null);
    setCurrentDocId(null);
  };

  const updateSkillContext = (name: string, context: any) => {
    if (!result) return;
    const newResult = {
      ...result,
      skill_context: {
        ...(result.skill_context || {}),
        [name]: context
      }
    };
    setResult(newResult);
    if (user) {
      saveToHistory(newResult);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 overflow-x-hidden" id="analyzer-container">
      <header className="h-16 flex items-center justify-between px-10 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-sm transform rotate-45"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">The Gap Analyzer</h1>
        </div>
        
        {/* Experience Bar */}
        <div className="hidden lg:flex items-center gap-6 px-8 border-x border-slate-100 h-full">
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Level {level}</span>
              <span className="text-xs font-bold text-blue-600">{getLevelName(level)}</span>
            </div>
            <div className="w-48 h-1.5 bg-slate-100 rounded-full mt-1 overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${(xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100}%` }}
                className="h-full bg-blue-600 rounded-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100">
            <Zap size={14} fill="currentColor" />
            <span className="text-xs font-black">{xp} XP</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 pr-4 border-r border-slate-100">
              <div className="flex flex-col items-end hidden sm:flex">
                <span className="text-[11px] font-bold text-slate-800">{user.displayName}</span>
                <button onClick={handleLogout} className="text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-red-500 transition-colors">Sign Out</button>
              </div>
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                  <User size={16} />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-blue-700 transition-all shadow-md"
              >
                <LogIn size={14} />
                Sign In
              </button>

              <div className="relative">
                <button 
                  onClick={() => setShowSignUpMenu(!showSignUpMenu)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg hover:bg-slate-900 transition-all shadow-md"
                >
                  <UserPlus size={14} />
                  Sign Up
                </button>
                
                <AnimatePresence>
                  {showSignUpMenu && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-[60]"
                    >
                      <div className="p-2 space-y-1">
                        <button onClick={() => handleProviderSignUp('email')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">
                          <Mail size={14} /> Email
                        </button>
                        <button onClick={() => handleProviderSignUp('apple')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">
                          <Apple size={14} /> Apple
                        </button>
                        <button onClick={() => handleProviderSignUp('facebook')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">
                          <Facebook size={14} /> Facebook
                        </button>
                        <button onClick={() => handleProviderSignUp('phone')} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 rounded-lg transition-colors">
                          <Phone size={14} /> Phone Number
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          <button 
            onClick={() => setShowHistory(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-600 hover:text-blue-600 transition-colors uppercase tracking-widest"
          >
            <History size={16} />
            History
          </button>
          <div className="hidden sm:flex items-center gap-6">
            <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase">Professional Edition v1.5.0</span>
          </div>
        </div>
      </header>

      {/* History Sidebar */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowHistory(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 w-full max-w-sm h-full bg-white shadow-2xl z-[70] flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <History size={20} />
                  </div>
                  <h3 className="font-bold text-slate-800">Version History</h3>
                </div>
                <button 
                  onClick={() => setShowHistory(false)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
                    <Loader2 size={32} className="animate-spin" />
                    <span className="text-sm font-medium">Retrieving saved versions...</span>
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center py-12 space-y-2">
                    <p className="text-sm font-semibold text-slate-800">No saved analyses yet</p>
                    <p className="text-xs text-slate-400">Run a comparison to start tracking your progress.</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="relative group">
                      <button
                        onClick={() => loadHistoryItem(item)}
                        className="w-full text-left p-4 pr-16 rounded-2xl border border-slate-100 hover:border-blue-200 bg-white hover:bg-blue-50/30 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-bold text-sm text-slate-800 flex-1 truncate">{item.jobTitle || item.job_title}</span>
                          <div className="flex items-center gap-1 text-blue-600">
                            <span className="text-xs font-black">{(item.result || item.analysis_result).match_score}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium">
                            <Clock size={12} />
                            {new Date(item.createdAt || item.created_at).toLocaleDateString()} at {new Date(item.createdAt || item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </button>
                      
                      {result && item.id !== currentDocId && (
                        <button 
                          onClick={() => {
                            setComparisonTarget(item);
                            setShowHistory(false);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-indigo-50 text-indigo-600 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-100"
                          title="Compare with current"
                        >
                          <Split size={14} />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1 w-full mx-auto p-4 md:p-8 max-w-[1600px]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 h-[calc(100vh-12rem)] min-h-[700px]">
          {/* Left Pane: Inputs */}
          <div className="lg:col-span-5 flex flex-col gap-6 overflow-hidden">
            {/* Resume Input */}
            <div className="flex-1 min-h-0 bg-white border text-slate-900 border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
                    <FileText size={16} />
                  </div>
                  <h3 className="font-bold text-sm tracking-tight text-slate-800">Your Resume</h3>
                </div>
                <div className="flex items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase hover:bg-blue-100 transition-colors">
                    <FileUp size={12} />
                    {isExtracting ? 'Extracting...' : 'Upload File'}
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={handleFileUpload}
                      disabled={isExtracting}
                    />
                  </label>
                  {resume && (
                    <button 
                      onClick={() => setResume('')}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
              <div className="relative flex-1 overflow-hidden">
                <textarea
                  id="resume-input"
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  placeholder="Paste your current resume here or upload a file..."
                  className="w-full h-full p-6 text-sm font-mono leading-relaxed bg-transparent focus:outline-none placeholder:text-slate-300 resize-none text-slate-700 custom-scrollbar"
                />
                {!resume && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20">
                    <UploadCloud size={48} className="mb-4 text-slate-400" />
                    <p className="text-sm font-medium">Empty Workspace</p>
                  </div>
                )}
              </div>
            </div>

            {/* Job Description Input */}
            <div className="flex-1 min-h-0 bg-white border text-slate-900 border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                    <Briefcase size={16} />
                  </div>
                  <h3 className="font-bold text-sm tracking-tight text-slate-800">Job Description</h3>
                </div>
                {jobDescription && (
                  <button 
                    onClick={() => setJobDescription('')}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <RotateCcw size={14} />
                  </button>
                )}
              </div>
              <div className="relative flex-1 overflow-hidden">
                <textarea
                  id="jd-input"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste job requirements here..."
                  className="w-full h-full p-6 text-[13px] leading-relaxed bg-transparent focus:outline-none placeholder:text-slate-300 resize-none text-slate-700 custom-scrollbar"
                />
              </div>
            </div>

            {/* Analyse Button */}
            {!result && (
              <button 
                onClick={handleAnalyze} 
                disabled={isAnalyzing || !resume.trim() || !jobDescription.trim()} 
                className="w-full py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] transition-all bg-blue-600 text-white shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 border-b-4 border-blue-800 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isAnalyzing ? (
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Processing Diagnostic...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-3">
                    <Zap size={18} className="group-hover:text-amber-300 transition-colors" />
                    <span>Run Deep Analysis</span>
                  </div>
                )}
              </button>
            )}
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-red-700 leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          {/* Right Pane: Results or Empty State */}
          <div className="lg:col-span-7 h-full flex flex-col overflow-hidden">
            {!result ? (
              <div className="flex-1 bg-slate-50/50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center p-12 text-center">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-10 animate-pulse"></div>
                  <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center relative">
                    <Target size={40} className="text-slate-200" />
                  </div>
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">Diagnostic Engine Idle</h3>
                <p className="text-slate-500 text-sm max-w-sm font-medium leading-relaxed mb-8">
                  Upload your resume and the target job description. Our AI will map the trajectory and highlight critical alignment gaps.
                </p>
                <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2">
                    <Zap size={20} className="text-amber-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Match Index</span>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center gap-2">
                    <Trophy size={20} className="text-blue-500" />
                    <span className="text-[10px] font-black uppercase text-slate-400">Rank Tracking</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col overflow-hidden">
                <div className="flex items-center justify-between mb-4 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-50 text-green-600 rounded-xl">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-slate-800 leading-none">Diagnostic Result</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Real-time Analysis v2.0</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleDownloadPDF}
                      disabled={isDownloading}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50"
                    >
                      {isDownloading ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                      {isDownloading ? 'Generating...' : 'Export PDF'}
                    </button>
                    <button 
                      onClick={reset}
                      className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
                    >
                      <RotateCcw size={20} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6">
                  <div ref={resultRef} id="analysis-result-content" className="space-y-6 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center justify-center relative overflow-hidden">
                      {isAnalyzing && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10"
                        >
                          <Loader2 size={24} className="text-blue-600 animate-spin" />
                        </motion.div>
                      )}
                      <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Match Index</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-black text-slate-800">{result.match_score}</span>
                        <span className="text-lg font-bold text-slate-200">%</span>
                      </div>
                    </div>
                    <div className="md:col-span-8 bg-indigo-600 text-white rounded-2xl p-6 shadow-lg relative overflow-hidden flex flex-col justify-center">
                      <div className="absolute top-0 right-0 p-4 opacity-20"><Wand2 size={50} /></div>
                      <p className="text-[10px] font-black text-indigo-200 mb-2 uppercase tracking-widest">Experience Alignment</p>
                      <p className="text-sm font-medium pr-12 italic">"{result.analysis.experience_gap}"</p>
                    </div>
                  </div>

                  {/* Radar Chart Row */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center">
                    <p className="text-[10px] font-black text-slate-400 mb-6 uppercase tracking-widest text-center">Competency Mapping</p>
                    <div className="w-full max-w-[400px] h-[300px]">
                      <RadarChartJS
                        data={{
                          labels: result.radarData.map(d => d.subject),
                          datasets: [{
                            label: 'Strength Index',
                            data: result.radarData.map(d => d.score),
                            backgroundColor: 'rgba(37, 99, 235, 0.2)',
                            borderColor: 'rgb(37, 99, 235)',
                            borderWidth: 2,
                            pointBackgroundColor: 'rgb(37, 99, 235)',
                            pointBorderColor: '#fff',
                            pointHoverBackgroundColor: '#fff',
                            pointHoverBorderColor: 'rgb(37, 99, 235)'
                          }]
                        }}
                        options={{
                          scales: {
                            r: {
                              angleLines: { display: true, color: 'rgba(226, 232, 240, 0.5)' },
                              grid: { color: 'rgba(226, 232, 240, 0.5)' },
                              suggestedMin: 0,
                              suggestedMax: 10,
                              ticks: { display: false, stepSize: 2 },
                              pointLabels: {
                                font: { size: 10, family: 'Inter', weight: 'bold' },
                                color: '#64748b'
                              }
                            }
                          },
                          plugins: {
                            legend: { display: false },
                            tooltip: {
                              backgroundColor: '#1e293b',
                              padding: 12,
                              titleFont: { size: 11, weight: 'bold' },
                              bodyFont: { size: 13 },
                              cornerRadius: 8,
                              displayColors: false
                            }
                          },
                          maintainAspectRatio: false
                        }}
                      />
                    </div>
                  </div>

                  {/* Recommendations & Plan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Bridging the Gap</p>
                      <ul className="space-y-3">
                        {result.recommendations.map((rec, i) => (
                          <li key={i} className="flex gap-3 text-xs font-medium text-slate-600 leading-relaxed">
                            <div className="w-5 h-5 bg-blue-50 text-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-black">{i + 1}</div>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl">
                      <p className="text-[10px] font-black text-slate-500 mb-4 uppercase tracking-widest">Resume Keywords Plan</p>
                      <ul className="space-y-3">
                        {result.improvement_plan.map((item, i) => (
                          <li key={i} className="flex gap-3 text-xs font-bold text-slate-200 leading-relaxed uppercase tracking-tight">
                            <Sparkles size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Skills Analysis */}
                  <div className="space-y-4">
                    {/* Missing Skills Alert */}
                    {result.analysis.missing_skills.length > 0 && (
                      <div className="bg-red-50 border border-red-100 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <AlertCircle size={16} className="text-red-500" />
                          <p className="text-[10px] font-black text-red-800 uppercase tracking-widest">Critical Missing Competencies</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {result.analysis.missing_skills.map((s, i) => (
                            <button 
                              key={i} 
                              onClick={() => setEditingSkill({ name: s, type: 'missing' })}
                              className="group relative px-3 py-1 bg-white border border-red-200 text-red-600 rounded-lg text-[10px] font-black uppercase shadow-sm hover:bg-red-50 transition-all"
                            >
                              {s}
                              {result.skill_context?.[s] && (
                                <span className="ml-1 text-[8px] opacity-60">
                                  ({result.skill_context[s].years ? `${result.skill_context[s].years}Y` : ''}
                                  {result.skill_context[s].years && result.skill_context[s].proficiency ? ', ' : ''}
                                  {result.skill_context[s].proficiency})
                                </span>
                              )}
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={8} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Skill Lists */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Technical Overlap</p>
                        <div className="flex flex-wrap gap-2">
                          {result.analysis.hard_skills_match.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setEditingSkill({ name: s, type: 'hard' })}
                              className="group relative px-3 py-1 bg-green-50 text-green-700 border border-green-100 rounded-lg text-[10px] font-black uppercase hover:bg-green-100 transition-all"
                            >
                              {s}
                              {result.skill_context?.[s] && (
                                <span className="ml-1 text-[8px] opacity-60">
                                  ({result.skill_context[s].years ? `${result.skill_context[s].years}Y` : ''}
                                  {result.skill_context[s].years && result.skill_context[s].proficiency ? ', ' : ''}
                                  {result.skill_context[s].proficiency})
                                </span>
                              )}
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={8} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 mb-4 uppercase tracking-widest">Soft Skills Alignment</p>
                        <div className="flex flex-wrap gap-2">
                          {result.analysis.soft_skills_match.map((s, i) => (
                            <button
                              key={i}
                              onClick={() => setEditingSkill({ name: s, type: 'soft' })}
                              className="group relative px-3 py-1 bg-blue-50 text-blue-700 border border-blue-100 rounded-lg text-[10px] font-black uppercase hover:bg-blue-100 transition-all"
                            >
                              {s}
                              {result.skill_context?.[s] && (
                                <span className="ml-1 text-[8px] opacity-60">
                                  ({result.skill_context[s].years ? `${result.skill_context[s].years}Y` : ''}
                                  {result.skill_context[s].years && result.skill_context[s].proficiency ? ', ' : ''}
                                  {result.skill_context[s].proficiency})
                                </span>
                              )}
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Plus size={8} />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>

    {/* Hidden printable report container */}
    <div className="absolute -left-[9999px] top-0 pointer-events-none overflow-hidden">
      {result && <PrintableReport id="printable-report" data={result} ref={printRef as any} />}
    </div>

      {/* Skill Detail Editor Modal */}
      <AnimatePresence>
        {editingSkill && (
          <SkillDetailEditor 
            skill={editingSkill}
            result={result}
            onClose={() => setEditingSkill(null)}
            onSave={(name, context) => {
              updateSkillContext(name, context);
              setEditingSkill(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Comparison Modal */}
      <AnimatePresence>
        {comparisonTarget && result && (
          <ComparisonModal 
            current={result}
            past={comparisonTarget.result || comparisonTarget.analysis_result}
            pastTitle={comparisonTarget.jobTitle || comparisonTarget.job_title}
            pastDate={comparisonTarget.createdAt || comparisonTarget.created_at}
            onClose={() => setComparisonTarget(null)}
          />
        )}
      </AnimatePresence>

      <footer className="h-12 bg-white border-t border-slate-200 flex items-center px-10 text-[10px] text-slate-400">
        <span>Analysis powered by Gemini-3-Flash • Result generated securely • System Ready</span>
      </footer>

      {/* Level Up Notification */}
      <AnimatePresence>
        {showLevelUp && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-8 py-6 rounded-3xl shadow-2xl flex flex-col items-center gap-4 border border-white/10 backdrop-blur-xl"
          >
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-900 w-24 h-24 rounded-full flex items-center justify-center shadow-lg border-4 border-slate-900">
              <Trophy size={48} />
            </div>
            <div className="mt-8 text-center">
              <h2 className="text-2xl font-black uppercase tracking-tighter italic">Level Up!</h2>
              <p className="text-amber-400 font-bold uppercase text-[10px] tracking-[0.3em] mb-2">{getLevelName(level)}</p>
              <div className="flex items-center justify-center gap-2 text-slate-400 text-xs">
                <span>Rank achieved:</span>
                <span className="text-white font-bold">{level}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white">
              <Star size={12} className="text-amber-400" fill="currentColor" />
              Progress Saved
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ComparisonModal({ current, past, pastTitle, pastDate, onClose }: { 
  current: AnalysisResult; 
  past: AnalysisResult; 
  pastTitle: string;
  pastDate: string;
  onClose: () => void; 
}) {
  const scoreDiff = current.match_score - past.match_score;
  
  // Skill Diffs
  const bridgedSkills = current.analysis.hard_skills_match.filter(s => 
    past.analysis.missing_skills.some(ms => ms.toLowerCase() === s.toLowerCase())
  );
  
  const stillMissing = current.analysis.missing_skills.filter(s => 
    past.analysis.missing_skills.some(ms => ms.toLowerCase() === s.toLowerCase())
  );

  const newMissing = current.analysis.missing_skills.filter(s => 
    !past.analysis.missing_skills.some(ms => ms.toLowerCase() === s.toLowerCase())
  );

  const radarLabels = ['Technical', 'Leadership', 'Experience', 'Domain'];
  const currentRadarScores = [
    current.radar_metrics.technical,
    current.radar_metrics.leadership,
    current.radar_metrics.experience,
    current.radar_metrics.domain
  ];
  const pastRadarScores = [
    past.radar_metrics.technical,
    past.radar_metrics.leadership,
    past.radar_metrics.experience,
    past.radar_metrics.domain
  ];

  const metricDeltas = radarLabels.map((label, index) => {
    const currentScore = currentRadarScores[index];
    const pastScore = pastRadarScores[index];
    const diff = currentScore - pastScore;
    return { label, currentScore, pastScore, diff };
  });

  const radarLabelsWithIndicators = radarLabels.map((label, index) => {
    const diff = currentRadarScores[index] - pastRadarScores[index];
    if (diff > 2) return `${label} ↑`;
    if (diff < -2) return `${label} ↓`;
    return label;
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-md"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        className="relative w-full max-w-4xl bg-white rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
              <Split size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Progress Comparison</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Comparing Current vs {new Date(pastDate).toLocaleDateString()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Main Comparison Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Match Score Shift</span>
              <div className="flex items-center gap-3">
                <span className="text-4xl font-black text-slate-800">{current.match_score}%</span>
                <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-black ${scoreDiff >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {scoreDiff > 0 ? <ArrowUpRight size={14} /> : scoreDiff < 0 ? <ArrowDownRight size={14} /> : <Minus size={14} />}
                  {Math.abs(scoreDiff)}%
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-bold mt-2 uppercase">WAS {past.match_score}%</p>
            </div>

            <div className="md:col-span-2 bg-slate-900 rounded-3xl p-6 text-white flex items-center justify-between overflow-hidden relative">
              <div className="flex-1 relative z-10">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Context Bridge</span>
                <h4 className="text-lg font-bold leading-tight mb-2">You have bridged {bridgedSkills.length} critical skill gaps since this version.</h4>
                <div className="flex flex-wrap gap-2">
                  {bridgedSkills.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-[9px] font-black uppercase tracking-tighter border border-green-500/30">+{s}</span>
                  ))}
                </div>
              </div>
              <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-1/4 opacity-10">
                <Target size={120} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Visual Delta */}
            <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col items-center">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 block text-center">Comparative Mapping</span>
              <div className="w-full h-[300px]">
                <RadarChartJS
                  data={{
                    labels: radarLabelsWithIndicators,
                    datasets: [
                      {
                        label: 'Current Strategy',
                        data: currentRadarScores,
                        backgroundColor: 'rgba(37, 99, 235, 0.25)',
                        borderColor: 'rgb(37, 99, 235)',
                        borderWidth: 3,
                        pointBackgroundColor: 'rgb(37, 99, 235)',
                        pointRadius: 4,
                      },
                      {
                        label: 'Previous Version',
                        data: pastRadarScores,
                        backgroundColor: 'rgba(100, 116, 139, 0.15)',
                        borderColor: 'rgba(100, 116, 139, 0.5)',
                        borderWidth: 2,
                        pointBackgroundColor: 'rgba(100, 116, 139, 0.5)',
                        borderDash: [5, 5],
                        pointRadius: 3,
                      }
                    ]
                  }}
                  options={{
                    scales: {
                      r: {
                        angleLines: { display: true },
                        suggestedMin: 0,
                        suggestedMax: 10,
                        ticks: { display: false, stepSize: 2 },
                        pointLabels: {
                          font: { size: 10, family: 'Inter', weight: 'bold' },
                          color: (context) => {
                            const index = context.index;
                            const diff = currentRadarScores[index] - pastRadarScores[index];
                            if (diff > 2) return '#10b981'; // Green for high growth
                            if (diff < -2) return '#ef4444'; // Red for decline
                            return '#64748b';
                          }
                        }
                      }
                    },
                    plugins: {
                      legend: { 
                        display: true,
                        position: 'bottom',
                        labels: {
                          boxWidth: 8,
                          usePointStyle: true,
                          font: { size: 10, weight: 'bold' }
                        }
                      }
                    },
                    maintainAspectRatio: false
                  }}
                />
              </div>

              {/* Metric Shift Analysis */}
              <div className="w-full mt-8 grid grid-cols-2 gap-3">
                {metricDeltas.map((m, i) => (
                  <div key={i} className={`p-3 rounded-2xl border ${Math.abs(m.diff) > 2 ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100 opacity-60'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{m.label}</span>
                      {m.diff > 2 ? (
                        <div className="flex items-center gap-0.5 text-green-600">
                          <ArrowUpRight size={10} strokeWidth={3} />
                          <span className="text-[10px] font-black">+{m.diff}</span>
                        </div>
                      ) : m.diff < -2 ? (
                        <div className="flex items-center gap-0.5 text-red-600">
                          <ArrowDownRight size={10} strokeWidth={3} />
                          <span className="text-[10px] font-black">{m.diff}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300">
                          {m.diff > 0 ? `+${m.diff}` : m.diff}
                        </span>
                      )}
                    </div>
                    <div className="h-1 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-slate-300" style={{ width: `${m.pastScore * 10}%` }}></div>
                      <div className={`h-full ${m.diff > 0 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${Math.abs(m.diff) * 10}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gap Delta */}
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Resolved Gaps</span>
                {bridgedSkills.length > 0 ? (
                  <div className="space-y-2">
                    {bridgedSkills.map((s, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-white border border-green-100 rounded-xl">
                        <div className="p-1 bg-green-50 text-green-600 rounded">
                          <CheckCircle2 size={14} />
                        </div>
                        <span className="text-xs font-bold text-slate-700">{s}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No gaps bridged yet. Keep optimizing.</p>
                )}
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-4">Remaining Vulnerabilities</span>
                <div className="space-y-2">
                  {stillMissing.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <div className="p-1 bg-slate-200 text-slate-500 rounded">
                        <AlertCircle size={14} />
                      </div>
                      <span className="text-xs font-bold text-slate-600">{s}</span>
                    </div>
                  ))}
                  {newMissing.map((s, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                      <div className="p-1 bg-red-100 text-red-500 rounded">
                        <Zap size={14} />
                      </div>
                      <span className="text-xs font-bold text-red-700">{s}</span>
                      <span className="text-[8px] font-black text-red-400 uppercase ml-auto tracking-tighter">New Gap Identified</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-center">
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Acknowledge Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function SkillDetailEditor({ skill, result, onClose, onSave }: { 
  skill: { name: string; type: string }; 
  result: AnalysisResult | null; 
  onClose: () => void; 
  onSave: (name: string, context: any) => void;
}) {
  const [years, setYears] = useState(result?.skill_context?.[skill.name]?.years || '');
  const [proficiency, setProficiency] = useState(result?.skill_context?.[skill.name]?.proficiency || '');
  const [notes, setNotes] = useState(result?.skill_context?.[skill.name]?.notes || '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">{skill.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Skill Contextualization</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-all">
            <X size={20} />
          </button>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Experience (Years)</label>
              <input 
                type="text" 
                placeholder="e.g. 5"
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proficiency</label>
              <select 
                value={proficiency}
                onChange={(e) => setProficiency(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none"
              >
                <option value="">Select Level</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
                <option value="Expert">Expert</option>
              </select>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Context / Projects</label>
            <textarea 
              placeholder="Briefly describe your experience with this skill..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
            />
          </div>
          <button 
            onClick={() => onSave(skill.name, { years, proficiency, notes })}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
          >
            Save Context
          </button>
        </div>
      </motion.div>
    </div>
  );
}
