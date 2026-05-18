import { Check } from 'lucide-react';

export default function StepIndicator({ steps, current }) {
  return (
    <nav className="w-full mb-8">
      <ol className="flex items-start">
        {steps.map((step, i) => {
          const done   = i < current;
          const active = i === current;
          const last   = i === steps.length - 1;
          return (
            <li key={i} className={`flex items-start ${!last ? 'flex-1' : ''}`}>
              {/* Circle + label */}
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-200 ${
                  done   ? 'bg-green-500 border-green-500 text-white shadow-sm' :
                  active ? 'bg-[#0f2057] border-[#0f2057] text-white shadow-md ring-4 ring-[#0f2057]/10' :
                           'bg-white border-gray-300 text-gray-400'
                }`}>
                  {done ? <Check size={14} strokeWidth={3} /> : i + 1}
                </div>
                <span className={`mt-1.5 text-[10px] font-medium text-center leading-tight w-14 ${
                  active ? 'text-[#0f2057] font-semibold' :
                  done   ? 'text-green-600' :
                           'text-gray-400'
                }`}>
                  {step}
                </span>
              </div>
              {/* Connector — mt-4 aligns it with circle centre (h-8 / 2 = 1rem) */}
              {!last && (
                <div className={`flex-1 h-0.5 mt-4 mx-1.5 rounded-full transition-colors duration-300 ${
                  done ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
