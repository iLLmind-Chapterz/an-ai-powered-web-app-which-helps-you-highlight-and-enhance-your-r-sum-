import React from 'react';
import { AnalysisResult } from '../types';

interface PrintableReportProps {
  data: AnalysisResult;
  id?: string;
}

export const PrintableReport = React.forwardRef<HTMLDivElement, PrintableReportProps>(({ data, id }, ref) => {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div 
      id={id}
      ref={ref}
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '20mm',
        backgroundColor: '#ffffff',
        fontFamily: "'Inter', 'Segoe UI', sans-serif",
        color: '#1e293b',
        boxSizing: 'border-box',
        margin: '0 auto',
        position: 'relative'
      }}
    >
      {/* Page Styles for Print */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          body { margin: 0; }
        }
        .report-label {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          color: #64748b;
          margin-bottom: 8px;
        }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: '4px solid #0f172a',
        paddingBottom: '20px',
        marginBottom: '40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end'
      }}>
        <div>
          <h1 style={{ 
            fontSize: '32px', 
            fontWeight: '900', 
            color: '#0f172a', 
            margin: 0,
            letterSpacing: '-0.02em',
            textTransform: 'uppercase'
          }}>
            Gap Analysis Report
          </h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '4px 0 0 0', fontWeight: '500' }}>
            Professional Technical Alignment Diagnostic
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>{date}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase' }}>Report ID: {Math.random().toString(36).substring(7).toUpperCase()}</div>
        </div>
      </div>

      {/* Hero Score Section */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        marginBottom: '50px',
        position: 'relative'
      }}>
        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          border: '12px solid #f1f5f9',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.05)',
          position: 'relative',
          zIndex: 1
        }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Match Score</span>
          <span style={{ fontSize: '56px', fontWeight: '900', color: '#0f172a', lineHeight: '1' }}>{data.match_score}%</span>
        </div>
        {/* Background Accent */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '240px',
          height: '240px',
          borderRadius: '50%',
          backgroundColor: '#f8fafc',
          zIndex: 0
        }} />
      </div>

      {/* Two Column Skills Section */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: '1fr 1fr', 
        gap: '40px',
        marginBottom: '50px'
      }}>
        {/* Matches / Strengths */}
        <div>
          <div className="report-label">Matches & Strengths</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {[...data.analysis.hard_skills_match, ...data.analysis.soft_skills_match].map((skill, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                backgroundColor: '#f1f5f9',
                border: '1px solid #e2e8f0',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#1e293b'
              }}>
                {skill}
              </div>
            ))}
          </div>
        </div>

        {/* Identified Gaps */}
        <div>
          <div className="report-label" style={{ color: '#ef4444' }}>Identified Gaps</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {data.analysis.missing_skills.map((skill, i) => (
              <div key={i} style={{
                padding: '6px 12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#b91c1c'
              }}>
                {skill}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Actionable Recommendations */}
      <div style={{
        backgroundColor: '#0f172a',
        padding: '30px',
        borderRadius: '12px',
        color: '#f8fafc'
      }}>
        <div className="report-label" style={{ color: '#94a3b8' }}>Actionable Recommendations</div>
        <ul style={{ 
          margin: '15px 0 0 0', 
          paddingLeft: '20px',
          listStyleType: 'square'
        }}>
          {data.improvement_plan.map((rec, i) => (
            <li key={i} style={{ 
              fontSize: '13px', 
              marginBottom: '12px',
              lineHeight: '1.6',
              fontWeight: '500'
            }}>
              {rec}
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Branding */}
      <div style={{
        position: 'absolute',
        bottom: '20mm',
        left: '20mm',
        right: '20mm',
        borderTop: '1px solid #e2e8f0',
        paddingTop: '15px',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '9px',
        color: '#94a3b8',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        <span>Generated by Gemini-3-Flash Diagnostic Engine</span>
        <span>Secure Professional Evaluation • Confidential</span>
      </div>
    </div>
  );
});
