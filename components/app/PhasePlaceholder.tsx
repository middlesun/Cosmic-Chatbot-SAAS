import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

interface PhasePlaceholderProps {
  title: string;
  phaseLabel: string;
  description: string;
}

const PhasePlaceholder: React.FC<PhasePlaceholderProps> = ({
  title,
  phaseLabel,
  description,
}) => {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl bg-[#FDFBF7] p-8 md:p-10 border border-[#3D3830]/10">
      <p className="text-xs text-[#8B8275] mb-2">{phaseLabel}</p>
      <h1 className="font-serif text-3xl md:text-4xl font-medium text-[#3D3830]">{title}</h1>
      <p className="mt-3 text-sm text-[#5C5449] leading-relaxed">{description}</p>
      <div className="mt-6">
        <Link
          to="/app/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Overview</span>
        </Link>
      </div>
    </div>
  );
};

export default PhasePlaceholder;
